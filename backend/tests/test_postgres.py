import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import create_app
from campus.rag import import_document


@pytest.mark.skipif(not os.getenv('CAMPUS_TEST_POSTGRES'), reason='Requires a dedicated PostgreSQL test database')
def test_production_database(monkeypatch):
    password = 'Campus-postgres-test-fixture-26'
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('DEMO_SEED', 'true')
    monkeypatch.setenv('DEMO_PASSWORD', password)
    monkeypatch.setenv('AI_MODE', 'mock')
    app = create_app(os.environ['CAMPUS_TEST_POSTGRES'])

    def login(client, account):
        result = client.post('/api/auth/login', json={'login': account, 'password': password})
        assert result.status_code == 200, result.text
        assert 'secure' in result.headers['set-cookie'].lower()

    with TestClient(app, base_url='https://campus.test') as student:
        login(student, 'student1')
        assert student.get('/api/notifications').status_code == 200
        data = {'scenario': 'other', 'details': {'category': 'study', 'comment': 'Проверка PostgreSQL'}}
        headers = {'Idempotency-Key': str(uuid4())}
        created = student.post('/api/requests', json=data, headers=headers)
        assert created.status_code == 201, created.text
        case_id = created.json()['id']
        assert student.post('/api/requests', json=data, headers=headers).json()['id'] == case_id

        with app.state.engine.begin() as conn:
            import_document(conn, 'Тестовый документ', 'https://rea.ru/sveden/document',
                            'Справка об обучении запрашивается отдельно.', {'test': True})
        reply = student.post('/api/assistant/messages', json={'message': 'Справка об обучении'}).json()
        assert reply['demo'] and reply['sources']

        path = '/api/requests/' + case_id
        with TestClient(app, base_url='https://campus.test') as staff:
            login(staff, 'staff')
            assert staff.post(path + '/staff', json={'status': 'review', 'version': 1}).status_code == 200
            assert staff.post(path + '/staff', json={'status': 'resolved', 'version': 2}).status_code == 200
        assert student.get(path).json()['status'] == 'resolved'
