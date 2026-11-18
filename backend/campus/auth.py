import hashlib
import hmac
import os
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from .db import profile_details, sessions, users

router = APIRouter(prefix='/api')
COOKIE = 'campus_session'
SESSION_SECONDS = 8 * 60 * 60


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'{salt}:{digest}'


DUMMY_PASSWORD = hash_password('dummy', '00' * 16)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def profile(row):
    return {field: row[field] for field in ('id', 'login', 'role', 'name', 'faculty', 'program', 'year', 'group')}


def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token or len(token) != 43:
        raise HTTPException(401, 'Войдите в личный кабинет.')
    with request.app.state.engine.connect() as conn:
        row = conn.execute(select(users).join(sessions).where(
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


@router.post('/auth/login')
def login(data: Credentials, request: Request, response: Response):
    engine = request.app.state.engine
    with engine.connect() as conn:
        user = conn.execute(select(users).where(users.c.login == data.login.strip().casefold())).mappings().first()
    stored = user['password'] if user else DUMMY_PASSWORD
    if not hmac.compare_digest(hash_password(data.password, stored.split(':', 1)[0]), stored) or not user:
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


@router.get('/profile/details')
def read_profile_details(request: Request, user=Depends(current_user)) -> ProfileDetails:
    query = select(profile_details).where(profile_details.c.user_id == user['id'])
    with request.app.state.engine.connect() as conn:
        row = conn.execute(query).mappings().first()
    details = ProfileDetails(**row) if row is not None else ProfileDetails()
    details.full_name = (details.full_name or '').strip() or user['name']
    return details
