import json
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from fastapi.testclient import TestClient

from app import create_app
from campus import public_schedule
from campus.rag import import_document


@pytest.fixture(autouse=True)
def local_demo(monkeypatch):
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('DEMO_SEED', 'true')
    monkeypatch.setenv('DEMO_PASSWORD', 'Campus-demo-26')


def login(client, account):
    result = client.post('/api/auth/login', json={'login': account, 'password': 'Campus-demo-26'})
    assert result.status_code == 200, result.text
    assert 'httponly' in result.headers['set-cookie'].lower()
    return result.json()


def test_profile_details_use_only_current_session(tmp_path):
    app = create_app(f'sqlite:///{(tmp_path / "campus.db").as_posix()}')
    path = '/api/profile/details'
    with TestClient(app) as student, TestClient(app) as other:
        assert student.get(path).status_code == 401
        legacy_profile = login(student, 'student1')
        other_profile = login(other, 'student2')

        response = student.get(path, params={'user_id': other_profile['id']})
        assert response.status_code == 200
        first = response.json()
        assert first == {
            'full_name': 'Орлова Анна Сергеевна', 'email': 'anna.orlova@example.org',
            'phone': '+7 (000) 000-00-01', 'specialization': 'Финансы и кредит',
            'education_level': 'Бакалавриат', 'study_mode': 'Очная', 'study_basis': 'Бюджетная',
        }
        assert student.get('/api/profile').json() == legacy_profile

        response = other.get(path)
        assert response.status_code == 200
        assert response.json()['full_name'] == 'Светлов Михаил Андреевич'
        assert response.json()['email'] != first['email']

        login(other, 'staff')
        response = other.get(path)
        assert response.status_code == 200
        assert response.json()['full_name'] == 'Лебедева Елена Викторовна'
        for field in ('specialization', 'education_level', 'study_mode', 'study_basis'):
            assert response.json()[field] is None


def test_profile_details_backfill_preserves_existing_users_and_details(tmp_path, monkeypatch):
    url = f'sqlite:///{(tmp_path / "campus.db").as_posix()}'
    app = create_app(url)
    with TestClient(app) as client:
        profile = login(client, 'student1')
        token = client.cookies['campus_session']
        with app.state.engine.begin() as conn:
            conn.exec_driver_sql('DROP TABLE IF EXISTS profile_details')

    app = create_app(url)
    with TestClient(app) as client:
        client.cookies.set('campus_session', token)
        assert client.get('/api/profile').json() == profile
        response = client.get('/api/profile/details')
        assert response.status_code == 200
        assert response.json()['email'] == 'anna.orlova@example.org'
        with app.state.engine.begin() as conn:
            conn.exec_driver_sql(
                'UPDATE profile_details SET email = ?, full_name = NULL WHERE user_id = ?',
                ('updated@example.org', profile['id']),
            )

    with TestClient(create_app(url)) as client:
        client.cookies.set('campus_session', token)
        response = client.get('/api/profile/details')
        assert response.status_code == 200
        assert response.json()['full_name'] == profile['name']
        assert response.json()['email'] == 'updated@example.org'

    monkeypatch.setenv('DEMO_SEED', 'false')
    app = create_app(url)
    with TestClient(app) as client:
        client.cookies.set('campus_session', token)
        with app.state.engine.begin() as conn:
            conn.exec_driver_sql('DELETE FROM profile_details WHERE user_id = ?', (profile['id'],))
        response = client.get('/api/profile/details')
        assert response.status_code == 200
        assert response.json() == {
            'full_name': profile['name'], 'email': None, 'phone': None, 'specialization': None,
            'education_level': None, 'study_mode': None, 'study_basis': None,
        }


def test_request_round_trip_and_restart(tmp_path):
    url = f'sqlite:///{(tmp_path / "campus.db").as_posix()}'
    app = create_app(url)
    key = '8fe5c9f3-b80f-416f-bf20-7b54011fb5fe'
    data = {'scenario': 'certificate', 'details': {'certificate_type': 'study', 'comment': ''}}

    with TestClient(app) as student:
        assert student.get('/api/grades').status_code == 401
        first_profile = login(student, 'student1')
        first_grades = student.get('/api/grades').json()
        assert student.post('/api/requests', json=data).status_code == 422
        headers = {'Idempotency-Key': key}
        created = student.post('/api/requests', json=data, headers=headers)
        assert created.status_code == 201, created.text
        request_id = created.json()['id']
        path = f'/api/requests/{request_id}'
        assert student.post('/api/requests', json=data, headers=headers).json()['id'] == request_id
        other = {'scenario': 'certificate', 'details': {'certificate_type': 'scholarship'}}
        assert student.post('/api/requests', json=other, headers=headers).status_code == 409

        with TestClient(app) as stranger:
            assert login(stranger, 'student2')['id'] != first_profile['id']
            assert stranger.get('/api/grades').json() != first_grades
            for resource in (path, path + '/attachment'):
                assert stranger.get(resource).status_code == 404
            assert stranger.get('/api/requests').json() == []
            assert stranger.get(f'/api/profile/{first_profile["id"]}').status_code == 404

        with TestClient(app) as staff:
            login(staff, 'staff')
            assert student.post(path + '/staff', json={'status': 'review', 'version': 1}).status_code == 403
            assert staff.get('/api/requests').json()[0]['id'] == request_id
            assert staff.post(path + '/staff', json={'status': 'resolved', 'version': 1}).status_code == 409
            assert staff.post(path + '/staff', json={'status': 'review', 'version': 1}).status_code == 200
            assert staff.post(path + '/staff', json={'status': 'clarification', 'message': 'Уточните назначение', 'version': 1}).status_code == 409
            changed = staff.post(path + '/staff', json={'status': 'clarification', 'message': 'Уточните назначение', 'version': 2})
            assert changed.json()['status'] == 'clarification'
            assert any(n['request_id'] == request_id for n in student.get('/api/notifications').json())
            assert student.post(path + '/reply', json={'message': 'Для организации', 'version': 3}).json()['status'] == 'review'
            closed = staff.post(path + '/staff', json={'status': 'resolved', 'message': 'Справка готова', 'version': 4})
            assert closed.status_code == 200, closed.text
        token = student.cookies['campus_session']

    with TestClient(create_app(url)) as restarted:
        restarted.cookies.set('campus_session', token)
        detail = restarted.get(path).json()
        assert detail['status'] == 'resolved'
        assert [item['status'] for item in detail['history']] == ['submitted', 'review', 'clarification', 'review', 'resolved']
        assert restarted.post('/api/auth/logout').status_code == 204
        restarted.cookies.set('campus_session', token)
        assert restarted.get(path).status_code == 401


def test_mock_ai_and_fts(tmp_path, monkeypatch):
    monkeypatch.setenv('AI_MODE', 'mock')
    monkeypatch.delenv('OPENROUTER_API_KEY', raising=False)
    app = create_app(f'sqlite:///{(tmp_path / "campus.db").as_posix()}')
    with TestClient(app) as client:
        login(client, 'student1')
        first = client.post('/api/assistant/messages', json={'message': 'Как получить справку?'})
        second = client.post('/api/assistant/messages', json={'message': 'Где посмотреть расписание?'})
        assert first.json()['demo'] and first.json()['sources'] == []
        assert 'справк' in first.json()['message'].lower()
        assert first.json()['message'] != second.json()['message']
        with app.state.engine.begin() as conn:
            import_document(conn, 'Тестовый документ', 'https://rea.ru/sveden/document', 'Проверочный текст: справка об обучении.', {'test': True})
        reply = client.post('/api/assistant/messages', json={'message': 'справка об обучении'}).json()
        assert reply['sources'][0]['url'] == 'https://rea.ru/sveden/document'


def test_attachment_favorites_and_origin(tmp_path):
    app = create_app(f'sqlite:///{(tmp_path / "campus.db").as_posix()}')
    key = 'fea34501-6960-44ce-b4b4-3879224f8f91'
    file = b'%PDF-1.5\n% fictional'
    data = {'scenario': 'illness', 'details': {'start_date': '2026-11-18', 'end_date': '2026-11-18', 'missed_ids': ['demo-2026-11-18-0']}}
    with TestClient(app) as student:
        login(student, 'student1')
        assert student.post('/api/auth/logout', headers={'Origin': 'https://cross-site.invalid'}).status_code == 403
        result = student.post('/api/requests', data={'payload': json.dumps(data)}, files={'file': ('fiction.pdf', file, 'application/pdf')},
                              headers={'Idempotency-Key': key})
        assert result.status_code == 201, result.text
        created = result.json()
        assert created['details']['missed_lessons'][0]['id'] == 'demo-2026-11-18-0'
        path = '/api/requests/' + created['id'] + '/attachment'
        download = student.get(path)
        assert download.content == file
        assert download.headers['content-disposition'].startswith('attachment;')
        event_id = student.get('/api/events').json()[0]['id']
        assert student.put(f'/api/events/{event_id}/favorite').status_code == 204
        assert student.get('/api/events?saved=true').json()[0]['id'] == event_id
        with TestClient(app) as stranger:
            login(stranger, 'student2')
            assert stranger.get(path).status_code == 404
            assert stranger.get('/api/events?saved=true').json() == []
        assert student.delete(f'/api/events/{event_id}/favorite').status_code == 204
        assert student.get('/api/events?saved=true').json() == []


def test_simultaneous_case_retries_create_one_history_entry(tmp_path):
    app = create_app(f'sqlite:///{(tmp_path / "campus.db").as_posix()}')
    with TestClient(app) as client:
        login(client, 'student1')
        data = {'scenario': 'other', 'details': {'category': 'campus', 'comment': 'Где находится корпус?'}}
        headers = {'Idempotency-Key': '689b0f97-b8d5-4720-aa69-97dfb0bcc21f'}
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: client.post('/api/requests', json=data, headers=headers), range(8)))
        assert all(result.status_code == 201 for result in results)
        assert len({result.json()['id'] for result in results}) == 1
        assert all(len(result.json()['history']) == 1 for result in results)


def test_public_schedule_parsing_and_unavailable_state(tmp_path, monkeypatch):
    html = """
      <input id="weekNum" type="hidden" value="12">
      <table><tr><th class="dayh">Среда, 18.11.2026</th></tr>
      <tr class="slot"><td>10:40<br>12:10</td><td>
        <a class="task" data-elementid="123">Статистика<br><i>Семинар</i><br>3 корпус - 416</a>
        <span class="schedule-change">Занятие перенесено</span>
      </td></tr></table>
    """

    def public_response(path, **_params):
        if path.endswith('SearchBarSuggestions'):
            return httpx.Response(200, json=[{'key': 'group_123', 'name': 'Группа 123'}])
        return httpx.Response(200, text=html)

    monkeypatch.setattr(public_schedule, 'public_get', public_response)
    app = create_app(f'sqlite:///{(tmp_path / "campus.db").as_posix()}')
    with TestClient(app) as client:
        login(client, 'student1')
        group = client.get('/api/schedule/public/groups?query=123').json()[0]
        schedule = client.get('/api/schedule/public', params={'key': group['key']}).json()
        assert schedule['source'] == 'rea'
        assert schedule['start'] == '2026-11-16'
        assert schedule['lessons'][0]['room'] == '3 корпус - 416'
        assert schedule['lessons'][0]['change'] == 'Занятие перенесено'

        def blocked(*_args, **_kwargs):
            raise public_schedule.ScheduleUnavailable
        monkeypatch.setattr(public_schedule, 'public_get', blocked)
        assert client.get('/api/schedule/public/groups?query=123').status_code == 503
        assert client.get('/api/schedule').json()['source'] == 'demo'
