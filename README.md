# Sundar Gutka Reader

Sundar Gutka (Damdami Taksal) path reader for **laptop, tablet, and phone**.

- Auto-scroll speed **1–10** (pace scales with page size so speed 3 feels similar on phone and desktop)
- **Text size** − / + (70%–200%)
- **Day / Night / Auto** theme (Auto follows system)
- **Banis** jump menu (26 banis)
- **Search** across all pages (Unicode Gurmukhi text index)
- **Text mode** — reflowable Gurmukhi for comfortable phone reading
- **Rotate** — turn PDF pages tall for portrait phones
- Deep links: `?page=124` or `?bani=rehras`
- **Offline install** (Add to Home Screen / PWA)
- **Desktop app** — double-click to open (Mac)

Live site: **https://gurbind47.github.io/sundar-gutka-reader/**

## Open on Mac (desktop)

**Option A — App icon (recommended)**  
Double-click **`Sundar Gutka`** on your Desktop.  
Browser should open within 1–2 seconds (no stuck “Opening…” dialog).

**First time only (if macOS blocks it):**  
Right-click the app → **Open** → **Open**.

**Option B — Terminal launcher**  
Double-click **`Sundar Gutka.command`** (window closes after launch).

Browser opens at `http://127.0.0.1:8765/`.

**Option C — always works in browser**  
https://gurbind47.github.io/sundar-gutka-reader/

Stop the server later:

```bash
~/Desktop/sundar-gutka-reader/scripts/stop-server.sh
```

Keep the folder **`Desktop/sundar-gutka-reader`** on your Desktop (the app needs it).

> Note: the Mac `.app` / `.command` launchers are not regenerated from this repo alone — they wrap `scripts/start-server.sh`. For a fresh clone, run that script or use the live site / PWA.

## Install on phone (offline)

1. Open the live link on your phone  
2. **iPhone Safari:** Share → **Add to Home Screen**  
3. **Android Chrome:** Menu → **Install app**  
4. After first load, works offline  

## Controls

| Control | Action |
|--------|--------|
| **Play / Pause** | Auto-scroll (Space) |
| **Speed 1–10** | 1 = very slow path, 10 = faster |
| **Size − / +** | Smaller / larger text (`-` / `+` keys) |
| **Banis** | Jump to Japji, Rehras, Sukhmani… (`B`) |
| **Search** | Find text across the gutka (`F`) |
| **PDF / Text** | Page scan view or reflow text (`M`) |
| **Rotate** | Tall PDF pages for portrait phones (`R`) |
| **Auto / Day / Night** | Theme — Auto follows system (`T`) |
| **Page + Go** | Jump to page number |

## Speed guide

| Level | Feel |
|-------|------|
| 1–2 | Very slow path |
| 3–4 | Comfortable default |
| 5–7 | Medium |
| 8–10 | Quick review |

## Deep links

- `?page=212` — open Sukhmani Sahib (page 212)
- `?bani=rehras` — open Rehras Sahib
- Slugs: `japji`, `jaap`, `chaupai`, `anand`, `rehras`, `ardas`, `sohila`, `sukhmani`, …

## Local development

Serve the repo root over HTTP (PDF.js cannot load `file://`):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

Or use `scripts/start-server.sh` / `scripts/stop-server.sh`.

### Rebuild the text index

The search / text-mode corpus is `data/text-index.json` (AnmolLipi → Unicode via [anvaad-js](https://github.com/KhalisFoundation/anvaad-js)).

```bash
pip install pymupdf
npm i anvaad-js
node scripts/extract-text.mjs
```

## Stack

- PDF.js **6.x** (ES modules, `lib/pdf.min.mjs`)
- Vanilla JS reader (`js/app.js`)
- Service worker: network-first app shell, cache-first PDF / libs / text index

## Source

https://github.com/gurbind47/sundar-gutka-reader

Code is MIT — see `LICENSE`. The PDF content remains with its rights holders.
