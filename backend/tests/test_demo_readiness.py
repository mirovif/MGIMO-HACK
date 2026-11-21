from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app import create_app
from campus.auth import hash_password
from campus.db import engine_for, grades, initialize, profile_details, users


FIXTURE_PASSWORD = 'UTRET-dedicated-fixture'
PUBLIC_FIXTURES = {'student1': 4, 'student2': 5, 'student3': 6}


def _login(client, login, password=FIXTURE_PASSWORD):
    response = client.post('/api/auth/login', json={'login': login, 'password': password})
    assert response.status_code == 200
    return response.json()


def test_existing_public_accounts_receive_complete_private_demo_data(tmp_path, monkeypatch):
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('DEMO_SEED', 'true')
    monkeypatch.setenv('DEMO_PASSWORD', 'New-default-for-fresh-fixtures')
    url = f'sqlite:///{(tmp_path / "campus.db").as_posix()}'
    engine = engine_for(url)
    initialize(engine, seed=False)
    password = hash_password(FIXTURE_PASSWORD)
    with engine.begin() as conn:
        conn.execute(users.insert(), [
            dict(id=1, login='student1-legacy', role='student', name='Прежний профиль', password=password),
            dict(id=2, login='student2-legacy', role='student', name='Прежний профиль', password=password),
            dict(id=3, login='staff', role='staff', name='Сотрудник', password=password),
            *[dict(id=user_id, login=login, role='student', name=login, password=password)
              for login, user_id in PUBLIC_FIXTURES.items()],
        ])
        conn.execute(profile_details.insert().values(
            user_id=4, full_name='Имя изменённого профиля', email='updated@example.org',
        ))
        conn.execute(grades.insert(), [
            dict(id=1, user_id=1, subject='Прежняя дисциплина', kind='Зачёт', result='Зачтено'),
            dict(id=10, user_id=4, subject='Микроэкономика', kind='Экзамен', result='Удовлетворительно'),
        ])

    demo = create_app(url)
    groups = set()
    with TestClient(demo) as client:
        for login, user_id in PUBLIC_FIXTURES.items():
            profile = _login(client, login)
            assert profile['id'] == user_id
            assert all(profile[field] for field in ('faculty', 'program', 'year', 'group'))
            groups.add(profile['group'])
            schedule = client.get('/api/schedule', params={'on': '2026-11-18', 'span': 'week'}).json()
            grade_rows = client.get('/api/grades').json()
            rating = client.get('/api/rating').json()
            subjects = {row['subject'] for row in grade_rows}
            assert len(grade_rows) == len(subjects) == 4
            assert any(row['exam_date'] for row in grade_rows)
            assert schedule['group'] == profile['group']
            assert {lesson['subject'] for lesson in schedule['lessons']} == subjects
            assert {row['subject'] for row in rating['courses']} == subjects
            assert client.get('/api/profile/details').json()['specialization']
            target = next(row for row in grade_rows if row['exam_date'])
            response = client.post('/api/requests', headers={'Idempotency-Key': str(uuid4())}, json={
                'scenario': 'retake', 'details': {'subject': target['subject'], 'comment': 'Допуск к пересдаче'},
            })
            assert response.status_code == 201
        assert len(groups) == 3

    with TestClient(create_app(url)) as restarted:
        assert _login(restarted, 'student1')['name'] == 'Имя изменённого профиля'
        details = restarted.get('/api/profile/details').json()
        assert details['email'] == 'updated@example.org'
        assert details['phone'] is None
        grade_rows = restarted.get('/api/grades').json()
        assert len(grade_rows) == 4
        assert next(row for row in grade_rows if row['subject'] == 'Микроэкономика')['result'] == 'Удовлетворительно'
        assert len(restarted.get('/api/requests').json()) == 1
        assert sum(notice['title'] == 'Открылся цифровой деканат'
                   for notice in restarted.get('/api/notifications').json()) == 1
        assert _login(restarted, 'student1-legacy')['id'] == 1
        assert [row['subject'] for row in restarted.get('/api/grades').json()] == ['Прежняя дисциплина']
        assert _login(restarted, 'staff')['role'] == 'staff'

    with engine.connect() as conn:
        assert conn.scalar(select(users.c.password).where(users.c.id == 4)) == password
    engine.dispose()


def test_fresh_demo_database_includes_the_third_student(tmp_path, monkeypatch):
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('DEMO_SEED', 'true')
    monkeypatch.setenv('DEMO_PASSWORD', FIXTURE_PASSWORD)
    url = f'sqlite:///{(tmp_path / "campus.db").as_posix()}'
    with TestClient(create_app(url)) as client:
        profile = _login(client, 'student3')
        assert profile['group']
        assert len(client.get('/api/grades').json()) == 4
        assert client.get('/api/rating').json()['earned'] == 258
