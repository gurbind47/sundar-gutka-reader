# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **static, client-side PWA** (Sundar Gutka PDF reader). There is no
package manager, build step, transpilation, lint config, or test suite — the app is
just HTML/CSS/JS served as static files, with `pdf.js` vendored in `lib/`.

### Services

There is a single "service": a static file server for the repo root.

- Run it (matches the README) with:
  `python3 -m http.server 8765 --bind 127.0.0.1`
  then open `http://127.0.0.1:8765/`.
- The repo also ships `scripts/start-server.sh` / `scripts/stop-server.sh`, but those
  are **macOS-only** (they call `/usr/bin/open` and `/opt/homebrew/bin` paths) and will
  not work as-is on the Linux cloud VM. Prefer running `python3 -m http.server` directly.

### Gotchas

- The app **must be served over HTTP**, not opened via `file://` — `pdf.js` fetches
  `assets/sundar-gutka.pdf` and registers a service worker (`sw.js`), both of which need
  an `http(s)` origin.
- `sw.js` aggressively caches assets (cache-first). After editing JS/CSS/PDF, do a hard
  reload or bump the `CACHE` version constant in `sw.js` to avoid serving stale files.
- There is no lint/test/build. "Verifying" a change means loading the page and exercising
  the reader (PDF render, Banis jump menu, play/pause auto-scroll, zoom, theme toggle).

### Dependencies

No install step is required beyond having Python 3 available (used only to serve static
files). All runtime JS dependencies (`pdf.js`) are committed in `lib/`.
