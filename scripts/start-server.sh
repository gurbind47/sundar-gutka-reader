#!/bin/bash
# Starts Sundar Gutka reader and opens the browser.
# Works from Finder / AppleScript app (survives do-shell-script exit).

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PORT="${SUNDAR_GUTKA_PORT:-8765}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

LOG="$ROOT/.server.log"
PIDFILE="$ROOT/.server.pid"
URL="http://127.0.0.1:${PORT}/"

# Find Python
if [[ -x /usr/bin/python3 ]]; then
  PY=/usr/bin/python3
elif command -v python3 >/dev/null 2>&1; then
  PY="$(command -v python3)"
else
  /usr/bin/osascript -e 'display alert "Sundar Gutka" message "Python 3 is required. Install from python.org or run: brew install python" as critical' 2>/dev/null || true
  exit 1
fi

# Stop previous instance on this port (new process group safe)
"$PY" - <<PY
import os, signal, subprocess, sys
port = int("${PORT}")
root = r"""${ROOT}"""
log = os.path.join(root, ".server.log")
pidfile = os.path.join(root, ".server.pid")

# Kill anything listening on the port
try:
    out = subprocess.check_output(["lsof", f"-tiTCP:{port}", "-sTCP:LISTEN"], text=True).strip()
    for pid in out.split():
        try:
            os.kill(int(pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
except Exception:
    pass

# Start server in a NEW SESSION so it survives when AppleScript's shell exits
with open(log, "ab", buffering=0) as logf:
    proc = subprocess.Popen(
        [r"""${PY}""", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=root,
        stdout=logf,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
with open(pidfile, "w") as f:
    f.write(str(proc.pid))
print(proc.pid)
PY

# Wait until ready (max ~6s)
READY=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if "$PY" -c "import urllib.request; urllib.request.urlopen('${URL}', timeout=0.4)" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.2
done

if [[ "$READY" -ne 1 ]]; then
  /usr/bin/osascript -e 'display alert "Sundar Gutka" message "Server failed to start. Check .server.log in the sundar-gutka-reader folder." as critical' 2>/dev/null || true
  exit 1
fi

# Open browser
/usr/bin/open "$URL" || true

# Non-blocking notification (best effort)
/usr/bin/osascript -e 'display notification "Sundar Gutka is open in your browser." with title "Sundar Gutka"' 2>/dev/null || true

exit 0
