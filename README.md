# Sundar Gutka Reader

Responsive **Sundar Gutka (Damdami Taksal Complete)** path reader with:

- Auto-scroll speed **1–10** (slow path-friendly)
- **Banis** jump menu (all 26 banis)
- Works on **laptop, tablet, phone**
- **Offline install** (PWA — Add to Home Screen)
- **Desktop app icon** (double-click to open)

## Desktop app (easiest)

1. On your Mac Desktop, double-click **`Sundar Gutka`**
2. Your browser opens the reader automatically  
3. Press **Play**, set speed **1–3** for path

To stop the background server later:

```bash
~/Desktop/sundar-gutka-reader/scripts/stop-server.sh
```

## Manual local server

```bash
cd ~/Desktop/sundar-gutka-reader
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/
```

## Controls

| Control | Action |
|--------|--------|
| **Play / Pause** | Auto-scroll on/off (Space) |
| **Speed 1–10** | 1 = very slow path, 10 = faster review |
| **Banis** | Jump to Japji, Rehras, Sukhmani, etc. (key `B`) |
| **Page + Go** | Jump to page number |
| **← / →** | Change speed |

Last page and speed are saved in the browser.

## Phone / tablet — install offline

1. Open the site on your phone (GitHub Pages URL or same Wi‑Fi to your computer)
2. **iPhone (Safari):** Share → **Add to Home Screen**
3. **Android (Chrome):** Menu → **Install app** / **Add to Home screen**
4. After first load, the book works **offline**

## GitHub Pages

After deploy, the public URL looks like:

`https://gurbind47.github.io/sundar-gutka-reader/`

## Files

```
sundar-gutka-reader/
├── index.html
├── css/styles.css
├── js/app.js
├── sw.js                    # offline service worker
├── manifest.webmanifest     # PWA install
├── icons/
├── lib/                     # PDF.js
├── assets/sundar-gutka.pdf
└── scripts/start-server.sh
```

Original PDF on Desktop is not moved or deleted — only a copy lives in `assets/`.

## Speed guide (path)

| Level | Feel |
|-------|------|
| 1–2 | Very slow, careful path |
| 3–4 | Comfortable default |
| 5–7 | Medium |
| 8–10 | Quick review |

## License / source

Gutka text: Damdami Taksal / Khalis Foundation edition (shared for sangat).  
App shell: for personal / sangat use.
