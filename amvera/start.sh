#!/bin/bash
set -euo pipefail

python -m uvicorn app:app --app-dir /app/backend --host 127.0.0.1 --port 8000 &
api_pid=$!
HOSTNAME=0.0.0.0 PORT=3000 node /app/web/frontend/server.js &
web_pid=$!

stop() {
  kill -TERM "$api_pid" "$web_pid" 2>/dev/null || true
  wait "$api_pid" "$web_pid" 2>/dev/null || true
}

trap stop EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
wait -n "$api_pid" "$web_pid"
