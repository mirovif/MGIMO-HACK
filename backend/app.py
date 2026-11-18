import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from campus import assistant, auth, cases, public_schedule, student
from campus.db import engine_for, initialize

load_dotenv(Path(__file__).resolve().parent.parent / '.env')


def create_app(database_url=None):
    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(ready, app)
        yield

    app = FastAPI(title='Campus OS', lifespan=lifespan, docs_url='/api/docs', openapi_url='/api/openapi.json', redoc_url=None)
    for module in (auth, cases, student, public_schedule, assistant):
        app.include_router(module.router)

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_request, _error):
        return JSONResponse({'detail': 'Проверьте обязательные поля и формат данных.'}, status_code=422)

    @app.middleware('http')
    async def same_origin(request: Request, call_next):
        if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            origin = request.headers.get('origin')
            configured = os.getenv('PUBLIC_ORIGIN', '').rstrip('/')
            expected = {request.url.netloc.casefold(), request.headers.get('x-forwarded-host', '').casefold()}
            if request.headers.get('sec-fetch-site') == 'cross-site' or (
                origin and (origin.rstrip('/') != configured if configured else urlsplit(origin).netloc.casefold() not in expected)
            ):
                return JSONResponse({'detail': 'Запрос с другого сайта отклонён.'}, status_code=403)
        if not hasattr(app.state, 'engine'):
            await run_in_threadpool(ready, app)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'private, no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    from threading import Lock
    lock = Lock()

    def ready(target):
        with lock:
            if hasattr(target.state, 'engine'):
                return
            engine = engine_for(database_url)
            production = bool(os.getenv('VERCEL')) or os.getenv('APP_ENV') == 'production'
            seed = os.getenv('DEMO_SEED', 'false' if production else 'true').lower() == 'true'
            if seed and production and len(os.getenv('DEMO_PASSWORD', '')) < 12:
                engine.dispose()
                raise RuntimeError('Для тестовых аккаунтов production задайте DEMO_PASSWORD длиной не менее 12 символов.')
            try:
                initialize(engine, seed)
            except Exception:
                engine.dispose()
                raise
            target.state.engine = engine

    @app.get('/api/health')
    def health():
        return {'status': 'ok'}

    return app


app = create_app()
