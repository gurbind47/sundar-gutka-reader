# Sundar Gutka Reader

Sundar Gutka (Damdami Taksal) path reader for **laptop, tablet, and phone**.

- Three **reading modes** (Mode button / `M`):
  - **Scroll** — continuous pages with auto-scroll
  - **Book** — one page fills the screen; **swipe left / right** (or drag with the mouse) to turn the page
  - **Kindle** — one page fills the screen; **tap the top** for the previous page, **tap the bottom** for the next, tap the middle for controls
- **Full screen** (`F`) on phone, tablet, and desktop; on iPhone Safari use Add to Home Screen for a true full screen
- **Hide controls** (`H`) for a clean page — tap the page once (Kindle: the middle) to bring the controls back, with a short on-screen instruction
- Auto-scroll speed **1–5** (pace scales with page size so speed 3 feels similar on phone and desktop; range matches the former very-slow 1–2 band with finer steps). In Book / Kindle, Play turns pages automatically at the same pace
- **Text size** − / + (70%–200% in Scroll mode; on phone, pinch or Size enlarges pages — pan inside the screen to read; no edge crop). Book / Kindle always fit the whole page to the screen. The pages are landscape scans, so on a phone held upright they are width-limited — turn the phone sideways (and Hide the controls) for the largest text
- **Day / Night / Auto** theme (Auto follows system)
- **Banis** jump menu (26 banis)
- Compact **mobile toolbar** (Play / Banis / Speed / Mode; More for Size, Theme, Page, Full, Hide)
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
| **Play / Pause** | Auto-scroll in Scroll mode; auto page-turn in Book / Kindle (Space) |
| **Speed 1–5** | 1 = slowest path, 5 = fastest within the slow band (also sets the auto page-turn pace) |
| **Banis** | Jump to Japji, Rehras, Sukhmani… (`B`) |
| **Mode** | Scroll → Book → Kindle (`M`) |
| **More** (phone) | Size, Theme, Page jump, Full, Hide |
| **Size − / +** | Smaller / larger in Scroll mode (`-` / `+` keys; pinch on phone). Locked to "Fit" in Book / Kindle |
| **Auto / Day / Night** | Theme (`T`) |
| **Page + Go** | Jump to page number |
| **Full** | Full screen on / off (`F`; `Esc` exits) |
| **Hide** | Hide the toolbar (`H`). Tap the page once to show it again; `Esc` also restores it |

### Gestures and keys in Book / Kindle

| Input | Action |
|-------|--------|
| Swipe or drag left / right (Book) | Next / previous page |
| Tap top third / bottom third (Kindle) | Previous / next page |
| Tap middle third (Kindle), tap anywhere (Book) | Show / hide controls |
| `←` `→`, `PageUp` `PageDown`, mouse wheel | Previous / next page |
| `↑` `↓` | Speed up / down |

A short instruction appears whenever you change mode or hide / show the controls.

## Speed guide

Levels **1–5** stay within the former very-slow (old 1–2) pace, with finer steps:

| Level | Feel |
|-------|------|
| 1 | Slowest path |
| 2–3 | Comfortable default |
| 4–5 | Slightly faster within the slow band |

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

## Stack

- PDF.js **6.x** (ES modules, `lib/pdf.min.mjs`)
- Vanilla JS reader (`js/app.js`)
- Service worker: network-first app shell, cache-first PDF / libs

## Source

https://github.com/gurbind47/sundar-gutka-reader

Code is MIT — see `LICENSE`. The PDF content remains with its rights holders.
