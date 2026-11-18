import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from .db import events, grades, insert_once, notifications, now, profile_details, users

MOSCOW = timezone(timedelta(hours=3), 'Europe/Moscow')

DEMO_USERS = [
    (1, 'student1', 'student', 'Анна Орлова', 'Высшая школа экономики и бизнеса', 'Экономика', 2, 'ДЕМО-ЭК-21'),
    (2, 'student2', 'student', 'Михаил Светлов', 'Высшая школа кибертехнологий', 'Прикладная информатика', 3, 'ДЕМО-ПИ-31'),
    (3, 'staff', 'staff', 'Елена Лебедева', 'Учебный офис', None, None, None),
]
DEMO_PROFILE_DETAILS = {
    'student1': dict(
        full_name='Орлова Анна Сергеевна', email='anna.orlova@example.org', phone='+7 (000) 000-00-01',
        specialization='Финансы и кредит', education_level='Бакалавриат', study_mode='Очная', study_basis='Бюджетная',
    ),
    'student2': dict(
        full_name='Светлов Михаил Андреевич', email='mikhail.svetlov@example.org', phone='+7 (000) 000-00-02',
        specialization='Информационные системы в экономике', education_level='Бакалавриат', study_mode='Очная',
        study_basis='Договорная',
    ),
    'staff': dict(full_name='Лебедева Елена Викторовна', email='elena.lebedeva@example.org', phone='+7 (000) 000-00-03'),
}
DEMO_GRADES = [
    (1, 1, 'Микроэкономика', 'Экзамен', 'Отлично', None),
    (2, 1, 'Иностранный язык', 'Зачёт', 'Зачтено', None),
    (3, 1, 'Статистика', 'Экзамен', 'Хорошо', None),
    (4, 1, 'Финансы', 'Экзамен', None, 18),
    (5, 2, 'Базы данных', 'Экзамен', 'Хорошо', None),
    (6, 2, 'Алгоритмы', 'Зачёт', 'Зачтено', None),
    (7, 2, 'Проектирование ИС', 'Экзамен', None, 20),
]
DEMO_EVENTS = [
    (1, 'career', 'Встреча с карьерным центром', 'Разберём резюме и подготовку к первой стажировке.', 'Корпус 1, аудитория 305', 0, '11:00', '12:00'),
    (2, 'community', 'Вечер настольных игр', 'Открытая встреча студенческого сообщества.', 'Студенческое пространство', 2, '18:00', '20:00'),
    (3, 'study', 'Практикум по работе с данными', 'Решим несколько задач на небольшом наборе данных.', 'Корпус 3, аудитория 412', 4, '14:00', '15:30'),
]


def today():
    return datetime.now(MOSCOW).date()


def seed_demo(conn):
    from .auth import hash_password

    password = os.getenv('DEMO_PASSWORD') or 'Campus-demo-26'
    for identity, login, role, name, faculty, program, year, group in DEMO_USERS:
        if conn.scalar(select(users.c.id).where(users.c.id == identity)) is None:
            insert_once(conn, users, dict(
                id=identity, login=login, password=hash_password(password), role=role, name=name,
                faculty=faculty, program=program, year=year, group=group,
            ), ['id'])
        demo_user_id = conn.scalar(select(users.c.id).where(
            users.c.id == identity, users.c.login == login, users.c.role == role,
        ))
        if demo_user_id is not None:
            insert_once(conn, profile_details, dict(user_id=demo_user_id, **DEMO_PROFILE_DETAILS[login]), ['user_id'])
    for identity, student, subject, kind, result, offset in DEMO_GRADES:
        insert_once(conn, grades, dict(id=identity, user_id=student, subject=subject, kind=kind, result=result,
                                       exam_date=today() + timedelta(days=offset) if offset else None), ['id'])
    for identity, category, title, description, location, offset, start, end in DEMO_EVENTS:
        insert_once(conn, events, dict(id=identity, category=category, title=title, description=description,
                                      location=location, date=today() + timedelta(days=offset), start=start, end=end), ['id'])
    for member in (1, 2):
        insert_once(conn, notifications, dict(
            user_id=member, kind='announcement', title='Открылся цифровой деканат',
            message='В демонстрационном кабинете можно отправить обращение и отследить ответ.',
            created_at=now(), event_key='welcome',
        ), ['user_id', 'event_key'])


def demo_lessons(profile, start: date, end: date):
    subjects = (('Микроэкономика', 'Иностранный язык', 'Статистика', 'Финансы') if profile['login'] == 'student1'
                else ('Базы данных', 'Алгоритмы', 'Проектирование ИС', 'Аналитика данных'))
    lessons = []
    current = start
    while current <= end:
        weekday = current.weekday()
        if weekday < 5:
            for slot, (starts, ends, room, teacher) in enumerate((
                ('10:40', '12:10', 'Корпус 1, аудитория 305', 'Ольга Миронова'),
                ('12:20', '13:50', 'Корпус 3, аудитория 412', 'Андрей Лавров'),
            )):
                changed = weekday == 2 and slot == 1
                lessons.append(dict(
                    id=f'demo-{current.isoformat()}-{slot}', date=current.isoformat(), start=starts, end=ends,
                    subject=subjects[(weekday + slot) % len(subjects)], teacher=teacher,
                    room='Корпус 3, аудитория 416' if changed else room,
                    kind='Семинар' if slot else 'Лекция',
                    change='Аудитория изменена: 412 → 416' if changed else None,
                ))
        current += timedelta(days=1)
    return lessons

