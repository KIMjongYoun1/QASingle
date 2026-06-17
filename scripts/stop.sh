#!/bin/bash
# QA-Server 전체 종료 스크립트 (backend + frontend)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

stop_proc() {
  local name="$1"
  local pid_file="$2"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "[$name] 종료됨 (PID $pid)"
    else
      echo "[$name] 이미 종료된 상태"
    fi
    rm -f "$pid_file"
  else
    echo "[$name] 실행 중이 아님 (PID 파일 없음)"
  fi
}

stop_proc "backend" "$RUN_DIR/backend.pid"
stop_proc "frontend" "$RUN_DIR/frontend.pid"

echo ""
echo "QA-Server 종료 완료"
