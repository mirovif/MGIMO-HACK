import hashlib
import json
from datetime import date
from typing import Annotated, Literal
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError
from sqlalchemy import select, update
from starlette.datastructures import UploadFile

from .auth import current_user, staff_only, student_only
from .db import attachments, grades, history, insert_once, notifications, now, profile_details, profile_full_name, requests, users
from .demo import demo_lessons

router = APIRouter(prefix='/api/requests')
MAX_FILE = 3 * 1024 * 1024
SCENARIO = {'illness': 'Я заболел', 'retake': 'Мне нужна пересдача', 'certificate': 'Мне нужна справка', 'other': 'Не знаю, куда обратиться'}
STATUS = {'submitted': 'Получено', 'review': 'На рассмотрении', 'clarification': 'Нужно уточнение', 'resolved': 'Решено', 'rejected': 'Отклонено'}
TRANSITIONS = {
    'submitted': {'review', 'clarification', 'rejected'},
    'review': {'clarification', 'resolved', 'rejected'},
    'clarification': {'review', 'rejected'},
    'resolved': set(),
    'rejected': set(),
}
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
RequiredNote = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]


class Details(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Illness(Details):
    start_date: date
    end_date: date
    missed_ids: list[Annotated[str, StringConstraints(max_length=32)]] = Field(default_factory=list, max_length=62)
    comment: Note = ''


class Retake(Details):
    subject: Annotated[str, StringConstraints(max_length=120)]
    comment: RequiredNote


class Certificate(Details):
    certificate_type: Literal['study', 'scholarship', 'session']
    comment: Note = ''


class Other(Details):
    category: Literal['study', 'documents', 'campus', 'other']
    comment: RequiredNote


class CreateCase(Details):
    scenario: Literal['illness', 'retake', 'certificate', 'other']
    details: dict


class StaffAction(Details):
    status: Literal['review', 'clarification', 'resolved', 'rejected'] | None = None
    message: Note = ''
    version: int = Field(ge=1)


class Reply(Details):
    message: RequiredNote
    version: int = Field(ge=1)


SCHEMA = {'illness': Illness, 'retake': Retake, 'certificate': Certificate, 'other': Other}


def public_case(row):
    return {
        **{key: row[key] for key in ('id', 'scenario', 'status', 'version', 'created_at', 'updated_at')},
        'number': 'COS-' + row['id'].replace('-', '')[:10].upper(),
        'student': row['name'],
    }


def case_query(user):
    query = select(requests, profile_full_name.label('name')).join(users, users.c.id == requests.c.user_id).outerjoin(
        profile_details, profile_details.c.user_id == users.c.id,
    )
    return query.where(requests.c.user_id == user['id']) if user['role'] == 'student' else query


def get_case(conn, user, case_id):
    row = conn.execute(case_query(user).where(requests.c.id == case_id)).mappings().first()
    if not row:
        raise HTTPException(404, 'Обращение не найдено.')
    return row


def detail(conn, row):
    entries = conn.execute(select(
        history.c.id, history.c.action, history.c.status, history.c.message, history.c.created_at,
        profile_full_name.label('actor'), users.c.role,
    ).join(users, history.c.actor_id == users.c.id).outerjoin(
        profile_details, profile_details.c.user_id == users.c.id,
    ).where(history.c.request_id == row['id']).order_by(history.c.id)).mappings()
    attachment = conn.scalar(select(attachments.c.name).where(attachments.c.request_id == row['id']))
    return {**public_case(row), 'details': row['details'], 'attachment': attachment,
            'history': [dict(entry) for entry in entries]}


@router.get('')
def list_cases(request: Request, user=Depends(current_user)):
    with request.app.state.engine.connect() as conn:
        rows = conn.execute(case_query(user).order_by(requests.c.updated_at.desc(), requests.c.id).limit(200)).mappings()
        return [public_case(row) for row in rows]


@router.get('/{case_id}')
def read_case(case_id: UUID, request: Request, user=Depends(current_user)):
    with request.app.state.engine.connect() as conn:
        return detail(conn, get_case(conn, user, str(case_id)))


def file_data(upload, data):
    from pathlib import PurePosixPath

    if len(data) > MAX_FILE:
        raise HTTPException(413, 'Файл должен быть меньше 3 МБ.')
    kinds = ((b'%PDF-', 'application/pdf'), (b'\x89PNG\r\n\x1a\n', 'image/png'), (b'\xff\xd8\xff', 'image/jpeg'))
    mime = next((kind for signature, kind in kinds if data.startswith(signature)), None)
    if mime is None:
        raise HTTPException(422, 'Загрузите PDF, PNG или JPEG.')
    name = PurePosixPath((upload.filename or 'Документ').replace(chr(92), '/')).name
    name = ''.join(char for char in name if char.isprintable()).strip()[:160] or 'Документ'
    return dict(name=name, content_type=mime, content=data)


async def read_submission(request):
    length = request.headers.get('content-length')
    if length and int(length) > MAX_FILE + 32 * 1024:
        raise HTTPException(413, 'Слишком большой размер отправки.')
    if request.headers.get('content-type', '').startswith('multipart/form-data'):
        async with request.form(max_files=1, max_fields=1, max_part_size=20_000) as form:
            raw = form.get('payload')
            upload = form.get('file')
            if not isinstance(raw, str) or (upload is not None and not isinstance(upload, UploadFile)):
                raise HTTPException(422, 'Проверьте данные и вложение.')
            data = CreateCase.model_validate_json(raw)
            file = file_data(upload, await upload.read(MAX_FILE + 1)) if upload else None
            return data, file
    return CreateCase.model_validate_json(await request.body()), None


def validate_details(conn, user, data):
    if isinstance(data, Illness):
        length = (data.end_date - data.start_date).days
        if not 0 <= length <= 30:
            raise HTTPException(422, 'Укажите период от 1 до 31 дня и проверьте порядок дат.')
        lessons = demo_lessons(user, data.start_date, data.end_date)
        requested = set(data.missed_ids)
        matched = [item for item in lessons if item['id'] in requested]
        if len(matched) != len(requested):
            raise HTTPException(422, 'Проверьте список пропущенных занятий.')
        return {**data.model_dump(mode='json', exclude={'missed_ids'}), 'missed_lessons': matched}
    if isinstance(data, Retake):
        subject = conn.scalar(select(grades.c.id).where(grades.c.user_id == user['id'], grades.c.subject == data.subject))
        if subject is None:
            raise HTTPException(422, 'Выберите свою дисциплину.')
    if isinstance(data, Certificate):
        return {**data.model_dump(), 'profile': {key: user[key] for key in ('name', 'faculty', 'program', 'year', 'group')}}
    return data.model_dump()


def save_submission(engine, user, key, data, file):
    try:
        parsed = SCHEMA[data.scenario].model_validate(data.details)
    except ValidationError as exc:
        raise HTTPException(422, 'Проверьте обязательные поля обращения.') from exc
    payload = {'scenario': data.scenario, 'details': parsed.model_dump(mode='json')}
    if file:
        if data.scenario != 'illness':
            raise HTTPException(422, 'Вложение предусмотрено для сценария болезни.')
        payload['file'] = [file['name'], hashlib.sha256(file['content']).hexdigest()]
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    case_id = str(uuid4())
    timestamp = now()
    with engine.begin() as conn:
        details = validate_details(conn, user, parsed)
        created = insert_once(conn, requests, dict(
            id=case_id, user_id=user['id'], idempotency_key=key, fingerprint=fingerprint,
            scenario=data.scenario, details=details, status='submitted', version=1, created_at=timestamp, updated_at=timestamp,
        ), ['user_id', 'idempotency_key'], returning=requests.c.id)
        if created is None:
            prior = conn.execute(case_query(user).where(requests.c.idempotency_key == key)).mappings().one()
            if prior['fingerprint'] != fingerprint:
                raise HTTPException(409, 'Ключ отправки уже использован для другого обращения.')
            return detail(conn, prior)
        if file:
            conn.execute(attachments.insert().values(request_id=case_id, **file))
        record(conn, case_id, user['id'], 'submitted', 'created', None, timestamp)
        for staff in conn.scalars(select(users.c.id).where(users.c.role == 'staff')):
            notify(conn, staff, case_id, 'Новое обращение', SCENARIO[data.scenario], timestamp)
        return detail(conn, get_case(conn, user, case_id))


@router.post('', status_code=201, openapi_extra={
    'requestBody': {'required': True, 'content': {
        'application/json': {'schema': CreateCase.model_json_schema()},
        'multipart/form-data': {'schema': {
            'type': 'object', 'required': ['payload'],
            'properties': {
                'payload': {'type': 'string', 'description': 'JSON с полями scenario и details'},
                'file': {'type': 'string', 'format': 'binary', 'description': 'Вложение до 3 МБ для сценария illness'},
            },
        }},
    }},
})
async def create_case(
    request: Request, key: Annotated[UUID, Header(alias='Idempotency-Key')], user=Depends(student_only),
):
    from starlette.concurrency import run_in_threadpool

    try:
        data, file = await read_submission(request)
    except (ValidationError, ValueError) as exc:
        raise HTTPException(422, 'Проверьте данные обращения.') from exc
    return await run_in_threadpool(save_submission, request.app.state.engine, user, str(key), data, file)


@router.get('/{case_id}/attachment')
def download_attachment(case_id: UUID, request: Request, user=Depends(current_user)):
    with request.app.state.engine.connect() as conn:
        get_case(conn, user, str(case_id))
        file = conn.execute(select(attachments).where(attachments.c.request_id == str(case_id))).mappings().first()
    if not file:
        raise HTTPException(404, 'Вложение не найдено.')
    return Response(file['content'], media_type=file['content_type'], headers={
        'Content-Disposition': "attachment; filename*=UTF-8''" + quote(file['name'], safe=''),
    })


def record(conn, case_id, actor, status, action, message, timestamp):
    conn.execute(history.insert().values(request_id=case_id, actor_id=actor, status=status,
                                         action=action, message=message or None, created_at=timestamp))


def notify(conn, recipient, case_id, title, message, timestamp):
    conn.execute(notifications.insert().values(user_id=recipient, request_id=case_id, kind='request',
                                              title=title, message=message, created_at=timestamp))


def advance(conn, row, version, status, timestamp):
    if row['version'] != version:
        raise HTTPException(409, 'Обращение обновилось. Загрузите актуальную версию.')
    changed = conn.scalar(update(requests).where(requests.c.id == row['id'], requests.c.version == version)
                          .values(status=status, version=version + 1, updated_at=timestamp).returning(requests.c.id))
    if changed is None:
        raise HTTPException(409, 'Обращение обновилось. Загрузите актуальную версию.')


@router.post('/{case_id}/staff')
def staff_action(case_id: UUID, data: StaffAction, request: Request, user=Depends(staff_only)):
    with request.app.state.engine.begin() as conn:
        row = get_case(conn, user, str(case_id))
        current = row['status']
        status = data.status or current
        if data.status and status not in TRANSITIONS[current]:
            raise HTTPException(409, 'Этот переход статуса недоступен.')
        if (not data.status or status in {'clarification', 'rejected'}) and len(data.message) < 3:
            raise HTTPException(422, 'Добавьте пояснение из трёх или более символов.')
        timestamp = now()
        advance(conn, row, data.version, status, timestamp)
        record(conn, row['id'], user['id'], status, 'status' if data.status else 'comment', data.message, timestamp)
        notify(conn, row['user_id'], row['id'], STATUS[status] if data.status else 'Комментарий деканата',
               data.message or SCENARIO[row['scenario']], timestamp)
        return detail(conn, get_case(conn, user, row['id']))


@router.post('/{case_id}/reply')
def student_reply(case_id: UUID, data: Reply, request: Request, user=Depends(student_only)):
    with request.app.state.engine.begin() as conn:
        row = get_case(conn, user, str(case_id))
        if row['status'] != 'clarification':
            raise HTTPException(409, 'Сейчас заявка не ожидает уточнения.')
        timestamp = now()
        advance(conn, row, data.version, 'review', timestamp)
        record(conn, row['id'], user['id'], 'review', 'reply', data.message, timestamp)
        for staff in conn.scalars(select(users.c.id).where(users.c.role == 'staff')):
            notify(conn, staff, row['id'], 'Студент ответил на уточнение', data.message, timestamp)
        return detail(conn, get_case(conn, user, row['id']))
