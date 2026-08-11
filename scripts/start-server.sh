#!/bin/bash
# Starts Sundar Gutka reader and opens the browser.
# Used by the Desktop app icon.

set -euo pipefail

PORT="${SUNDAR_GUTKA_PORT:-8765}"
# Resolve project root (parent of scripts/)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Free the port if a previous instance is still running
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${OLD_PIDS}" ]]; then
    # shellcheck disable=SC2086
    kill $OLD_PIDS 2>/dev/null || true
    sleep 0.3
  fi
fi

# Prefer python3
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  osascript -e 'display alert "Sundar Gutka" message "Python 3 is required. Install it from python.org or with Homebrew." as critical' 2>/dev/null || true
  exit 1
fi

URL="http://127.0.0.1:${PORT}/"
LOG="$ROOT/.server.log"
PIDFILE="$ROOT/.server.pid"

# Start server in background, log to file
nohup "$PY" -m http.server "$PORT" --bind 127.0.0.1 >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

# Wait until port accepts connections (max ~5s)
for _ in $(seq 1 25); do
  if curl -sf -o /dev/null "$URL"; then
    break
  fi
  sleep 0.2
done

# Open default browser
open "$URL"

exit 0
