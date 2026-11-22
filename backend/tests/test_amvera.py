from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import create_app
from campus.db import engine_for


def test_mounted_sqlite_keeps_secure_sessions_and_cases_across_restarts(tmp_path, monkeypatch):
    database = tmp_path / 'campus.sqlite3'
    password = 'local-amvera-test-only'
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('CAMPUS_SQLITE_PATH', str(database))
    monkeypatch.setenv('DEMO_SEED', 'true')
    monkeypatch.setenv('DEMO_PASSWORD', password)
    monkeypatch.setenv('PUBLIC_ORIGIN', 'https://utret.example.org')

    def login(client, account):
        reply = client.post('/api/auth/login', json={'login': account, 'password': password})
        assert reply.status_code == 200
        assert 'secure' in reply.headers['set-cookie'].lower()

    with TestClient(create_app(), base_url='https://utret.example.org') as student:
        login(student, 'student1')
        reply = student.post('/api/requests', json={
            'scenario': 'other', 'details': {'category': 'study', 'comment': 'Тест Amvera'},
        }, headers={'Origin': 'https://utret.example.org', 'Idempotency-Key': str(uuid4())})
        assert reply.status_code == 201
        request_id = reply.json()['id']
    assert database.is_file()

    with TestClient(create_app(), base_url='https://utret.example.org') as student:
        login(student, 'student1')
        assert student.get('/api/requests/' + request_id).status_code == 200
        login(student, 'student2')
        assert student.get('/api/requests/' + request_id).status_code == 404


def test_vercel_still_requires_postgresql_with_a_mounted_sqlite_path(tmp_path, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.setenv('CAMPUS_SQLITE_PATH', str(tmp_path / 'campus.sqlite3'))
    with pytest.raises(RuntimeError, match='PostgreSQL'):
        engine_for()
