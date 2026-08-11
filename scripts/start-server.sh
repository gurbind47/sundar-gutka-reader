#!/bin/bash
# Start local server + open browser. No osascript here (nested Apple Events hang the .app).
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PORT="${SUNDAR_GUTKA_PORT:-8765}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.server.log"
PIDFILE="$ROOT/.server.pid"
URL="http://127.0.0.1:${PORT}/"

if [[ -x /usr/bin/python3 ]]; then
  PY=/usr/bin/python3
elif command -v python3 >/dev/null 2>&1; then
  PY="$(command -v python3)"
else
  echo "ERROR: Python 3 not found" >&2
  exit 1
fi

# Kill old server on this port, start new one in its own session
"$PY" - <<'PY' "$PORT" "$ROOT" "$PY"
import os, signal, subprocess, sys, time, urllib.request

port = int(sys.argv[1])
root = sys.argv[2]
py = sys.argv[3]
log = os.path.join(root, ".server.log")
pidfile = os.path.join(root, ".server.pid")
url = f"http://127.0.0.1:{port}/"

try:
    out = subprocess.check_output(["lsof", f"-tiTCP:{port}", "-sTCP:LISTEN"], text=True).strip()
    for pid in out.split():
        try:
            os.kill(int(pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(0.25)
except Exception:
    pass

with open(log, "ab", buffering=0) as logf:
    proc = subprocess.Popen(
        [py, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=root,
        stdout=logf,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
with open(pidfile, "w") as f:
    f.write(str(proc.pid))

# Wait until ready
for _ in range(40):
    try:
        urllib.request.urlopen(url, timeout=0.3)
        print("READY", proc.pid)
        sys.exit(0)
    except Exception:
        time.sleep(0.15)

print("ERROR: server did not start", file=sys.stderr)
sys.exit(1)
PY

# Open browser (never use osascript from this script)
/usr/bin/open "$URL"
exit 0
