#!/bin/bash
# QA-Server 전체 구동 스크립트 (backend + frontend)
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"

is_running() {
  local pid_file="$1"
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

# Backend
if is_running "$BACKEND_PID_FILE"; then
  echo "[backend] 이미 실행 중 (PID $(cat "$BACKEND_PID_FILE"))"
else
  echo "[backend] 시작 중... (http://localhost:8001)"
  cd "$ROOT_DIR/backend"
  source venv/bin/activate
  nohup uvicorn main:app --host 0.0.0.0 --port 8001 > "$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  deactivate
  echo "[backend] 시작됨 (PID $(cat "$BACKEND_PID_FILE")), 로그: $BACKEND_LOG"
fi

# Frontend
if is_running "$FRONTEND_PID_FILE"; then
  echo "[frontend] 이미 실행 중 (PID $(cat "$FRONTEND_PID_FILE"))"
else
  echo "[frontend] 시작 중... (http://localhost:5174)"
  cd "$ROOT_DIR/frontend"
  nohup ./node_modules/.bin/vite > "$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
  echo "[frontend] 시작됨 (PID $(cat "$FRONTEND_PID_FILE")), 로그: $FRONTEND_LOG"
fi

echo ""
echo "QA-Server 구동 완료"
echo "  - Backend:  http://localhost:8001"
echo "  - Frontend: http://localhost:5174 (Vite가 포트를 자동 변경할 수 있으니 로그 확인: $FRONTEND_LOG)"
echo "  - 종료: scripts/stop.sh"
