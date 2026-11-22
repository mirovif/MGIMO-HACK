import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import (
    JSON, CheckConstraint, Column, Date, ForeignKey, Index, Integer, LargeBinary, MetaData, String,
    Table, Text, UniqueConstraint, create_engine, event, func, text,
)
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.pool import NullPool

meta = MetaData()
users = Table(
    'users', meta, Column('id', Integer, primary_key=True),
    Column('login', String(64), nullable=False, unique=True), Column('password', Text, nullable=False),
    Column('role', String(12), nullable=False), Column('name', String(120), nullable=False),
    Column('faculty', String(120)), Column('program', String(120)), Column('year', Integer), Column('group', String(64)),
)
profile_details = Table(
    'profile_details', meta,
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('full_name', String(160)), Column('email', String(254)), Column('phone', String(32)),
    Column('specialization', String(160)), Column('education_level', String(120)),
    Column('study_mode', String(64)), Column('study_basis', String(64)),
)
profile_full_name = func.coalesce(func.nullif(func.trim(profile_details.c.full_name), ''), users.c.name)
profile_names = Table(
    'profile_names', meta,
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('display_name', String(40), nullable=False),
)
sessions = Table(
    'sessions', meta, Column('token', String(64), primary_key=True),
    Column('user_id', ForeignKey('users.id'), nullable=False), Column('expires_at', Integer, nullable=False, index=True),
)
requests = Table(
    'requests', meta, Column('id', String(36), primary_key=True),
    Column('user_id', ForeignKey('users.id'), nullable=False, index=True),
    Column('idempotency_key', String(36), nullable=False), Column('fingerprint', String(64), nullable=False),
    Column('scenario', String(24), nullable=False), Column('details', JSON, nullable=False),
    Column('status', String(24), nullable=False), Column('version', Integer, nullable=False),
    Column('created_at', String(32), nullable=False), Column('updated_at', String(32), nullable=False),
    UniqueConstraint('user_id', 'idempotency_key'),
)
history = Table(
    'request_history', meta, Column('id', Integer, primary_key=True),
    Column('request_id', ForeignKey('requests.id'), nullable=False, index=True),
    Column('actor_id', ForeignKey('users.id'), nullable=False), Column('status', String(24), nullable=False),
    Column('action', String(24), nullable=False), Column('message', Text), Column('created_at', String(32), nullable=False),
)
attachments = Table(
    'attachments', meta, Column('request_id', ForeignKey('requests.id'), primary_key=True),
    Column('name', String(180), nullable=False), Column('content_type', String(64), nullable=False),
    Column('content', LargeBinary, nullable=False),
)
notifications = Table(
    'notifications', meta, Column('id', Integer, primary_key=True),
    Column('user_id', ForeignKey('users.id'), nullable=False), Column('request_id', ForeignKey('requests.id')),
    Column('kind', String(24), nullable=False), Column('title', String(160), nullable=False),
    Column('message', Text, nullable=False), Column('created_at', String(32), nullable=False),
    Column('read_at', String(32)), Column('event_key', String(160)),
    UniqueConstraint('user_id', 'event_key'),
)
Index('notifications_user_order', notifications.c.user_id, notifications.c.id)
grades = Table(
    'grades', meta, Column('id', Integer, primary_key=True),
    Column('user_id', ForeignKey('users.id'), nullable=False, index=True),
    Column('subject', String(120), nullable=False), Column('kind', String(32), nullable=False),
    Column('result', String(24)), Column('exam_date', Date),
)
ratings = Table(
    'ratings', meta,
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('subject', String(120), primary_key=True),
    Column('earned', Integer, nullable=False),
    Column('maximum', Integer, nullable=False),
    CheckConstraint('maximum > 0 AND earned >= 0 AND earned <= maximum', name='ratings_valid_points'),
)
events = Table(
    'events', meta, Column('id', Integer, primary_key=True), Column('category', String(32), nullable=False),
    Column('title', String(120), nullable=False), Column('description', Text, nullable=False),
    Column('location', String(120), nullable=False), Column('date', Date, nullable=False),
    Column('start', String(5), nullable=False), Column('end', String(5), nullable=False),
)
favorites = Table(
    'favorites', meta, Column('user_id', ForeignKey('users.id'), primary_key=True),
    Column('event_id', ForeignKey('events.id'), primary_key=True),
)
documents = Table(
    'documents', meta, Column('id', Integer, primary_key=True),
    Column('title', String(240), nullable=False), Column('url', String(1000), nullable=False, unique=True),
    Column('metadata', JSON, nullable=False), Column('imported_at', String(32), nullable=False),
)
chunks = Table(
    'document_chunks', meta, Column('id', Integer, primary_key=True),
    Column('document_id', ForeignKey('documents.id'), nullable=False, index=True),
    Column('position', Integer, nullable=False), Column('body', Text, nullable=False),
)


def now():
    return datetime.now(UTC).isoformat(timespec='milliseconds')


def engine_for(url=None):
    production = bool(os.getenv('VERCEL')) or os.getenv('APP_ENV') == 'production'
    url = url or os.getenv('DATABASE_URL') or ''
    if url.startswith(('postgres://', 'postgresql://')):
        url = 'postgresql+psycopg://' + url.split('://', 1)[1]
    if url.startswith('postgresql+psycopg://'):
        return create_engine(url, poolclass=NullPool, hide_parameters=True,
                             connect_args={'connect_timeout': 8, 'prepare_threshold': None})
    sqlite_path = Path(os.getenv('CAMPUS_SQLITE_PATH', ''))
    if production and (os.getenv('VERCEL') or url or not sqlite_path.is_absolute()):
        raise RuntimeError('В production требуется PostgreSQL DATABASE_URL или абсолютный CAMPUS_SQLITE_PATH вне Vercel.')
    if url and not url.startswith('sqlite:///'):
        raise RuntimeError('Поддерживаются SQLite и PostgreSQL с psycopg.')
    if not url:
        local = sqlite_path if sqlite_path.is_absolute() else Path(__file__).resolve().parents[1] / 'campus.sqlite3'
        url = f'sqlite:///{local.as_posix()}'
    engine = create_engine(url, hide_parameters=True, connect_args={'timeout': 10})

    @event.listens_for(engine, 'connect')
    def sqlite_options(connection, _record):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA busy_timeout=10000')

    return engine


def insert_once(conn, table, values, keys, *, returning=None):
    statement = postgres_insert(table) if conn.dialect.name == 'postgresql' else sqlite_insert(table)
    statement = statement.values(values).on_conflict_do_nothing(index_elements=keys)
    if returning is not None:
        return conn.scalar(statement.returning(returning))
    conn.execute(statement)


def initialize(engine, seed=False):
    from .demo import seed_demo
    from .rag import seed_university_documents

    with engine.begin() as conn:
        if conn.dialect.name == 'postgresql':
            conn.execute(text('SELECT pg_advisory_xact_lock(73195821)'))
        if conn.dialect.name == 'sqlite':
            conn.exec_driver_sql('BEGIN IMMEDIATE')
        meta.create_all(conn)
        if conn.dialect.name == 'sqlite':
            conn.exec_driver_sql('CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(body)')
        seed_university_documents(conn)
        if seed:
            seed_demo(conn)

