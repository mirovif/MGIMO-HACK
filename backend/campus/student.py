from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, or_, select, update

from .auth import current_user, student_only
from .db import events, favorites, grades, insert_once, notifications, now, ratings
from .demo import demo_lessons, today

router = APIRouter(prefix='/api')


@router.get('/schedule')
def schedule(on: date | None = None, span: Literal['day', 'week'] = 'day', user=Depends(student_only)):
    first = on or today()
    last = first
    if span == 'week':
        first -= timedelta(days=first.weekday())
        last = first + timedelta(days=6)
    return {'source': 'demo', 'start': first, 'end': last, 'group': user['group'], 'lessons': demo_lessons(user, first, last)}


@router.get('/schedule/missed')
def missed(start: date, end: date, user=Depends(student_only)):
    if not 0 <= (end - start).days <= 30:
        raise HTTPException(422, 'Укажите период от 1 до 31 дня.')
    return demo_lessons(user, start, end)


@router.get('/grades')
def read_grades(request: Request, user=Depends(student_only)):
    with request.app.state.engine.connect() as conn:
        rows = conn.execute(select(grades.c.subject, grades.c.kind, grades.c.result, grades.c.exam_date)
                            .where(grades.c.user_id == user['id']).order_by(grades.c.id)).mappings()
        return [dict(row) for row in rows]


@router.get('/rating')
def read_rating(request: Request, user=Depends(student_only)):
    query = select(ratings.c.subject, ratings.c.earned, ratings.c.maximum).where(
        ratings.c.user_id == user['id'],
    ).order_by(ratings.c.subject)
    with request.app.state.engine.connect() as conn:
        courses = [dict(row) for row in conn.execute(query).mappings()]
    return {
        'earned': sum(course['earned'] for course in courses),
        'maximum': sum(course['maximum'] for course in courses),
        'courses': courses,
    }


@router.get('/events')
def read_events(request: Request, category: Literal['career', 'study', 'community'] | None = None,
                saved: bool = False, user=Depends(student_only)):
    query = select(events, favorites.c.event_id.label('favorite_id')).outerjoin(
        favorites, (favorites.c.event_id == events.c.id) & (favorites.c.user_id == user['id']),
    )
    if category:
        query = query.where(events.c.category == category)
    if saved:
        query = query.where(favorites.c.event_id.is_not(None))
    with request.app.state.engine.connect() as conn:
        rows = conn.execute(query.order_by(events.c.date, events.c.start)).mappings()
        result = []
        for row in rows:
            overlaps = [lesson['subject'] for lesson in demo_lessons(user, row['date'], row['date'])
                        if row['start'] < lesson['end'] and row['end'] > lesson['start']]
            item = {key: value for key, value in row.items() if key != 'favorite_id'}
            result.append({**item, 'favorite': row['favorite_id'] is not None, 'conflicts': overlaps})
        return result


@router.put('/events/{event_id}/favorite', status_code=204)
@router.delete('/events/{event_id}/favorite', status_code=204)
def favorite(event_id: int, request: Request, user=Depends(student_only)):
    identity = {'user_id': user['id'], 'event_id': event_id}
    with request.app.state.engine.begin() as conn:
        if not conn.scalar(select(events.c.id).where(events.c.id == event_id)):
            raise HTTPException(404, 'Мероприятие не найдено.')
        if request.method == 'PUT':
            insert_once(conn, favorites, identity, ['user_id', 'event_id'])
        else:
            conn.execute(delete(favorites).filter_by(**identity))
    return Response(status_code=204)


@router.get('/notifications')
def read_notifications(request: Request, user=Depends(current_user)):
    exams = {}
    with request.app.state.engine.begin() as conn:
        if user['role'] == 'student':
            first = today()
            for lesson in demo_lessons(user, first, first + timedelta(days=6)):
                if lesson['change']:
                    insert_once(conn, notifications, dict(
                        user_id=user['id'], kind='schedule', title='Изменение расписания',
                        message=f'{lesson["date"]} · {lesson["subject"]}. {lesson["change"]}',
                        created_at=now(), event_key=f'demo-change-{lesson["id"]}',
                    ), ['user_id', 'event_key'])
            upcoming = select(grades).where(
                grades.c.user_id == user['id'],
                grades.c.exam_date.between(first, first + timedelta(days=28)),
            )
            for exam in conn.execute(upcoming):
                retake = exam.result in {'Неудовлетворительно', 'Не зачтено'}
                title = 'Предстоит пересдача' if retake else 'Предстоит аттестация'
                key = f'exam-{exam.id}-{exam.exam_date}'
                exams[key] = {'subject': exam.subject, 'date': exam.exam_date, 'retake': retake}
                insert_once(conn, notifications, dict(
                    user_id=user['id'], kind='exam', title=title, message=exam.subject,
                    created_at=now(), event_key=key,
                ), ['user_id', 'event_key'])
        query = select(notifications).where(
            notifications.c.user_id == user['id'],
            or_(notifications.c.kind != 'exam', notifications.c.event_key.in_(exams)),
        ).order_by(notifications.c.id.desc()).limit(100)
        return [
            {
                **{key: val for key, val in row.items() if key not in {'user_id', 'event_key'}},
                **({'exam': exams[row['event_key']]} if row['event_key'] in exams else {}),
            }
            for row in conn.execute(query).mappings()
        ]


@router.post('/notifications/{notification_id}/read', status_code=204)
def mark_read(notification_id: int, request: Request, user=Depends(current_user)):
    with request.app.state.engine.begin() as conn:
        changed = conn.scalar(update(notifications).where(
            notifications.c.id == notification_id, notifications.c.user_id == user['id'],
        ).values(read_at=now()).returning(notifications.c.id))
        if changed is None:
            raise HTTPException(404, 'Уведомление не найдено.')
    return Response(status_code=204)
