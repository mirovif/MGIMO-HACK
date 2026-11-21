FROM node:24-bookworm-slim AS frontend-build

WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/
COPY campus-os-design-exploration/ ./campus-os-design-exploration/
RUN UTRET_STANDALONE=1 npm run build --prefix frontend \
    && cp -a frontend/public frontend/.next/standalone/frontend/public \
    && cp -a frontend/.next/static frontend/.next/standalone/frontend/.next/static

FROM python:3.12-slim-bookworm

WORKDIR /app
ENV APP_ENV=production \
    CAMPUS_SQLITE_PATH=/data/campus.sqlite3 \
    DEMO_SEED=true \
    AI_MODE=polza \
    LLM_MODEL=deepseek/deepseek-v4.1-flash-1017 \
    NEXT_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt "pypdf>=6,<7"
COPY backend/ ./backend/
COPY --from=frontend-build /build/frontend/.next/standalone/ ./web/
COPY amvera/start.sh ./amvera/start.sh

EXPOSE 3000
CMD ["/bin/bash", "/app/amvera/start.sh"]
