#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
PORT="${SUNDAR_GUTKA_PORT:-8765}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$ROOT/.server.pid"

if [[ -f "$PIDFILE" ]]; then
  PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "${PID}" ]]; then
    kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
fi

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${PIDS}" ]]; then
    # shellcheck disable=SC2086
    kill $PIDS 2>/dev/null || true
  fi
fi
echo "Stopped."
