/**
 * Sundar Gutka Auto-Scroll Reader
 * PDF.js 6 + path auto-scroll + banis + zoom + theme
 */
import * as pdfjsLib from "../lib/pdf.min.mjs";

const PDF_URL = "assets/sundar-gutka.pdf";
const STORAGE_KEY = "sundar-gutka-reader-v2";
const PAGE_ASPECT = 2288 / 1425;
const RENDER_BUFFER = 3;
const MAX_DPR = 2;
const ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150, 175, 200];
const THEME_CYCLE = ["system", "day", "night"];
/** Reference page height (px) used when calibrating speed levels. */
const REF_PAGE_HEIGHT = 420;
/** Base px/sec at REF_PAGE_HEIGHT for speeds 1–5 (within former 1–2 pace). */
const SPEED_TABLE = [0, 5, 5.75, 6.5, 7.25, 8];
/** Reading modes: continuous scroll, swipe-to-turn book. */
const MODES = ["scroll", "book"];
const MODE_META = {
  scroll: { icon: "↕", label: "Scroll", title: "Scroll mode: continuous pages, auto-scroll" },
  book: { icon: "↔", label: "Book", title: "Book mode: swipe left / right to turn the page" },
};
const HINT_MS = 3500;
/** Book mode: drag past this fraction of the width (or fast flick) commits a page turn. */
const SWIPE_COMMIT_FRACTION = 0.2;
const SWIPE_COMMIT_VELOCITY = 0.45; // px per ms
const TAP_MAX_MOVE = 10;
const TAP_MAX_MS = 350;
const PAGE_TURN_MS = 220;

const BANIS = [
  { name: "Japji Sahib", slug: "japji", page: 11 },
  { name: "Jaap Sahib", slug: "jaap", page: 32 },
  { name: "Tav Prasad Savaiye", slug: "savaiye", page: 61 },
  { name: "Chaupai Sahib", slug: "chaupai", page: 66 },
  { name: "Anand Sahib", slug: "anand", page: 74 },
  { name: "Shabad Hazare", slug: "shabad-hazare", page: 91 },
  { name: "Barah Maha Majh", slug: "barah-maha-majh", page: 101 },
  { name: "Shabad Hazare Patshahi 10", slug: "shabad-hazare-10", page: 111 },
  { name: "Savaiye Deenan", slug: "savaiye-deenan", page: 120 },
  { name: "Rehras Sahib", slug: "rehras", page: 124 },
  { name: "Ardas", slug: "ardas", page: 156 },
  { name: "Aarti", slug: "aarti", page: 163 },
  { name: "Rakhya De Shabad", slug: "rakhya", page: 169 },
  { name: "Kirtan Sohila", slug: "sohila", page: 172 },
  { name: "Bavan Akhri", slug: "bavan-akhri", page: 177 },
  { name: "Sukhmani Sahib", slug: "sukhmani", page: 212 },
  { name: "Asa Di Var", slug: "asa-di-var", page: 312 },
  { name: "Dakhni Oankar", slug: "dakhni-oankar", page: 362 },
  { name: "Sidh Gosht", slug: "sidh-gosht", page: 385 },
  { name: "Ramkali Ki Var", slug: "ramkali", page: 410 },
  { name: "Basant Ki Var", slug: "basant", page: 417 },
  { name: "Barah Maha Tukhari", slug: "barah-maha-tukhari", page: 419 },
  { name: "Laavan", slug: "laavan", page: 428 },
  { name: "Salok Mehla 9", slug: "salok-mehla-9", page: 431 },
  { name: "Chandi Di Var", slug: "chandi", page: 441 },
  { name: "Raag Mala", slug: "raag-mala", page: 471 },
];

const els = {
  viewer: document.getElementById("viewer"),
  pages: document.getElementById("pages"),
  status: document.getElementById("status"),
  btnPlay: document.getElementById("btnPlay"),
  playIcon: document.getElementById("playIcon"),
  playLabel: document.getElementById("playLabel"),
  speedSlider: document.getElementById("speedSlider"),
  speedValue: document.getElementById("speedValue"),
  pageInput: document.getElementById("pageInput"),
  pageTotal: document.getElementById("pageTotal"),
  btnGo: document.getElementById("btnGo"),
  btnBanis: document.getElementById("btnBanis"),
  banisDrawer: document.getElementById("banisDrawer"),
  banisList: document.getElementById("banisList"),
  banisBackdrop: document.getElementById("banisBackdrop"),
  btnCloseBanis: document.getElementById("btnCloseBanis"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),
  zoomValue: document.getElementById("zoomValue"),
  btnTheme: document.getElementById("btnTheme"),
  themeIcon: document.getElementById("themeIcon"),
  themeLabel: document.getElementById("themeLabel"),
  metaThemeColor: document.getElementById("metaThemeColor"),
  btnMore: document.getElementById("btnMore"),
  toolbarExtra: document.getElementById("toolbarExtra"),
  moreLabel: document.getElementById("moreLabel"),
  btnMode: document.getElementById("btnMode"),
  modeIcon: document.getElementById("modeIcon"),
  modeLabel: document.getElementById("modeLabel"),
  btnFull: document.getElementById("btnFull"),
  fullIcon: document.getElementById("fullIcon"),
  fullLabel: document.getElementById("fullLabel"),
  btnHide: document.getElementById("btnHide"),
  pager: document.getElementById("pager"),
  pagerTrack: document.getElementById("pagerTrack"),
  pagerBadge: document.getElementById("pagerBadge"),
  pagerProgress: document.getElementById("pagerProgress"),
  hint: document.getElementById("hint"),
  hintText: document.getElementById("hintText"),
};

const state = {
  pdf: null,
  numPages: 0,
  pageEls: [],
  speed: 3,
  zoom: 100,
  theme: "system",
  playing: false,
  currentPage: 1,
  rafId: null,
  lastTs: 0,
  scrollCarry: 0,
  wakeLock: null,
  ignoreScrollPause: false,
  scrollPauseTimer: null,
  resizeTimer: null,
  zoomTimer: null,
  saveTimer: null,
  lastFocus: null,
  pinch: null,
  mode: "scroll",
  controlsHidden: false,
  hintTimer: null,
  hintHideTimer: null,
  /** True when entering full screen is what hid the controls (restore them on exit). */
  fsHidControls: false,
  /** Unscaled size of page 1 (PDF units) used to fit pages in Book mode. */
  pageSize: { w: 1425, h: 2288 },
  /** Elapsed ms on the current page while auto-turning in Book mode. */
  turnElapsed: 0,
};

/** One-page-at-a-time viewer used by Book mode. */
const pager = {
  cur: 1,
  slides: [],
  fitW: 0,
  fitH: 0,
  drag: null,
  animating: false,
  lastWheel: 0,
};

function isPaged() {
  return state.mode !== "scroll";
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {
    return false;
  }
}

function speedToPxPerSec(level) {
  const n = Math.min(5, Math.max(1, Number(level) || 1));
  return SPEED_TABLE[n];
}

function avgRenderedPageHeight() {
  let sum = 0;
  let count = 0;
  for (const entry of state.pageEls) {
    if (entry.rendered && entry.wrap.offsetHeight > 0) {
      sum += entry.wrap.offsetHeight;
      count++;
      if (count >= 3) break;
    }
  }
  if (!count) {
    const w = getRenderWidth();
    return w / PAGE_ASPECT;
  }
  return sum / count;
}

function pacedPxPerSec() {
  const base = speedToPxPerSec(state.speed);
  const pageH = avgRenderedPageHeight();
  return base * (pageH / REF_PAGE_HEIGHT);
}

// ——— Persistence ———

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("sundar-gutka-reader-v1");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.speed >= 1 && data.speed <= 5) state.speed = data.speed;
    else if (data.speed > 5) state.speed = 5;
    if (data.page >= 1) state.currentPage = data.page;
    if (ZOOM_STEPS.indexOf(data.zoom) !== -1) state.zoom = data.zoom;
    if (data.theme === "day" || data.theme === "night" || data.theme === "system") {
      state.theme = data.theme;
    }
    if (MODES.indexOf(data.mode) !== -1) state.mode = data.mode;
    state.controlsHidden = data.controlsHidden === true;
  } catch (_) {
    /* ignore */
  }
}

function savePrefsImmediate() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        speed: state.speed,
        page: state.currentPage,
        zoom: state.zoom,
        theme: state.theme,
        mode: state.mode,
        controlsHidden: state.controlsHidden,
      })
    );
  } catch (_) {
    /* ignore */
  }
}

function savePrefs() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(savePrefsImmediate, 250);
}

// ——— Deep links ———

function parseDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const hp = new URLSearchParams(hash.includes("=") ? hash : "bani=" + hash);
    for (const [k, v] of hp) params.set(k, v);
  }
  const page = Number(params.get("page"));
  if (page >= 1) return { page };
  const bani = (params.get("bani") || "").toLowerCase().trim();
  if (bani) {
    const match = BANIS.find(
      (b) => b.slug === bani || b.name.toLowerCase().replace(/\s+/g, "-") === bani
    );
    if (match) return { page: match.page, bani: match.slug };
  }
  return null;
}

function updateDeepLink() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(state.currentPage));
    const bani = BANIS.slice()
      .reverse()
      .find((b) => state.currentPage >= b.page);
    if (bani) url.searchParams.set("bani", bani.slug);
    else url.searchParams.delete("bani");
    history.replaceState(null, "", url.pathname + url.search + url.hash.replace(/#.*/, ""));
  } catch (_) {
    /* ignore */
  }
}

// ——— Theme ———

function resolveNight() {
  if (state.theme === "night") return true;
  if (state.theme === "day") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
  const night = resolveNight();
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.setAttribute("data-resolved", night ? "night" : "day");
  if (els.metaThemeColor) {
    els.metaThemeColor.setAttribute("content", night ? "#1a1510" : "#f3efe6");
  }
  if (els.themeIcon && els.themeLabel) {
    if (state.theme === "system") {
      els.themeIcon.textContent = "◐";
      els.themeLabel.textContent = "Auto";
    } else if (state.theme === "day") {
      els.themeIcon.textContent = "☀";
      els.themeLabel.textContent = "Day";
    } else {
      els.themeIcon.textContent = "☾";
      els.themeLabel.textContent = "Night";
    }
  }
  if (els.btnTheme) {
    els.btnTheme.title = "Theme: " + state.theme + " (click to change). Auto follows system.";
  }
}

function cycleTheme() {
  const i = THEME_CYCLE.indexOf(state.theme);
  state.theme = THEME_CYCLE[(i + 1) % THEME_CYCLE.length];
  applyTheme();
  savePrefs();
}

// ——— UI helpers ———

function setStatus(msg, isError) {
  if (!msg) {
    els.status.classList.add("hidden");
    els.status.textContent = "";
    els.status.classList.remove("error");
    return;
  }
  els.status.classList.remove("hidden");
  els.status.classList.toggle("error", !!isError);
  els.status.textContent = msg;
}

function updatePlayButton() {
  els.btnPlay.setAttribute("aria-pressed", state.playing ? "true" : "false");
  els.playIcon.textContent = state.playing ? "❚❚" : "▶";
  els.playLabel.textContent = state.playing ? "Pause" : "Play";
  els.btnPlay.title = isPaged()
    ? "Play / Pause auto page-turn (Space)"
    : "Play / Pause auto-scroll (Space)";
  if (els.pager) els.pager.classList.toggle("playing", state.playing);
}

function updateSpeedUI() {
  els.speedSlider.value = String(state.speed);
  els.speedSlider.setAttribute("aria-valuenow", String(state.speed));
  els.speedValue.textContent = String(state.speed);
}

function updateZoomUI() {
  // Book always fits the whole page to the screen, so Size is locked there.
  const locked = isPaged();
  const lockTitle = "Page fits the screen in Book mode. Switch to Scroll to change Size.";
  if (els.zoomValue) els.zoomValue.textContent = locked ? "Fit" : state.zoom + "%";
  if (els.btnZoomOut) {
    els.btnZoomOut.disabled = locked || state.zoom <= ZOOM_STEPS[0];
    els.btnZoomOut.title = locked ? lockTitle : "Smaller text (−)";
  }
  if (els.btnZoomIn) {
    els.btnZoomIn.disabled = locked || state.zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1];
    els.btnZoomIn.title = locked ? lockTitle : "Larger text (+)";
  }
}

function updatePageUI(page) {
  state.currentPage = page;
  if (document.activeElement !== els.pageInput) {
    els.pageInput.value = String(page);
  }
  if (els.pagerBadge) {
    els.pagerBadge.textContent = state.numPages ? page + " / " + state.numPages : String(page);
  }
}

// ——— Wake Lock ———

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
    });
  } catch (_) {
    /* ignore */
  }
}

async function releaseWakeLock() {
  if (state.wakeLock) {
    try {
      await state.wakeLock.release();
    } catch (_) {
      /* ignore */
    }
    state.wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.playing) {
    requestWakeLock();
  }
});

// ——— Visible page (binary search on offsetTop — no layout thrash) ———

function getVisiblePage() {
  const n = state.pageEls.length;
  if (!n) return 1;
  if (isPaged()) return pager.cur;

  const scrollMid = els.viewer.scrollTop + els.viewer.clientHeight * 0.35;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (state.pageEls[mid].wrap.offsetTop <= scrollMid) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function onScroll() {
  if (!state.numPages || isPaged()) return;
  const page = getVisiblePage();
  if (page !== state.currentPage) {
    updatePageUI(page);
    savePrefs();
    updateDeepLink();
  }
  scheduleVisibleRenders();
}

function onUserScrollIntent() {
  if (state.ignoreScrollPause) return;
  if (state.playing) pause();
}

function withProgrammaticScroll(fn) {
  state.ignoreScrollPause = true;
  fn();
  window.clearTimeout(state.scrollPauseTimer);
  state.scrollPauseTimer = window.setTimeout(() => {
    state.ignoreScrollPause = false;
  }, 150);
}

// ——— Render / zoom ———

function getFitWidth() {
  const pad = isWideLayout() ? 16 : 8;
  const vw = els.viewer.clientWidth || window.innerWidth;
  const minW = isWideLayout() ? 280 : 1;
  return Math.max(minW, vw - pad);
}

function getRenderWidth() {
  const w = Math.round(getFitWidth() * (state.zoom / 100));
  return Math.max(200, Math.min(w, 2000));
}

function sizePageWrap(wrap, canvas, renderWidth, renderHeight, aspect) {
  const cssWidth = renderWidth != null ? renderWidth : getRenderWidth();
  const cssHeight = renderHeight != null ? renderHeight : Math.round(cssWidth / PAGE_ASPECT);
  const ratio = aspect || String(PAGE_ASPECT);

  // Full page always present: zoom enlarges width; viewer pans/scrolls inside the app frame.
  wrap.style.width = cssWidth + "px";
  wrap.style.maxWidth = cssWidth + "px";
  wrap.style.height = "";
  wrap.style.aspectRatio = ratio;

  if (canvas) {
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.style.marginLeft = "0px";
  }
}

/**
 * Render one PDF page into `canvas` at `cssWidth` CSS px (backing store scaled by DPR).
 * `onStart(task, info)` fires once the render task exists so callers can keep a cancel
 * handle and size their wrapper. Resolves with the CSS size once drawing finishes.
 */
async function renderPageToCanvas(pageNum, canvas, cssWidth, onStart) {
  const page = await state.pdf.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = cssWidth / unscaled.width;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const viewport = page.getViewport({ scale: scale * dpr });

  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const info = {
    cssWidth,
    cssHeight: Math.floor(unscaled.height * scale),
    pageWidth: unscaled.width,
    pageHeight: unscaled.height,
  };
  canvas.style.width = info.cssWidth + "px";
  canvas.style.height = info.cssHeight + "px";

  const task = page.render({ canvasContext: ctx, canvas, viewport });
  if (onStart) onStart(task, info);
  await task.promise;
  return info;
}

function isRenderCancelled(err) {
  return err && err.name === "RenderingCancelledException";
}

async function renderPage(index) {
  const entry = state.pageEls[index];
  if (!entry || !state.pdf) return;
  if (entry.rendering) return;
  if (entry.rendered && entry.canvas.width > 0) return;

  entry.rendering = true;
  try {
    await renderPageToCanvas(entry.pageNum, entry.canvas, getRenderWidth(), (task, info) => {
      entry.renderTask = task;
      sizePageWrap(
        entry.wrap,
        entry.canvas,
        info.cssWidth,
        info.cssHeight,
        `${info.pageWidth} / ${info.pageHeight}`
      );
    });
    entry.rendered = true;
    entry.renderTask = null;
  } catch (err) {
    if (!isRenderCancelled(err)) {
      console.warn("Render failed page", entry.pageNum, err);
    }
  } finally {
    entry.rendering = false;
  }
}

function cancelRender(entry) {
  if (entry.renderTask) {
    try {
      entry.renderTask.cancel();
    } catch (_) {
      /* ignore */
    }
    entry.renderTask = null;
  }
  entry.rendering = false;
}

function clearCanvas(entry) {
  cancelRender(entry);
  const canvas = entry.canvas;
  const ctx = canvas.getContext("2d");
  if (canvas.width) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
  entry.rendered = false;
}

function invalidateAllPages() {
  for (const entry of state.pageEls) {
    if (entry.rendered || entry.rendering) clearCanvas(entry);
    sizePageWrap(entry.wrap, entry.canvas);
  }
}

function scheduleVisibleRenders() {
  if (!state.numPages || isPaged()) return;
  const current = getVisiblePage();
  const from = Math.max(1, current - RENDER_BUFFER);
  const to = Math.min(state.numPages, current + RENDER_BUFFER);

  for (let i = 0; i < state.pageEls.length; i++) {
    const pageNum = i + 1;
    const entry = state.pageEls[i];
    if (pageNum >= from && pageNum <= to) {
      if (!entry.rendered && !entry.rendering) {
        renderPage(i);
      }
    } else if (pageNum < from - 2 || pageNum > to + 2) {
      if (entry.rendered || entry.rendering) {
        clearCanvas(entry);
      }
    }
  }
}

function setZoom(nextZoom) {
  if (isPaged()) {
    updateZoomUI();
    return;
  }
  let z = nextZoom;
  if (ZOOM_STEPS.indexOf(z) === -1) z = zoomStepNearest(z);
  z = Math.max(ZOOM_STEPS[0], Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], z));
  if (z === state.zoom) {
    updateZoomUI();
    return;
  }

  const pageBefore = state.currentPage;
  state.zoom = z;
  updateZoomUI();
  savePrefs();

  window.clearTimeout(state.zoomTimer);
  state.zoomTimer = window.setTimeout(() => {
    invalidateAllPages();
    goToPage(pageBefore);
    centerViewerHorizontally();
    scheduleVisibleRenders();
  }, 80);
}

function centerViewerHorizontally() {
  const maxX = Math.max(0, els.viewer.scrollWidth - els.viewer.clientWidth);
  if (maxX <= 0) {
    els.viewer.scrollLeft = 0;
    return;
  }
  withProgrammaticScroll(() => {
    els.viewer.scrollLeft = Math.round(maxX / 2);
  });
}

function zoomIn() {
  const i = ZOOM_STEPS.indexOf(state.zoom);
  if (i < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[i + 1]);
}

function zoomOut() {
  const i = ZOOM_STEPS.indexOf(state.zoom);
  if (i > 0) setZoom(ZOOM_STEPS[i - 1]);
}

function touchDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function zoomStepNearest(z) {
  let best = ZOOM_STEPS[0];
  let bestD = Infinity;
  for (let i = 0; i < ZOOM_STEPS.length; i++) {
    const d = Math.abs(ZOOM_STEPS[i] - z);
    if (d < bestD) {
      bestD = d;
      best = ZOOM_STEPS[i];
    }
  }
  return best;
}

function onPinchStart(e) {
  if (e.touches.length !== 2) return;
  if (state.playing) pause();
  if (isPaged()) return;
  state.pinch = {
    startDist: touchDistance(e.touches[0], e.touches[1]),
    startZoom: state.zoom,
    lastApplied: state.zoom,
  };
}

function onPinchMove(e) {
  if (isPaged()) {
    // No zoom in Book: block the browser's own page pinch-zoom instead.
    if (e.touches.length === 2 && e.cancelable) e.preventDefault();
    return;
  }
  if (!state.pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const dist = touchDistance(e.touches[0], e.touches[1]);
  if (!state.pinch.startDist) return;
  const ratio = dist / state.pinch.startDist;
  const raw = state.pinch.startZoom * ratio;
  const next = zoomStepNearest(raw);
  if (next !== state.pinch.lastApplied) {
    state.pinch.lastApplied = next;
    setZoom(next);
  }
}

function onPinchEnd(e) {
  if (!state.pinch) return;
  if (e.touches.length < 2) state.pinch = null;
}

function buildPlaceholders() {
  els.pages.innerHTML = "";
  state.pageEls = [];
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= state.numPages; i++) {
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.dataset.page = String(i);
    wrap.setAttribute("aria-label", "Page " + i);

    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
    sizePageWrap(wrap, canvas);
    wrap.appendChild(canvas);

    const badge = document.createElement("span");
    badge.className = "page-badge";
    badge.textContent = String(i);
    wrap.appendChild(badge);

    frag.appendChild(wrap);
    state.pageEls.push({
      wrap,
      canvas,
      pageNum: i,
      rendered: false,
      rendering: false,
      renderTask: null,
    });
  }
  els.pages.appendChild(frag);
}

async function ensurePdfLoaded() {
  if (state.pdf) return;
  setStatus("Loading Sundar Gutka…");
  const loadingTask = pdfjsLib.getDocument({
    url: PDF_URL,
    useSystemFonts: false,
    disableFontFace: false,
    standardFontDataUrl: new URL("../lib/standard_fonts/", import.meta.url).href,
  });
  state.pdf = await loadingTask.promise;
  state.numPages = state.pdf.numPages;
  els.pageTotal.textContent = "/ " + state.numPages;
  els.pageInput.max = String(state.numPages);
  els.pageInput.min = "1";
  try {
    const first = await state.pdf.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    if (vp.width > 0 && vp.height > 0) state.pageSize = { w: vp.width, h: vp.height };
  } catch (_) {
    /* keep default aspect */
  }
  buildPlaceholders();
  setStatus("");
}

// ——— Navigation ———

function clampPage(pageNum) {
  return Math.min(state.numPages || 1, Math.max(1, Math.round(Number(pageNum) || 1)));
}

function goToPage(pageNum) {
  const n = clampPage(pageNum);
  if (isPaged()) {
    pagerGoTo(n);
    return;
  }

  withProgrammaticScroll(() => {
    state.scrollCarry = 0;
    const entry = state.pageEls[n - 1];
    if (!entry) return;
    els.viewer.scrollTop = Math.max(0, entry.wrap.offsetTop - 8);
    updatePageUI(n);
    savePrefs();
    updateDeepLink();
    scheduleVisibleRenders();
  });
}

// ——— Pager (Book: one page fitted to the screen) ———

function initPager() {
  if (!els.pagerTrack) return;
  pager.slides = Array.from(els.pagerTrack.querySelectorAll(".pager-slide")).map((el) => ({
    el,
    canvas: el.querySelector("canvas"),
    pageNum: 0,
    task: null,
    renderedW: 0,
  }));
}

/** Largest CSS size of a whole page that fits inside the pager box. */
function computePagerFit() {
  const box = els.pager;
  const vw = (box && box.clientWidth) || els.viewer.clientWidth || window.innerWidth;
  const vh = (box && box.clientHeight) || els.viewer.clientHeight || window.innerHeight;
  const pad = isWideLayout() ? 12 : 0;
  const availW = Math.max(120, vw - pad * 2);
  const availH = Math.max(120, vh - pad * 2);
  const scale = Math.min(availW / state.pageSize.w, availH / state.pageSize.h);
  pager.fitW = Math.max(100, Math.floor(state.pageSize.w * scale));
  pager.fitH = Math.max(100, Math.floor(state.pageSize.h * scale));
}

function cancelSlide(slide) {
  if (slide.task) {
    try {
      slide.task.cancel();
    } catch (_) {
      /* ignore */
    }
    slide.task = null;
  }
}

function clearSlide(slide) {
  cancelSlide(slide);
  slide.pageNum = 0;
  slide.renderedW = 0;
  slide.canvas.width = 0;
  slide.canvas.height = 0;
  slide.canvas.style.width = "0px";
  slide.canvas.style.height = "0px";
}

async function renderSlide(slide, pageNum) {
  if (!state.pdf) return;
  if (!pageNum) {
    clearSlide(slide);
    return;
  }
  if (slide.pageNum === pageNum && slide.renderedW === pager.fitW && slide.canvas.width > 0) return;
  cancelSlide(slide);
  slide.pageNum = pageNum;
  slide.renderedW = 0;
  // Reserve the fitted box immediately so the layout is stable while the page draws.
  slide.canvas.style.width = pager.fitW + "px";
  slide.canvas.style.height = pager.fitH + "px";
  const targetW = pager.fitW;
  try {
    await renderPageToCanvas(pageNum, slide.canvas, targetW, (task) => {
      slide.task = task;
    });
    if (slide.pageNum === pageNum) {
      slide.task = null;
      slide.renderedW = targetW;
    }
  } catch (err) {
    if (!isRenderCancelled(err)) console.warn("Render failed page", pageNum, err);
  }
}

/**
 * Point the three slides at pages n-1 / n / n+1, reusing any slide that already
 * shows one of those pages so a normal turn renders only the new neighbour.
 */
function pagerAssign(n) {
  if (!pager.slides.length) initPager();
  if (!pager.slides.length) return;
  const want = {
    cur: n,
    prev: n > 1 ? n - 1 : 0,
    next: n < state.numPages ? n + 1 : 0,
  };
  const roles = ["cur", "prev", "next"];
  const assigned = {};
  const free = [];
  for (const slide of pager.slides) {
    const role = roles.find((r) => !assigned[r] && want[r] && want[r] === slide.pageNum);
    if (role) assigned[role] = slide;
    else free.push(slide);
  }
  for (const role of roles) {
    if (!assigned[role]) assigned[role] = free.pop();
  }
  for (const role of roles) {
    const slide = assigned[role];
    slide.el.dataset.slot = role;
    renderSlide(slide, want[role]);
  }
  pager.cur = n;
}

/** Re-fit and redraw whatever the slides currently show (resize, controls toggle, full screen). */
function pagerRefit() {
  if (!isPaged() || !state.pdf) return;
  const before = pager.fitW;
  computePagerFit();
  if (pager.fitW === before) return;
  for (const slide of pager.slides) {
    if (slide.pageNum) {
      slide.renderedW = 0;
      renderSlide(slide, slide.pageNum);
    }
  }
}

function pagerCommit(n) {
  state.scrollCarry = 0;
  state.turnElapsed = 0;
  setTurnProgress(0);
  updatePageUI(n);
  savePrefs();
  updateDeepLink();
}

function pagerGoTo(n) {
  if (!state.pdf) {
    updatePageUI(clampPage(n));
    return;
  }
  computePagerFit();
  resetTrackTransform();
  pagerAssign(clampPage(n));
  pagerCommit(pager.cur);
}

function resetTrackTransform() {
  if (!els.pagerTrack) return;
  els.pagerTrack.style.transition = "none";
  els.pagerTrack.style.transform = "translateX(0px)";
  pager.animating = false;
}

/**
 * Turn `dir` pages (+1 next, -1 previous). Book mode slides to the target page.
 * Returns false when already at the first / last page.
 */
function pagerTurn(dir, opts) {
  const o = opts || {};
  if (!state.pdf || pager.animating) return false;
  const target = pager.cur + dir;
  if (target < 1 || target > state.numPages) {
    if (!o.auto) showHint(dir > 0 ? "Last page" : "First page", 1200, { plain: true });
    return false;
  }
  if (!o.auto && state.playing) pause();
  if (!prefersReducedMotion()) {
    pagerAnimateTo(target, dir);
  } else {
    pagerAssign(target);
    pagerCommit(target);
  }
  return true;
}

function pagerAnimateTo(target, dir) {
  const track = els.pagerTrack;
  const width = els.pager.clientWidth || window.innerWidth;
  pager.animating = true;
  els.pager.classList.remove("dragging");
  track.style.transition = "transform " + PAGE_TURN_MS + "ms ease-out";
  track.style.transform = "translateX(" + -dir * width + "px)";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    track.removeEventListener("transitionend", finish);
    window.clearTimeout(timer);
    track.style.transition = "none";
    pagerAssign(target);
    track.style.transform = "translateX(0px)";
    pager.animating = false;
    pagerCommit(target);
  };
  track.addEventListener("transitionend", finish);
  const timer = window.setTimeout(finish, PAGE_TURN_MS + 120);
}

function snapTrackBack() {
  const track = els.pagerTrack;
  if (!track) return;
  pager.animating = true;
  track.style.transition = "transform 160ms ease-out";
  track.style.transform = "translateX(0px)";
  window.setTimeout(() => {
    track.style.transition = "none";
    pager.animating = false;
  }, 180);
}

// ——— Pager gestures: Book swipe, tap for controls ———

function onPagerPointerDown(e) {
  if (!isPaged() || !state.pdf) return;
  if (pager.drag || pager.animating) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  hideHint();
  pager.drag = {
    id: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    startT: e.timeStamp || performance.now(),
    lastT: e.timeStamp || performance.now(),
    lastX: e.clientX,
    velocity: 0,
    swiping: false,
    cancelled: false,
  };
  try {
    els.pager.setPointerCapture(e.pointerId);
  } catch (_) {
    /* ignore */
  }
  if (e.pointerType === "mouse") e.preventDefault();
}

function onPagerPointerMove(e) {
  const d = pager.drag;
  if (!d || e.pointerId !== d.id) return;
  d.x = e.clientX;
  d.y = e.clientY;
  const now = e.timeStamp || performance.now();
  const dt = now - d.lastT;
  if (dt > 0) {
    d.velocity = (e.clientX - d.lastX) / dt;
    d.lastT = now;
    d.lastX = e.clientX;
  }
  if (state.mode !== "book") return;

  const dx = d.x - d.startX;
  const dy = d.y - d.startY;
  if (!d.swiping) {
    if (Math.abs(dx) < TAP_MAX_MOVE) return;
    if (Math.abs(dx) < Math.abs(dy)) {
      // Mostly vertical: not a page swipe. Treat as nothing.
      d.cancelled = true;
      return;
    }
    d.swiping = true;
    els.pager.classList.add("dragging");
    els.pagerTrack.style.transition = "none";
  }
  if (d.cancelled) return;
  const width = els.pager.clientWidth || 1;
  const atEdge = (dx > 0 && pager.cur <= 1) || (dx < 0 && pager.cur >= state.numPages);
  const offset = atEdge ? dx * 0.3 : Math.max(-width, Math.min(width, dx));
  els.pagerTrack.style.transform = "translateX(" + offset + "px)";
}

function onPagerPointerUp(e) {
  const d = pager.drag;
  if (!d || e.pointerId !== d.id) return;
  pager.drag = null;
  try {
    els.pager.releasePointerCapture(e.pointerId);
  } catch (_) {
    /* ignore */
  }
  els.pager.classList.remove("dragging");

  const dx = d.x - d.startX;
  const dy = d.y - d.startY;
  const elapsed = (e.timeStamp || performance.now()) - d.startT;

  if (d.swiping) {
    const width = els.pager.clientWidth || 1;
    const dir = dx < 0 ? 1 : -1;
    const target = pager.cur + dir;
    const farEnough = Math.abs(dx) > width * SWIPE_COMMIT_FRACTION;
    const fastEnough = Math.abs(d.velocity) > SWIPE_COMMIT_VELOCITY && Math.sign(d.velocity) === -dir;
    if ((farEnough || fastEnough) && target >= 1 && target <= state.numPages) {
      if (state.playing) pause();
      pagerAnimateTo(target, dir);
    } else {
      snapTrackBack();
    }
    return;
  }

  if (d.cancelled) return;
  const isTap = Math.abs(dx) <= TAP_MAX_MOVE && Math.abs(dy) <= TAP_MAX_MOVE && elapsed <= TAP_MAX_MS * 2;
  if (!isTap) return;
  handlePagerTap();
}

function onPagerPointerCancel(e) {
  const d = pager.drag;
  if (!d || e.pointerId !== d.id) return;
  pager.drag = null;
  els.pager.classList.remove("dragging");
  if (d.swiping) snapTrackBack();
}

function handlePagerTap() {
  toggleControls();
}

function onPagerWheel(e) {
  if (!isPaged() || !state.pdf) return;
  e.preventDefault();
  const now = performance.now();
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(delta) < 8) return;
  // Trackpads emit long inertial bursts; allow one turn per burst.
  if (now - pager.lastWheel < 600) return;
  pager.lastWheel = now;
  pagerTurn(delta > 0 ? 1 : -1);
}

// ——— Reading modes ———

function updateModeUI() {
  const meta = MODE_META[state.mode] || MODE_META.scroll;
  document.documentElement.setAttribute("data-mode", state.mode);
  if (els.modeIcon) els.modeIcon.textContent = meta.icon;
  if (els.modeLabel) els.modeLabel.textContent = meta.label;
  if (els.btnMode) els.btnMode.title = meta.title + " — click to change (M)";
  if (els.pager) els.pager.classList.toggle("book", state.mode === "book");
  updateZoomUI();
  updatePlayButton();
}

function setMode(mode, opts) {
  const o = opts || {};
  const next = MODES.indexOf(mode) !== -1 ? mode : "scroll";
  const wasPaged = isPaged();
  if (state.playing) pause();
  hideHint();
  state.mode = next;
  updateModeUI();
  savePrefs();

  const page = state.currentPage;
  if (isPaged()) {
    for (const entry of state.pageEls) cancelRender(entry);
    state.pinch = null;
    if (state.pdf) pagerGoTo(page);
  } else if (wasPaged) {
    for (const slide of pager.slides) cancelSlide(slide);
    if (state.pdf) {
      // Sizes may have changed while the scroll list was hidden; redraw around the page.
      invalidateAllPages();
      requestAnimationFrame(() => {
        goToPage(page);
        scheduleVisibleRenders();
      });
    }
  }
  if (!o.silent) showHint();
}

function cycleMode() {
  const i = MODES.indexOf(state.mode);
  setMode(MODES[(i + 1) % MODES.length]);
}

// ——— Hide controls + instruction hints ———

function hintMessage() {
  const hidden = state.controlsHidden;
  if (state.mode === "book") {
    return ["Swipe ← → to turn pages", hidden ? "Tap once to show controls" : "Tap once to hide controls"];
  }
  return ["Scroll to read · Play auto-scrolls", hidden ? "Tap once to show controls" : ""];
}

/**
 * Show the per-mode instructions (or a custom message) for a few seconds.
 */
function showHint(text, ms, opts) {
  if (!els.hint || !els.hintText) return;
  const o = opts || {};
  const lines = text ? [text] : hintMessage();
  els.hintText.innerHTML = "";
  lines
    .filter(Boolean)
    .forEach((line) => {
      const p = document.createElement("div");
      p.textContent = line;
      els.hintText.appendChild(p);
    });
  els.hint.classList.toggle("plain", !!o.plain);

  window.clearTimeout(state.hintHideTimer);
  els.hint.hidden = false;
  requestAnimationFrame(() => els.hint.classList.add("show"));
  window.clearTimeout(state.hintTimer);
  state.hintTimer = window.setTimeout(hideHint, ms || HINT_MS);
}

function hideHint() {
  if (!els.hint || els.hint.hidden) return;
  window.clearTimeout(state.hintTimer);
  els.hint.classList.remove("show");
  window.clearTimeout(state.hintHideTimer);
  state.hintHideTimer = window.setTimeout(() => {
    if (!els.hint.classList.contains("show")) els.hint.hidden = true;
  }, 260);
}

function applyControlsAttr() {
  document.documentElement.setAttribute("data-controls", state.controlsHidden ? "hidden" : "shown");
}

function setControlsHidden(hidden, opts) {
  const o = opts || {};
  const next = !!hidden;
  const changed = next !== state.controlsHidden;
  state.controlsHidden = next;
  applyControlsAttr();
  if (next) setMoreOpen(false);
  if (els.btnHide) els.btnHide.setAttribute("aria-pressed", next ? "true" : "false");
  savePrefs();
  if (changed && isPaged()) {
    // The viewer grew / shrank: fit the page to the new box. (Scroll mode keeps its
    // offsets since the width is unchanged.)
    requestAnimationFrame(pagerRefit);
  }
  if (!o.silent) showHint();
}

function toggleControls() {
  setControlsHidden(!state.controlsHidden);
}

// ——— Full screen ———

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function fullscreenSupported() {
  const el = document.documentElement;
  if (document.fullscreenEnabled === false) return false;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

function updateFullscreenUI() {
  const active = !!fullscreenElement();
  document.documentElement.setAttribute("data-fullscreen", active ? "1" : "0");
  if (els.btnFull) {
    els.btnFull.setAttribute("aria-pressed", active ? "true" : "false");
    els.btnFull.title = active ? "Exit full screen (F or Esc)" : "Full screen (F)";
  }
  if (els.fullLabel) els.fullLabel.textContent = active ? "Exit" : "Full";
}

function onFullscreenChange() {
  const active = !!fullscreenElement();
  updateFullscreenUI();
  if (!active && state.fsHidControls) {
    state.fsHidControls = false;
    setControlsHidden(false, { silent: true });
  }
  window.setTimeout(() => {
    if (isPaged()) pagerRefit();
  }, 50);
}

function fullscreenFallback() {
  if (!state.controlsHidden) {
    state.fsHidControls = false;
    setControlsHidden(true, { silent: true });
  }
  const iOS = /iPhone|iPod/.test(navigator.userAgent || "");
  showHint(
    iOS
      ? "Full screen: Share → Add to Home Screen, then open Sundar Gutka from the Home Screen. Controls hidden — tap once to show them."
      : "Full screen is not available in this browser. Controls hidden — tap once to show them.",
    5000,
    { plain: true }
  );
}

async function toggleFullscreen() {
  const el = document.documentElement;
  if (fullscreenElement()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {
      /* ignore */
    }
    return;
  }
  if (!fullscreenSupported()) {
    fullscreenFallback();
    return;
  }
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else el.webkitRequestFullscreen();
    if (!state.controlsHidden) {
      state.fsHidControls = true;
      setControlsHidden(true, { silent: true });
    }
    showHint();
  } catch (_) {
    fullscreenFallback();
  }
}

// ——— Banis ———

function buildBanisList() {
  if (!els.banisList) return;
  els.banisList.innerHTML = "";
  BANIS.forEach((bani, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bani-item";
    btn.innerHTML =
      '<span class="bani-num">' +
      (idx + 1) +
      "</span>" +
      '<span class="bani-name">' +
      bani.name +
      "</span>" +
      '<span class="bani-page">p. ' +
      bani.page +
      "</span>";
    btn.addEventListener("click", () => {
      pause();
      closeBanis();
      goToPage(bani.page);
    });
    els.banisList.appendChild(btn);
  });
}

function openBanis() {
  if (!els.banisDrawer) return;
  setMoreOpen(false);
  state.lastFocus = document.activeElement;
  els.banisDrawer.classList.add("open");
  els.banisDrawer.setAttribute("aria-hidden", "false");
  els.banisDrawer.removeAttribute("inert");
  if (els.banisBackdrop) {
    els.banisBackdrop.hidden = false;
    els.banisBackdrop.classList.add("open");
  }
  if (els.btnBanis) els.btnBanis.setAttribute("aria-expanded", "true");
  els.btnCloseBanis?.focus();
}

function closeBanis() {
  if (!els.banisDrawer) return;
  els.banisDrawer.classList.remove("open");
  els.banisDrawer.setAttribute("aria-hidden", "true");
  els.banisDrawer.setAttribute("inert", "");
  if (els.banisBackdrop) {
    els.banisBackdrop.classList.remove("open");
    els.banisBackdrop.hidden = true;
  }
  if (els.btnBanis) els.btnBanis.setAttribute("aria-expanded", "false");
  if (state.lastFocus && typeof state.lastFocus.focus === "function") {
    state.lastFocus.focus();
  } else {
    els.btnBanis?.focus();
  }
}

function toggleBanis() {
  if (els.banisDrawer && els.banisDrawer.classList.contains("open")) closeBanis();
  else openBanis();
}

// ——— More controls (compact mobile toolbar) ———

function isWideLayout() {
  return window.matchMedia("(min-width: 721px)").matches;
}

function setMoreOpen(open) {
  if (!els.toolbarExtra) return;
  // Desktop always shows extras; mobile toggles
  const show = isWideLayout() ? true : !!open;
  els.toolbarExtra.hidden = !show;
  els.toolbarExtra.classList.toggle("hidden", !show);
  if (els.btnMore) {
    els.btnMore.setAttribute("aria-expanded", show && !isWideLayout() ? "true" : "false");
  }
  if (els.moreLabel) els.moreLabel.textContent = !isWideLayout() && show ? "Less" : "More";
  document.documentElement.setAttribute("data-more", show ? "1" : "0");
}

function toggleMore() {
  if (isWideLayout()) return;
  const open = els.toolbarExtra && els.toolbarExtra.hidden;
  setMoreOpen(!!open);
}

// ——— Auto-scroll ———

function tick(ts) {
  if (!state.playing) return;
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(64, ts - state.lastTs);
  state.lastTs = ts;

  const pxPerSec = pacedPxPerSec();
  state.scrollCarry += (pxPerSec * dt) / 1000;

  if (state.scrollCarry > 0) {
    state.ignoreScrollPause = true;
    const maxScroll = Math.max(0, els.viewer.scrollHeight - els.viewer.clientHeight);
    const before = els.viewer.scrollTop;
    const next = Math.min(maxScroll, before + state.scrollCarry);
    els.viewer.scrollTop = next;
    // Keep any sub-pixel remainder the engine could not apply
    state.scrollCarry = Math.max(0, state.scrollCarry - (els.viewer.scrollTop - before));
    if (state.scrollCarry < 1e-3) state.scrollCarry = 0;

    if (next >= maxScroll - 1) {
      pause();
      return;
    }

    window.clearTimeout(state.scrollPauseTimer);
    state.scrollPauseTimer = window.setTimeout(() => {
      state.ignoreScrollPause = false;
    }, 32);
  }

  if (Math.floor(ts / 250) !== Math.floor((ts - dt) / 250)) {
    const page = getVisiblePage();
    if (page !== state.currentPage) {
      updatePageUI(page);
      savePrefs();
      updateDeepLink();
    }
    scheduleVisibleRenders();
  }

  state.rafId = requestAnimationFrame(tick);
}

// ——— Auto page-turn (Book) ———

/** Time on one page at the current speed: same pace as scrolling one page height. */
function secondsPerPage() {
  return REF_PAGE_HEIGHT / speedToPxPerSec(state.speed);
}

function setTurnProgress(fraction) {
  if (!els.pagerProgress) return;
  const f = Math.max(0, Math.min(1, fraction || 0));
  els.pagerProgress.style.transform = "scaleX(" + f.toFixed(4) + ")";
}

function autoTurnTick(ts) {
  if (!state.playing || !isPaged()) return;
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(250, Math.max(0, ts - state.lastTs));
  state.lastTs = ts;
  state.turnElapsed += dt;

  const total = secondsPerPage() * 1000;
  const fraction = total > 0 ? state.turnElapsed / total : 1;
  setTurnProgress(fraction);

  if (fraction >= 1 && !pager.animating) {
    if (pager.cur >= state.numPages) {
      pause();
      return;
    }
    pagerTurn(1, { auto: true });
    state.turnElapsed = 0;
  }

  state.rafId = requestAnimationFrame(autoTurnTick);
}

// Debug handle for tests / console
window.__sg = {
  state,
  pager,
  pacedPxPerSec,
  secondsPerPage,
  play,
  pause,
  getVisiblePage,
  setMode,
  pagerTurn,
  setControlsHidden,
  showHint,
};

function play() {
  if (state.playing) return;
  if (!state.pdf) return;
  if (isPaged() && pager.cur >= state.numPages) {
    showHint("Last page", 1200, { plain: true });
    return;
  }
  state.playing = true;
  state.lastTs = 0;
  state.scrollCarry = 0;
  state.turnElapsed = 0;
  setTurnProgress(0);
  updatePlayButton();
  requestWakeLock();
  state.rafId = requestAnimationFrame(isPaged() ? autoTurnTick : tick);
}

function pause() {
  if (!state.playing) {
    updatePlayButton();
    return;
  }
  state.playing = false;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.lastTs = 0;
  state.scrollCarry = 0;
  state.turnElapsed = 0;
  setTurnProgress(0);
  updatePlayButton();
  releaseWakeLock();
  savePrefs();
}

function togglePlay() {
  if (state.playing) pause();
  else play();
}

// ——— Resize ———

function onResize() {
  window.clearTimeout(state.resizeTimer);
  state.resizeTimer = window.setTimeout(() => {
    setMoreOpen(isWideLayout());
    if (isPaged()) {
      pagerRefit();
      return;
    }
    const page = state.currentPage;
    invalidateAllPages();
    goToPage(page);
    scheduleVisibleRenders();
  }, 200);
}

// ——— Init ———

async function init() {
  loadPrefs();
  const deep = parseDeepLink();
  if (deep && deep.page) state.currentPage = deep.page;

  applyTheme();
  updateModeUI();
  applyControlsAttr();
  if (els.btnHide) els.btnHide.setAttribute("aria-pressed", state.controlsHidden ? "true" : "false");
  updateFullscreenUI();
  updateSpeedUI();
  updateZoomUI();
  updatePlayButton();
  setMoreOpen(false);
  els.pageInput.value = String(state.currentPage);
  buildBanisList();
  initPager();

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "../lib/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  try {
    await ensurePdfLoaded();
    const startPage = Math.min(state.numPages, Math.max(1, state.currentPage));
    requestAnimationFrame(() => {
      goToPage(startPage);
      scheduleVisibleRenders();
      if (state.controlsHidden) showHint();
    });
  } catch (err) {
    console.error(err);
    setStatus(
      "Failed to load PDF. Use the Desktop app, or open via a local server (see README). " +
        (err && err.message ? err.message : ""),
      true
    );
  }

  if ("serviceWorker" in navigator) {
    // Break older builds that reloaded on every controllerchange (page blink loop).
    const SW_FIX = "sg-blink-fix-v10";
    try {
      if (!sessionStorage.getItem(SW_FIX)) {
        sessionStorage.setItem(SW_FIX, "1");
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          var hadWorker = regs.length > 0 || !!navigator.serviceWorker.controller;
          var clear = Promise.all(
            regs.map(function (r) {
              return r.unregister();
            })
          ).then(function () {
            if (!("caches" in window)) return;
            return caches.keys().then(function (keys) {
              return Promise.all(
                keys.map(function (k) {
                  return caches.delete(k);
                })
              );
            });
          });
          return clear.then(function () {
            if (hadWorker) {
              window.location.reload();
              return;
            }
            return navigator.serviceWorker.register("sw.js");
          });
        }).catch(function (err) {
          console.warn("SW recovery failed", err);
          navigator.serviceWorker.register("sw.js").catch(function () {});
        });
        return;
      }
    } catch (_) {
      /* ignore */
    }

    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.warn("SW register failed", err);
    });
  }
}

// ——— Events ———

els.btnPlay.addEventListener("click", togglePlay);

els.speedSlider.addEventListener("input", () => {
  state.speed = Number(els.speedSlider.value);
  updateSpeedUI();
  savePrefs();
});

if (els.btnZoomIn) els.btnZoomIn.addEventListener("click", zoomIn);
if (els.btnZoomOut) els.btnZoomOut.addEventListener("click", zoomOut);
if (els.btnTheme) els.btnTheme.addEventListener("click", cycleTheme);

function applyPageJump() {
  goToPage(els.pageInput.value);
}

els.btnGo.addEventListener("click", applyPageJump);
els.pageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyPageJump();
  }
});

if (els.btnBanis) els.btnBanis.addEventListener("click", toggleBanis);
if (els.btnCloseBanis) els.btnCloseBanis.addEventListener("click", closeBanis);
if (els.banisBackdrop) els.banisBackdrop.addEventListener("click", closeBanis);


if (els.btnMore) els.btnMore.addEventListener("click", toggleMore);
if (els.btnMode) els.btnMode.addEventListener("click", cycleMode);
if (els.btnFull) els.btnFull.addEventListener("click", toggleFullscreen);
if (els.btnHide) els.btnHide.addEventListener("click", () => setControlsHidden(true));

els.viewer.addEventListener("scroll", onScroll, { passive: true });
els.viewer.addEventListener("wheel", onUserScrollIntent, { passive: true });
els.viewer.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches && e.touches.length >= 2) {
      onPinchStart(e);
      return;
    }
    if (isPaged()) return;
    hideHint();
    if (state.ignoreScrollPause) return;
    if (state.playing) pause();
  },
  { passive: true }
);
els.viewer.addEventListener("touchmove", onPinchMove, { passive: false });
els.viewer.addEventListener("touchend", onPinchEnd, { passive: true });
els.viewer.addEventListener("touchcancel", onPinchEnd, { passive: true });

// Scroll mode: a plain click / tap on the pages brings hidden controls back,
// otherwise (mouse) toggles auto-scroll as before.
els.viewer.addEventListener("click", (e) => {
  if (isPaged() || !state.pdf) return;
  if (!(e.target.closest(".page-wrap") || e.target === els.viewer || e.target === els.pages)) return;
  if (state.controlsHidden) {
    setControlsHidden(false);
    return;
  }
  if (window.matchMedia("(pointer: fine)").matches) {
    togglePlay();
  }
});

if (els.pager) {
  els.pager.addEventListener("pointerdown", onPagerPointerDown);
  els.pager.addEventListener("pointermove", onPagerPointerMove);
  els.pager.addEventListener("pointerup", onPagerPointerUp);
  els.pager.addEventListener("pointercancel", onPagerPointerCancel);
  els.pager.addEventListener("wheel", onPagerWheel, { passive: false });
  els.pager.addEventListener("dragstart", (e) => e.preventDefault());
}

document.addEventListener("fullscreenchange", onFullscreenChange);
document.addEventListener("webkitfullscreenchange", onFullscreenChange);

window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", onResize);

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") applyTheme();
  });
} catch (_) {
  /* older browsers */
}

document.addEventListener("keydown", (e) => {
  if (e.target === els.pageInput || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
    if (e.key === "Escape") {
      closeBanis();
      setMoreOpen(false);
    }
    return;
  }

  if (e.key === "Escape") {
    closeBanis();
    setMoreOpen(false);
    if (state.controlsHidden && !fullscreenElement()) setControlsHidden(false);
    return;
  }
  const paged = isPaged();
  const speedUp = paged ? e.key === "ArrowUp" : e.key === "ArrowRight" || e.key === "ArrowUp";
  const speedDown = paged ? e.key === "ArrowDown" : e.key === "ArrowLeft" || e.key === "ArrowDown";
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (paged && (e.key === "ArrowRight" || e.key === "PageDown")) {
    e.preventDefault();
    pagerTurn(1);
  } else if (paged && (e.key === "ArrowLeft" || e.key === "PageUp")) {
    e.preventDefault();
    pagerTurn(-1);
  } else if (speedUp) {
    e.preventDefault();
    state.speed = Math.min(5, state.speed + 1);
    updateSpeedUI();
    savePrefs();
  } else if (speedDown) {
    e.preventDefault();
    state.speed = Math.max(1, state.speed - 1);
    updateSpeedUI();
    savePrefs();
  } else if (e.key === "b" || e.key === "B") {
    toggleBanis();
  } else if (e.key === "m" || e.key === "M") {
    cycleMode();
  } else if (e.key === "f" || e.key === "F") {
    toggleFullscreen();
  } else if (e.key === "h" || e.key === "H") {
    toggleControls();
  } else if (e.key === "+" || e.key === "=") {
    e.preventDefault();
    zoomIn();
  } else if (e.key === "-" || e.key === "_") {
    e.preventDefault();
    zoomOut();
  } else if (e.key === "t" || e.key === "T") {
    cycleTheme();
  }
});

window.addEventListener("pagehide", savePrefsImmediate);

init();
