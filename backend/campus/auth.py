import hashlib
import hmac
import os
import re
import secrets
import time
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .db import profile_details, profile_full_name, profile_names, sessions, users

router = APIRouter(prefix='/api')
COOKIE = 'campus_session'
SESSION_SECONDS = 8 * 60 * 60


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'{salt}:{digest}'


def password_matches(password, stored):
    return hmac.compare_digest(hash_password(password, stored.split(':', 1)[0]), stored)


DUMMY_PASSWORD = hash_password('dummy', '00' * 16)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def profile(row):
    fields = ('id', 'login', 'role', 'name', 'display_name', 'faculty', 'program', 'year', 'group')
    return {field: row[field] for field in fields}


def profile_query():
    account_columns = [column for column in users.c if column.key != 'name']
    return select(*account_columns, profile_full_name.label('name'), profile_names.c.display_name).outerjoin_from(
        users, profile_details, profile_details.c.user_id == users.c.id,
    ).outerjoin(profile_names, profile_names.c.user_id == users.c.id)


def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token or len(token) != 43:
        raise HTTPException(401, 'Войдите в личный кабинет.')
    with request.app.state.engine.connect() as conn:
        row = conn.execute(profile_query().join(sessions, sessions.c.user_id == users.c.id).where(
            sessions.c.token == digest(token), sessions.c.expires_at > int(time.time()),
        )).mappings().first()
    if row is None:
        raise HTTPException(401, 'Сеанс истёк. Войдите снова.')
    return profile(row)


def student_only(user=Depends(current_user)):
    if user['role'] != 'student':
        raise HTTPException(403, 'Раздел доступен студентам.')
    return user


def staff_only(user=Depends(current_user)):
    if user['role'] != 'staff':
        raise HTTPException(403, 'Действие доступно сотрудникам.')
    return user


class Credentials(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class ProfileDetails(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    specialization: str | None = None
    education_level: str | None = None
    study_mode: str | None = None
    study_basis: str | None = None


def normalize_person_name(value: str, max_length: int) -> str:
    if any(unicodedata.category(char).startswith('C') for char in value):
        raise ValueError('Недопустимый символ в имени.')
    name = ' '.join(unicodedata.normalize('NFC', value).split())
    if not 1 <= len(name) <= max_length:
        raise ValueError(f'Имя должно содержать от 1 до {max_length} символов.')
    return name


class DisplayNameUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    display_name: str | None

    @field_validator('display_name')
    @classmethod
    def normalize_display_name(cls, value):
        return normalize_person_name(value, 40) if value is not None else None


class ProfileUpdate(DisplayNameUpdate):
    display_name: str | None = None
    full_name: str
    email: EmailStr | None
    phone: str | None

    @field_validator('full_name')
    @classmethod
    def normalize_full_name(cls, value):
        return normalize_person_name(value, 160)

    @field_validator('email', 'phone', mode='before')
    @classmethod
    def trim_contact(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator('email')
    @classmethod
    def check_email_length(cls, value):
        if value is not None and len(value) > 254:
            raise ValueError('Почта должна содержать не более 254 символов.')
        return value

    @field_validator('phone')
    @classmethod
    def check_phone(cls, value):
        if value is None:
            return None
        digits = re.sub(r'[^0-9]', '', value)
        if len(value) > 32 or not 7 <= len(digits) <= 15 or not re.fullmatch(r'\+?[0-9() -]+', value):
            raise ValueError('Укажите телефон с 7–15 цифрами.')
        return value


@router.post('/auth/login')
def login(data: Credentials, request: Request, response: Response):
    engine = request.app.state.engine
    with engine.connect() as conn:
        user = conn.execute(profile_query().where(users.c.login == data.login.strip().casefold())).mappings().first()
    stored = user['password'] if user else DUMMY_PASSWORD
    if not password_matches(data.password, stored) or not user:
        raise HTTPException(401, 'Проверьте логин и пароль.')
    token = secrets.token_urlsafe(32)
    timestamp = int(time.time())
    with engine.begin() as conn:
        conn.execute(delete(sessions).where(sessions.c.expires_at <= timestamp))
        previous = request.cookies.get(COOKIE)
        if previous:
            conn.execute(delete(sessions).where(sessions.c.token == digest(previous)))
        conn.execute(sessions.insert().values(token=digest(token), user_id=user['id'], expires_at=timestamp + SESSION_SECONDS))
    response.set_cookie(
        COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite='lax',
        secure=bool(os.getenv('VERCEL')) or os.getenv('APP_ENV') == 'production',
    )
    return profile(user)


@router.post('/auth/logout', status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with request.app.state.engine.begin() as conn:
            conn.execute(delete(sessions).where(sessions.c.token == digest(token)))
    response.delete_cookie(COOKIE)


@router.get('/profile')
def me(user=Depends(current_user)):
    return user


@router.put('/profile/display-name')
def update_display_name(data: DisplayNameUpdate, request: Request, user=Depends(current_user)):
    with request.app.state.engine.begin() as conn:
        save_display_name(conn, user['id'], data.display_name)
    return {**user, 'display_name': data.display_name}


def save_display_name(conn, user_id, display_name):
    if display_name is None:
        conn.execute(delete(profile_names).where(profile_names.c.user_id == user_id))
        return
    insert = postgres_insert if conn.dialect.name == 'postgresql' else sqlite_insert
    statement = insert(profile_names).values(user_id=user_id, display_name=display_name)
    conn.execute(statement.on_conflict_do_update(
        index_elements=[profile_names.c.user_id],
        set_={'display_name': statement.excluded.display_name},
    ))


@router.get('/profile/details')
def read_profile_details(request: Request, user=Depends(current_user)) -> ProfileDetails:
    query = select(profile_details).where(profile_details.c.user_id == user['id'])
    with request.app.state.engine.connect() as conn:
        row = conn.execute(query).mappings().first()
    details = ProfileDetails(**row) if row is not None else ProfileDetails()
    details.full_name = (details.full_name or '').strip() or user['name']
    return details


@router.put('/profile/details')
def update_profile_details(data: ProfileUpdate, request: Request, user=Depends(current_user)):
    fields = data.model_dump(exclude={'display_name'})
    with request.app.state.engine.begin() as conn:
        if 'display_name' in data.model_fields_set:
            save_display_name(conn, user['id'], data.display_name)
            user = {**user, 'display_name': data.display_name}
        insert = postgres_insert if conn.dialect.name == 'postgresql' else sqlite_insert
        statement = insert(profile_details).values(user_id=user['id'], **fields)
        row = conn.execute(statement.on_conflict_do_update(
            index_elements=[profile_details.c.user_id],
            set_={field: statement.excluded[field] for field in fields},
        ).returning(*profile_details.c)).mappings().one()
    return {'profile': {**user, 'name': row['full_name']}, 'details': ProfileDetails(**row)}
