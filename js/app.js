/**
 * Sundar Gutka Auto-Scroll Reader
 * PDF.js 6 + path auto-scroll + banis + zoom + theme + search + text mode
 */
import * as pdfjsLib from "../lib/pdf.min.mjs";

const PDF_URL = "assets/sundar-gutka.pdf";
const TEXT_INDEX_URL = "data/text-index.json";
const STORAGE_KEY = "sundar-gutka-reader-v2";
const PAGE_ASPECT = 2288 / 1425;
const RENDER_BUFFER = 3;
const MAX_DPR = 2;
const ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150, 175, 200];
const THEME_CYCLE = ["system", "day", "night"];
/** Reference page height (px) used when calibrating speed levels. */
const REF_PAGE_HEIGHT = 420;
/** Base px/sec at REF_PAGE_HEIGHT for speeds 1–10. */
const SPEED_TABLE = [0, 5, 8, 12, 17, 24, 33, 44, 57, 72, 90];

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
  textReader: document.getElementById("textReader"),
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
  btnMode: document.getElementById("btnMode"),
  modeLabel: document.getElementById("modeLabel"),
  btnSearch: document.getElementById("btnSearch"),
  searchPanel: document.getElementById("searchPanel"),
  searchBackdrop: document.getElementById("searchBackdrop"),
  btnCloseSearch: document.getElementById("btnCloseSearch"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchStatus: document.getElementById("searchStatus"),
  searchResults: document.getElementById("searchResults"),
};

const state = {
  pdf: null,
  numPages: 0,
  pageEls: [],
  textPages: null, // string[] | null
  speed: 3,
  zoom: 100,
  theme: "system",
  mode: "pdf", // pdf | text
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
};

function speedToPxPerSec(level) {
  const n = Math.min(10, Math.max(1, Number(level) || 1));
  return SPEED_TABLE[n];
}

function avgRenderedPageHeight() {
  if (state.mode === "text") {
    const sample = els.textReader.querySelector(".text-page");
    return sample ? sample.offsetHeight || REF_PAGE_HEIGHT : REF_PAGE_HEIGHT;
  }
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
  const zoomFactor = state.mode === "text" ? state.zoom / 100 : 1;
  return base * (pageH / REF_PAGE_HEIGHT) * zoomFactor;
}

// ——— Persistence ———

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("sundar-gutka-reader-v1");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.speed >= 1 && data.speed <= 10) state.speed = data.speed;
    if (data.page >= 1) state.currentPage = data.page;
    if (ZOOM_STEPS.indexOf(data.zoom) !== -1) state.zoom = data.zoom;
    if (data.theme === "day" || data.theme === "night" || data.theme === "system") {
      state.theme = data.theme;
    }
    if (data.mode === "pdf" || data.mode === "text") state.mode = data.mode;
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

function updateModeUI() {
  if (els.modeLabel) els.modeLabel.textContent = state.mode === "text" ? "Text" : "PDF";
  if (els.btnMode) {
    els.btnMode.title =
      state.mode === "text"
        ? "Switch to PDF page view (M)"
        : "Switch to reflow text view (M)";
  }
  document.documentElement.setAttribute("data-mode", state.mode);
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
  if (state.mode === "text") return getVisibleTextPage();
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

function getVisibleTextPage() {
  const nodes = els.textReader.querySelectorAll(".text-page");
  if (!nodes.length) return state.currentPage;
  const scrollMid = els.viewer.scrollTop + els.viewer.clientHeight * 0.35;
  let best = 1;
  let lo = 0;
  let hi = nodes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid].offsetTop <= scrollMid) lo = mid;
    else hi = mid - 1;
  }
  best = Number(nodes[lo].dataset.page) || 1;
  return best;
}

function onScroll() {
  if (state.ignoreScrollPause) {
    // Still update page number / renders during programmatic scroll
  }
  if (!state.numPages && state.mode === "pdf") return;
  const page = getVisiblePage();
  if (page !== state.currentPage) {
    updatePageUI(page);
    savePrefs();
    updateDeepLink();
  }
  if (state.mode === "pdf") scheduleVisibleRenders();
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

function getRenderWidth() {
  const pad = 16;
  const base = Math.max(280, (els.viewer.clientWidth || window.innerWidth) - pad);
  const w = Math.round(base * (state.zoom / 100));
  return Math.max(200, Math.min(w, 2000));
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
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    entry.wrap.style.width = cssWidth + "px";
    entry.wrap.style.maxWidth = cssWidth + "px";
    entry.wrap.style.aspectRatio = `${unscaled.width} / ${unscaled.height}`;

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
    const cssWidth = getRenderWidth();
    entry.wrap.style.width = cssWidth + "px";
    entry.wrap.style.maxWidth = cssWidth + "px";
    entry.wrap.style.aspectRatio = String(PAGE_ASPECT);
  }
}

function scheduleVisibleRenders() {
  if (!state.numPages || state.mode !== "pdf") return;
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
  if (ZOOM_STEPS.indexOf(z) === -1) {
    let best = ZOOM_STEPS[0];
    let bestD = Infinity;
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      const d = Math.abs(ZOOM_STEPS[i] - z);
      if (d < bestD) {
        bestD = d;
        best = ZOOM_STEPS[i];
      }
    }
    z = best;
  }
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
    if (state.mode === "text") {
      applyTextZoom();
      goToPage(pageBefore);
    } else {
      invalidateAllPages();
      goToPage(pageBefore);
      scheduleVisibleRenders();
    }
  }, 80);
}

function zoomIn() {
  const i = ZOOM_STEPS.indexOf(state.zoom);
  if (i < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[i + 1]);
}

function zoomOut() {
  const i = ZOOM_STEPS.indexOf(state.zoom);
  if (i > 0) setZoom(ZOOM_STEPS[i - 1]);
}

function buildPlaceholders() {
  els.pages.innerHTML = "";
  state.pageEls = [];
  const frag = document.createDocumentFragment();
  const cssWidth = getRenderWidth();
  for (let i = 1; i <= state.numPages; i++) {
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.dataset.page = String(i);
    wrap.style.aspectRatio = String(PAGE_ASPECT);
    wrap.style.width = cssWidth + "px";
    wrap.style.maxWidth = cssWidth + "px";
    wrap.setAttribute("aria-label", "Page " + i);

    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
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

// ——— Text mode ———

function applyTextZoom() {
  const px = Math.round(18 * (state.zoom / 100));
  els.textReader.style.fontSize = px + "px";
}

function baniForPage(page) {
  let current = BANIS[0];
  for (const b of BANIS) {
    if (page >= b.page) current = b;
    else break;
  }
  return current;
}

function buildTextReader() {
  if (!state.textPages) return;
  els.textReader.innerHTML = "";
  const frag = document.createDocumentFragment();
  let lastBani = null;
  for (let i = 0; i < state.textPages.length; i++) {
    const pageNum = i + 1;
    const bani = baniForPage(pageNum);
    if (!lastBani || lastBani.slug !== bani.slug) {
      const h = document.createElement("h2");
      h.className = "text-bani-title";
      h.id = "bani-" + bani.slug;
      h.textContent = bani.name;
      frag.appendChild(h);
      lastBani = bani;
    }
    const article = document.createElement("article");
    article.className = "text-page";
    article.dataset.page = String(pageNum);
    article.setAttribute("aria-label", "Page " + pageNum);

    const meta = document.createElement("div");
    meta.className = "text-page-meta";
    meta.textContent = "p. " + pageNum;
    article.appendChild(meta);

    const body = document.createElement("div");
    body.className = "text-page-body";
    body.textContent = state.textPages[i] || "";
    article.appendChild(body);

    frag.appendChild(article);
  }
  els.textReader.appendChild(frag);
  applyTextZoom();
}

function applyMode() {
  updateModeUI();
  const text = state.mode === "text";
  els.pages.classList.toggle("hidden", text);
  els.textReader.classList.toggle("hidden", !text);
  els.textReader.setAttribute("aria-hidden", text ? "false" : "true");
  if (text) {
    if (!els.textReader.childElementCount) buildTextReader();
    applyTextZoom();
  }
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

async function setMode(mode) {
  if (mode !== "pdf" && mode !== "text") return;
  if (mode === state.mode) {
    updateModeUI();
    return;
  }
  pause();
  const page = state.currentPage;
  state.mode = mode;
  try {
    if (mode === "text" && !state.textPages) {
      setStatus("Loading text…");
      await loadTextIndex();
      setStatus("");
    }
    if (mode === "pdf" && !state.pdf) {
      await ensurePdfLoaded();
    }
  } catch (err) {
    console.error(err);
    setStatus("Failed to switch mode. " + (err && err.message ? err.message : ""), true);
    state.mode = mode === "pdf" ? "text" : "pdf";
  }
  applyMode();
  savePrefs();
  requestAnimationFrame(() => {
    goToPage(page);
    if (state.mode === "pdf") scheduleVisibleRenders();
  });
}

function toggleMode() {
  setMode(state.mode === "pdf" ? "text" : "pdf");
}

// ——— Navigation ———

function goToPage(pageNum) {
  const n = Math.min(
    state.numPages || state.textPages?.length || 1,
    Math.max(1, Math.round(Number(pageNum) || 1))
  );

  withProgrammaticScroll(() => {
    state.scrollCarry = 0;
    if (state.mode === "text") {
      const node = els.textReader.querySelector('.text-page[data-page="' + n + '"]');
      if (node) els.viewer.scrollTop = Math.max(0, node.offsetTop - 8);
    } else {
      const entry = state.pageEls[n - 1];
      if (!entry) return;
      els.viewer.scrollTop = Math.max(0, entry.wrap.offsetTop - 8);
    }
    updatePageUI(n);
    savePrefs();
    updateDeepLink();
    if (state.mode === "pdf") scheduleVisibleRenders();
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
  closeSearch();
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

// ——— Search ———

async function loadTextIndex() {
  if (state.textPages) return state.textPages;
  const res = await fetch(TEXT_INDEX_URL);
  if (!res.ok) throw new Error("Could not load text index");
  const data = await res.json();
  state.textPages = data.pages || [];
  if (!state.numPages) state.numPages = state.textPages.length;
  return state.textPages;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function snippetAround(text, query, radius) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  let snip = text.slice(start, end).replace(/\s+/g, " ");
  if (start > 0) snip = "…" + snip;
  if (end < text.length) snip = snip + "…";
  const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
  return escapeHtml(snip).replace(re, "<mark>$1</mark>");
}

async function runSearch(query) {
  const q = (query || "").trim();
  if (!els.searchResults) return;
  els.searchResults.innerHTML = "";
  if (q.length < 2) {
    els.searchStatus.textContent = "Type at least 2 characters.";
    return;
  }
  els.searchStatus.textContent = "Searching…";
  try {
    await loadTextIndex();
  } catch (err) {
    els.searchStatus.textContent = "Search unavailable (text index missing).";
    return;
  }

  const ql = q.toLowerCase();
  const hits = [];
  for (let i = 0; i < state.textPages.length; i++) {
    const t = state.textPages[i] || "";
    if (t.toLowerCase().includes(ql)) {
      hits.push({ page: i + 1, text: t });
      if (hits.length >= 80) break;
    }
  }

  if (!hits.length) {
    els.searchStatus.textContent = "No matches for “" + q + "”.";
    return;
  }

  els.searchStatus.textContent =
    hits.length + (hits.length >= 80 ? "+" : "") + " match" + (hits.length === 1 ? "" : "es");

  const frag = document.createDocumentFragment();
  hits.forEach((hit) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-hit";
    btn.innerHTML =
      '<span class="search-hit-page">p. ' +
      hit.page +
      "</span>" +
      '<span class="search-hit-snip">' +
      snippetAround(hit.text, q, 42) +
      "</span>";
    btn.addEventListener("click", () => {
      closeSearch();
      pause();
      goToPage(hit.page);
    });
    frag.appendChild(btn);
  });
  els.searchResults.appendChild(frag);
}

function openSearch() {
  closeBanis();
  state.lastFocus = document.activeElement;
  els.searchPanel.classList.add("open");
  els.searchPanel.setAttribute("aria-hidden", "false");
  els.searchPanel.removeAttribute("inert");
  if (els.searchBackdrop) {
    els.searchBackdrop.hidden = false;
    els.searchBackdrop.classList.add("open");
  }
  if (els.btnSearch) els.btnSearch.setAttribute("aria-expanded", "true");
  els.searchInput?.focus();
  els.searchInput?.select();
  loadTextIndex().catch(() => {});
}

function closeSearch() {
  if (!els.searchPanel) return;
  els.searchPanel.classList.remove("open");
  els.searchPanel.setAttribute("aria-hidden", "true");
  els.searchPanel.setAttribute("inert", "");
  if (els.searchBackdrop) {
    els.searchBackdrop.classList.remove("open");
    els.searchBackdrop.hidden = true;
  }
  if (els.btnSearch) els.btnSearch.setAttribute("aria-expanded", "false");
  if (state.lastFocus && typeof state.lastFocus.focus === "function") {
    state.lastFocus.focus();
  } else {
    els.btnSearch?.focus();
  }
}

function toggleSearch() {
  if (els.searchPanel && els.searchPanel.classList.contains("open")) closeSearch();
  else openSearch();
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
    if (state.mode === "pdf") scheduleVisibleRenders();
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
  if (state.mode === "pdf" && !state.pdf) return;
  if (state.mode === "text" && !state.textPages) return;
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
    const page = state.currentPage;
    if (state.mode === "pdf") {
      invalidateAllPages();
      goToPage(page);
      scheduleVisibleRenders();
    } else {
      applyTextZoom();
      goToPage(page);
    }
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
  updateModeUI();
  els.pageInput.value = String(state.currentPage);
  buildBanisList();

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "../lib/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  // Prefetch text index in background (search / text mode)
  loadTextIndex().catch(() => {});

  if (state.mode === "text") {
    setStatus("Loading text…");
    try {
      await loadTextIndex();
      state.numPages = state.textPages.length;
      els.pageTotal.textContent = "/ " + state.numPages;
      els.pageInput.max = String(state.numPages);
      applyMode();
      setStatus("");
      const startPage = Math.min(state.numPages, Math.max(1, state.currentPage));
      requestAnimationFrame(() => goToPage(startPage));
    } catch (err) {
      console.error(err);
      state.mode = "pdf";
      applyMode();
    }
  }

  if (state.mode === "pdf") {
    try {
      await ensurePdfLoaded();
      applyMode();
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
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js?v=5")
      .then(function (reg) {
        reg.update().catch(function () {});
        // If a new worker is waiting, activate it immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.addEventListener("updatefound", function () {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", function () {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(function (err) {
        console.warn("SW register failed", err);
      });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Reload once when the new SW takes control
      if (window.__sgReloadedForSw) return;
      window.__sgReloadedForSw = true;
      window.location.reload();
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
if (els.btnMode) els.btnMode.addEventListener("click", toggleMode);

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

if (els.btnSearch) els.btnSearch.addEventListener("click", toggleSearch);
if (els.btnCloseSearch) els.btnCloseSearch.addEventListener("click", closeSearch);
if (els.searchBackdrop) els.searchBackdrop.addEventListener("click", closeSearch);
if (els.searchForm) {
  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch(els.searchInput.value);
  });
}

els.viewer.addEventListener("scroll", onScroll, { passive: true });
els.viewer.addEventListener("wheel", onUserScrollIntent, { passive: true });
els.viewer.addEventListener(
  "touchstart",
  () => {
    if (state.ignoreScrollPause) return;
    if (state.playing) pause();
  },
  { passive: true }
);

els.viewer.addEventListener("click", (e) => {
  if (e.target.closest(".page-wrap") || e.target.closest(".text-page") || e.target === els.viewer || e.target === els.pages || e.target === els.textReader) {
    if (state.mode === "pdf" && !state.pdf) return;
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
  if (e.target === els.pageInput || e.target === els.searchInput || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
    if (e.key === "Escape") {
      closeBanis();
      closeSearch();
    }
    return;
  }

  if (e.key === "Escape") {
    closeBanis();
    closeSearch();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
    e.preventDefault();
    state.speed = Math.min(10, state.speed + 1);
    updateSpeedUI();
    savePrefs();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
    e.preventDefault();
    state.speed = Math.max(1, state.speed - 1);
    updateSpeedUI();
    savePrefs();
  } else if (e.key === "b" || e.key === "B") {
    toggleBanis();
  } else if (e.key === "f" || e.key === "F" || ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K"))) {
    e.preventDefault();
    toggleSearch();
  } else if (e.key === "m" || e.key === "M") {
    toggleMode();
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
