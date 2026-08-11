/**
 * Sundar Gutka Auto-Scroll Reader
 * PDF.js + slow path auto-scroll (1–10) + banis menu + PWA hooks
 */
(function () {
  "use strict";

  const PDF_URL = "assets/sundar-gutka.pdf";
  const STORAGE_KEY = "sundar-gutka-reader-v2";
  const PAGE_ASPECT = 2288 / 1425;
  const RENDER_BUFFER = 3;
  const MAX_DPR = 2;

  /**
   * Speed 1–10 → pixels/second (path-friendly, much slower than v1).
   * Fractional pixels are accumulated so levels 1–2 still move.
   *
   * 1 ≈ 5 px/s   very slow path
   * 3 ≈ 14 px/s  comfortable default
   * 5 ≈ 30 px/s  medium
   * 10 ≈ 90 px/s faster review
   */
  function speedToPxPerSec(level) {
    const n = Math.min(10, Math.max(1, Number(level) || 1));
    // Gentle curve: 5, 8, 12, 17, 24, 33, 44, 57, 72, 90
    const table = [0, 5, 8, 12, 17, 24, 33, 44, 57, 72, 90];
    return table[n];
  }

  /** Banis from Damdami Taksal Sundar Gutka table of contents (PDF page numbers). */
  const BANIS = [
    { name: "Japji Sahib", page: 11 },
    { name: "Jaap Sahib", page: 32 },
    { name: "Tav Prasad Savaiye", page: 61 },
    { name: "Chaupai Sahib", page: 66 },
    { name: "Anand Sahib", page: 74 },
    { name: "Shabad Hazare", page: 91 },
    { name: "Barah Maha Majh", page: 101 },
    { name: "Shabad Hazare Patshahi 10", page: 111 },
    { name: "Savaiye Deenan", page: 120 },
    { name: "Rehras Sahib", page: 124 },
    { name: "Ardas", page: 156 },
    { name: "Aarti", page: 163 },
    { name: "Rakhya De Shabad", page: 169 },
    { name: "Kirtan Sohila", page: 172 },
    { name: "Bavan Akhri", page: 177 },
    { name: "Sukhmani Sahib", page: 212 },
    { name: "Asa Di Var", page: 312 },
    { name: "Dakhni Oankar", page: 362 },
    { name: "Sidh Gosht", page: 385 },
    { name: "Ramkali Ki Var", page: 410 },
    { name: "Basant Ki Var", page: 417 },
    { name: "Barah Maha Tukhari", page: 419 },
    { name: "Laavan", page: 428 },
    { name: "Salok Mehla 9", page: 431 },
    { name: "Chandi Di Var", page: 441 },
    { name: "Raag Mala", page: 471 },
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
  };

  const state = {
    pdf: null,
    numPages: 0,
    pageEls: [],
    speed: 3,
    playing: false,
    currentPage: 1,
    rafId: null,
    lastTs: 0,
    scrollCarry: 0, // fractional pixel accumulator — fixes speed 1–2
    wakeLock: null,
    ignoreScrollPause: false,
    scrollPauseTimer: null,
    resizeTimer: null,
  };

  // ——— Persistence ———

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("sundar-gutka-reader-v1");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.speed >= 1 && data.speed <= 10) state.speed = data.speed;
      if (data.page >= 1) state.currentPage = data.page;
    } catch (_) {
      /* ignore */
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ speed: state.speed, page: state.currentPage })
      );
    } catch (_) {
      /* ignore */
    }
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

  // ——— Visible page ———

  function getVisiblePage() {
    const viewerRect = els.viewer.getBoundingClientRect();
    const midY = viewerRect.top + viewerRect.height * 0.35;
    let best = 1;
    let bestDist = Infinity;
    for (let i = 0; i < state.pageEls.length; i++) {
      const rect = state.pageEls[i].wrap.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - midY);
      if (dist < bestDist) {
        bestDist = dist;
        best = i + 1;
      }
    }
    return best;
  }

  function onScroll() {
    if (!state.numPages) return;
    const page = getVisiblePage();
    if (page !== state.currentPage) {
      updatePageUI(page);
      savePrefs();
    }
    scheduleVisibleRenders();
  }

  function onUserScrollIntent() {
    if (state.playing) pause();
  }

  // ——— Render ———

  function getRenderWidth() {
    const pad = 16;
    const w = (els.viewer.clientWidth || window.innerWidth) - pad;
    return Math.max(280, Math.min(w, 960));
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
      canvas.style.width = cssWidth + "px";
      canvas.style.height = Math.floor(unscaled.height * scale) + "px";
      entry.wrap.style.aspectRatio = `${unscaled.width} / ${unscaled.height}`;

      const renderTask = page.render({
        canvasContext: ctx,
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

  function buildPlaceholders() {
    els.pages.innerHTML = "";
    state.pageEls = [];
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= state.numPages; i++) {
      const wrap = document.createElement("div");
      wrap.className = "page-wrap";
      wrap.dataset.page = String(i);
      wrap.style.aspectRatio = String(PAGE_ASPECT);
      wrap.setAttribute("aria-label", "Page " + i);

      const canvas = document.createElement("canvas");
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

  // ——— Navigation ———

  function goToPage(pageNum) {
    const n = Math.min(state.numPages, Math.max(1, Math.round(Number(pageNum) || 1)));
    const entry = state.pageEls[n - 1];
    if (!entry) return;

    state.ignoreScrollPause = true;
    state.scrollCarry = 0;
    els.viewer.scrollTop = Math.max(0, entry.wrap.offsetTop - 8);
    updatePageUI(n);
    savePrefs();
    scheduleVisibleRenders();

    window.clearTimeout(state.scrollPauseTimer);
    state.scrollPauseTimer = window.setTimeout(() => {
      state.ignoreScrollPause = false;
    }, 150);
  }

  // ——— Banis menu ———

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
    els.banisDrawer.classList.add("open");
    els.banisDrawer.setAttribute("aria-hidden", "false");
    if (els.banisBackdrop) els.banisBackdrop.classList.add("open");
    if (els.btnBanis) els.btnBanis.setAttribute("aria-expanded", "true");
  }

  function closeBanis() {
    if (!els.banisDrawer) return;
    els.banisDrawer.classList.remove("open");
    els.banisDrawer.setAttribute("aria-hidden", "true");
    if (els.banisBackdrop) els.banisBackdrop.classList.remove("open");
    if (els.btnBanis) els.btnBanis.setAttribute("aria-expanded", "false");
  }

  function toggleBanis() {
    if (els.banisDrawer && els.banisDrawer.classList.contains("open")) closeBanis();
    else openBanis();
  }

  // ——— Auto-scroll (fractional carry = slow speeds work) ———

  function tick(ts) {
    if (!state.playing) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(64, ts - state.lastTs);
    state.lastTs = ts;

    const pxPerSec = speedToPxPerSec(state.speed);
    state.scrollCarry += (pxPerSec * dt) / 1000;

    // Browsers often ignore sub-pixel scrollTop — only apply whole pixels
    const step = Math.floor(state.scrollCarry);
    if (step >= 1) {
      state.ignoreScrollPause = true;
      const maxScroll = els.viewer.scrollHeight - els.viewer.clientHeight;
      const next = Math.min(maxScroll, els.viewer.scrollTop + step);
      els.viewer.scrollTop = next;
      state.scrollCarry -= step;

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
      }
      scheduleVisibleRenders();
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (!state.pdf || state.playing) return;
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
      for (const entry of state.pageEls) {
        if (entry.rendered || entry.rendering) clearCanvas(entry);
      }
      scheduleVisibleRenders();
    }, 200);
  }

  // ——— Init ———

  async function init() {
    loadPrefs();
    updateSpeedUI();
    updatePlayButton();
    els.pageInput.value = String(state.currentPage);
    buildBanisList();

    if (typeof pdfjsLib === "undefined") {
      setStatus("Could not load PDF library. Check lib/pdf.min.js", true);
      return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
    setStatus("Loading Sundar Gutka…");

    try {
      const loadingTask = pdfjsLib.getDocument({
        url: PDF_URL,
        useSystemFonts: false,
        disableFontFace: false,
      });
      state.pdf = await loadingTask.promise;
      state.numPages = state.pdf.numPages;
      els.pageTotal.textContent = "/ " + state.numPages;
      els.pageInput.max = String(state.numPages);
      els.pageInput.min = "1";

      buildPlaceholders();
      setStatus("");

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

    // Register service worker for offline / install
    if ("serviceWorker" in navigator) {
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

  els.viewer.addEventListener("scroll", onScroll, { passive: true });
  els.viewer.addEventListener("wheel", onUserScrollIntent, { passive: true });
  els.viewer.addEventListener(
    "touchstart",
    () => {
      if (state.playing) pause();
    },
    { passive: true }
  );

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

  document.addEventListener("keydown", (e) => {
    if (e.target === els.pageInput || e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
      return;

    if (e.key === "Escape") {
      closeBanis();
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
    }
  });

  window.addEventListener("pagehide", savePrefs);

  init();
})();
