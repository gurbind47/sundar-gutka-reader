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
};

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
}

function updateSpeedUI() {
  els.speedSlider.value = String(state.speed);
  els.speedSlider.setAttribute("aria-valuenow", String(state.speed));
  els.speedValue.textContent = String(state.speed);
}

function updateZoomUI() {
  if (els.zoomValue) els.zoomValue.textContent = state.zoom + "%";
  if (els.btnZoomOut) els.btnZoomOut.disabled = state.zoom <= ZOOM_STEPS[0];
  if (els.btnZoomIn) els.btnZoomIn.disabled = state.zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1];
}

function updatePageUI(page) {
  state.currentPage = page;
  if (document.activeElement !== els.pageInput) {
    els.pageInput.value = String(page);
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
  if (!state.numPages) return;
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

async function renderPage(index) {
  const entry = state.pageEls[index];
  if (!entry || !state.pdf) return;
  if (entry.rendering) return;
  if (entry.rendered && entry.canvas.width > 0) return;

  entry.rendering = true;
  try {
    const page = await state.pdf.getPage(entry.pageNum);
    const cssWidth = getRenderWidth();
    const unscaled = page.getViewport({ scale: 1 });
    const scale = cssWidth / unscaled.width;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = entry.canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const cssHeight = Math.floor(unscaled.height * scale);
    sizePageWrap(
      entry.wrap,
      canvas,
      cssWidth,
      cssHeight,
      `${unscaled.width} / ${unscaled.height}`
    );

    const renderTask = page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    });
    entry.renderTask = renderTask;
    await renderTask.promise;
    entry.rendered = true;
    entry.renderTask = null;
  } catch (err) {
    if (!err || err.name !== "RenderingCancelledException") {
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
  if (!state.numPages) return;
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
  state.pinch = {
    startDist: touchDistance(e.touches[0], e.touches[1]),
    startZoom: state.zoom,
    lastApplied: state.zoom,
  };
}

function onPinchMove(e) {
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
  buildPlaceholders();
  setStatus("");
}

// ——— Navigation ———

function goToPage(pageNum) {
  const n = Math.min(state.numPages || 1, Math.max(1, Math.round(Number(pageNum) || 1)));

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

// Debug handle for tests / console
window.__sg = {
  state,
  pacedPxPerSec,
  play,
  pause,
  getVisiblePage,
};

function play() {
  if (state.playing) return;
  if (!state.pdf) return;
  state.playing = true;
  state.lastTs = 0;
  state.scrollCarry = 0;
  updatePlayButton();
  requestWakeLock();
  state.rafId = requestAnimationFrame(tick);
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
  updateSpeedUI();
  updateZoomUI();
  updatePlayButton();
  setMoreOpen(false);
  els.pageInput.value = String(state.currentPage);
  buildBanisList();

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
    const SW_FIX = "sg-blink-fix-v9";
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

els.viewer.addEventListener("scroll", onScroll, { passive: true });
els.viewer.addEventListener("wheel", onUserScrollIntent, { passive: true });
els.viewer.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches && e.touches.length >= 2) {
      onPinchStart(e);
      return;
    }
    if (state.ignoreScrollPause) return;
    if (state.playing) pause();
  },
  { passive: true }
);
els.viewer.addEventListener("touchmove", onPinchMove, { passive: false });
els.viewer.addEventListener("touchend", onPinchEnd, { passive: true });
els.viewer.addEventListener("touchcancel", onPinchEnd, { passive: true });

els.viewer.addEventListener("click", (e) => {
  if (e.target.closest(".page-wrap") || e.target === els.viewer || e.target === els.pages) {
    if (!state.pdf) return;
    if (window.matchMedia("(pointer: fine)").matches) {
      togglePlay();
    }
  }
});

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
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
    e.preventDefault();
    state.speed = Math.min(5, state.speed + 1);
    updateSpeedUI();
    savePrefs();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
    e.preventDefault();
    state.speed = Math.max(1, state.speed - 1);
    updateSpeedUI();
    savePrefs();
  } else if (e.key === "b" || e.key === "B") {
    toggleBanis();
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
