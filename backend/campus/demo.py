import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_, select, update

from .db import events, grades, insert_once, notifications, now, profile_details, ratings, users

MOSCOW = timezone(timedelta(hours=3), 'Europe/Moscow')

DEMO_USERS = [
    ('student1', 'student', 'Анна Орлова', 'Высшая школа экономики и бизнеса', 'Экономика', 2, 'ДЕМО-ЭК-21'),
    ('student2', 'student', 'Михаил Светлов', 'Высшая школа кибертехнологий', 'Прикладная информатика', 3, 'ДЕМО-ПИ-31'),
    ('staff', 'staff', 'Елена Лебедева', 'Учебный офис', None, None, None),
    ('student3', 'student', 'Кирилл Новиков', 'Высшая школа кибертехнологий', 'Бизнес-информатика', 2, 'ДЕМО-БИ-22'),
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
    'student3': dict(
        full_name='Новиков Кирилл Павлович', email='kirill.novikov@example.org', phone='+7 (000) 000-00-04',
        specialization='Разработка информационных систем', education_level='Бакалавриат', study_mode='Очная',
        study_basis='Бюджетная',
    ),
    'staff': dict(full_name='Лебедева Елена Викторовна', email='elena.lebedeva@example.org', phone='+7 (000) 000-00-03'),
}
DEMO_COURSES = {
    'student1': (
        ('Микроэкономика', 85, 'Экзамен', 'Отлично', None),
        ('Иностранный язык', 72, 'Зачёт', 'Зачтено', None),
        ('Статистика', 63, 'Экзамен', 'Хорошо', None),
        ('Финансы', 54, 'Экзамен', None, 18),
    ),
    'student2': (
        ('Базы данных', 74, 'Экзамен', 'Хорошо', None),
        ('Алгоритмы', 81, 'Зачёт', 'Зачтено', None),
        ('Проектирование ИС', 57, 'Экзамен', None, 20),
        ('Аналитика данных', 48, 'Зачёт', 'Зачтено', None),
    ),
    'student3': (
        ('Базы данных', 61, 'Экзамен', 'Неудовлетворительно', 5),
        ('Алгоритмы', 69, 'Зачёт', 'Зачтено', None),
        ('Проектирование ИС', 76, 'Экзамен', 'Хорошо', None),
        ('Аналитика данных', 52, 'Зачёт', 'Зачтено', None),
    ),
}
DEMO_EVENTS = [
    (1, 'career', 'Встреча с карьерным центром', 'Разберём резюме и подготовку к первой стажировке.', 'Корпус 1, аудитория 305', 0, '11:00', '12:00'),
    (2, 'community', 'Вечер настольных игр', 'Открытая встреча студенческого сообщества.', 'Студенческое пространство', 2, '18:00', '20:00'),
    (3, 'study', 'Практикум по работе с данными', 'Решим несколько задач на небольшом наборе данных.', 'Корпус 3, аудитория 412', 4, '14:00', '15:30'),
]


def today():
    return datetime.now(MOSCOW).date()


def fill_missing_values(conn, table, identity, values):
    conn.execute(
        update(table).where(identity, or_(*(table.c[key].is_(None) for key in values))).values(
            {key: func.coalesce(table.c[key], value) for key, value in values.items()},
        ),
    )


def seed_demo(conn):
    from .auth import hash_password

    password = os.getenv('DEMO_PASSWORD') or 'Campus-demo-26'
    # Initialization serializes this seed. IDs continue after rows written by older explicit-ID fixtures.
    next_user_id = (conn.scalar(select(func.max(users.c.id))) or 0) + 1
    next_grade_id = (conn.scalar(select(func.max(grades.c.id))) or 0) + 1
    seed_date = today()
    for login, role, name, faculty, program, year, group in DEMO_USERS:
        user = conn.execute(select(users.c.id, users.c.role).where(users.c.login == login)).one_or_none()
        academic = dict(faculty=faculty, program=program, year=year, group=group) if role == 'student' else dict(faculty=faculty)
        if user is None:
            user_id = next_user_id
            next_user_id += 1
            conn.execute(users.insert().values(
                id=user_id, login=login, password=hash_password(password), role=role, name=name, **academic,
            ))
        elif user.role == role:
            user_id = user.id
            fill_missing_values(conn, users, users.c.id == user_id, academic)
        else:
            continue

        details = DEMO_PROFILE_DETAILS[login]
        insert_once(conn, profile_details, dict(user_id=user_id, **details), ['user_id'])
        if role != 'student':
            continue

        study_fields = ('specialization', 'education_level', 'study_mode', 'study_basis')
        fill_missing_values(conn, profile_details, profile_details.c.user_id == user_id,
                            {field: details[field] for field in study_fields})
        existing_subjects = set(conn.scalars(select(grades.c.subject).where(grades.c.user_id == user_id)))
        for subject, earned, kind, result, exam_offset in DEMO_COURSES[login]:
            insert_once(conn, ratings, dict(user_id=user_id, subject=subject, earned=earned, maximum=100),
                        ['user_id', 'subject'])
            if subject not in existing_subjects:
                conn.execute(grades.insert().values(
                    id=next_grade_id, user_id=user_id, subject=subject, kind=kind, result=result,
                    exam_date=seed_date + timedelta(days=exam_offset) if exam_offset is not None else None,
                ))
                next_grade_id += 1
        insert_once(conn, notifications, dict(
            user_id=user_id, kind='announcement', title='Открылся цифровой деканат',
            message='В демонстрационном кабинете можно отправить обращение и отследить ответ.',
            created_at=now(), event_key='welcome',
        ), ['user_id', 'event_key'])

    for identity, category, title, description, location, offset, start, end in DEMO_EVENTS:
        insert_once(conn, events, dict(id=identity, category=category, title=title, description=description,
                                      location=location, date=seed_date + timedelta(days=offset), start=start, end=end), ['id'])


def demo_lessons(profile, start: date, end: date):
    login = profile['login']
    if login == 'student1-legacy':
        login = 'student1'
    subjects = tuple(course[0] for course in DEMO_COURSES.get(login, DEMO_COURSES['student2']))
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

