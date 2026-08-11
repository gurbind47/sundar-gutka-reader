#!/bin/bash
# Stops the Sundar Gutka local server started by the Desktop app.

set -euo pipefail

PORT="${SUNDAR_GUTKA_PORT:-8765}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$ROOT/.server.pid"

if [[ -f "$PIDFILE" ]]; then
  PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "${PID}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
fi

if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${OLD_PIDS}" ]]; then
    # shellcheck disable=SC2086
    kill $OLD_PIDS 2>/dev/null || true
  fi
fi

echo "Sundar Gutka server stopped."
