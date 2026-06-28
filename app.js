/**
 * PDF Shelf — Premium PWA JavaScript
 * Preserves all original features + adds PWA, keyboard shortcuts,
 * drag & drop, touch gestures, localStorage persistence, install prompt.
 */

'use strict';

// ── PDF.js setup ──────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── DOM refs ──────────────────────────────────────────────────
const fileInput     = document.getElementById('fileInput');
const tabstrip      = document.getElementById('tabstrip');
const viewerWrap    = document.getElementById('viewerWrap');
const pdfCanvas     = document.getElementById('pdfCanvas');
const emptyState    = document.getElementById('emptyState');
const toolbar       = document.getElementById('toolbar');
const pageInfo      = document.getElementById('pageInfo');
const zoomLabel     = document.getElementById('zoomLabel');
const countLabel    = document.getElementById('countLabel');
const splash        = document.getElementById('splash');
const installBanner = document.getElementById('installBanner');
const installBtn    = document.getElementById('installBtn');
const installDismiss = document.getElementById('installDismiss');
const dropOverlay   = document.getElementById('dropOverlay');
const settingsBtn   = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsClose = document.getElementById('settingsClose');
const toastEl       = document.getElementById('toast');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const zoomIn        = document.getElementById('zoomIn');
const zoomOut       = document.getElementById('zoomOut');
const resetZoom     = document.getElementById('resetZoom');

// ── State ─────────────────────────────────────────────────────
let docs     = [];       // { id, name, pdf, numPages, page, scale, arrayBuffer }
let activeId = null;
let isRendering = false;
let renderPending = false;
let deferredInstallPrompt = null;
let toastTimer = null;

// ── Splash ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Minimum splash duration for feel
  setTimeout(() => {
    splash.classList.add('hidden');
  }, 1800);
});

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Update available — reload to apply');
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── PWA Install Prompt ─────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('pwa-installed') && !localStorage.getItem('pwa-dismissed')) {
    installBanner.classList.remove('hidden');
  }
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  installBanner.classList.add('hidden');
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', '1');
    showToast('PDF Shelf installed successfully!');
  }
  deferredInstallPrompt = null;
});

installDismiss.addEventListener('click', () => {
  installBanner.classList.add('hidden');
  localStorage.setItem('pwa-dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.add('hidden');
  deferredInstallPrompt = null;
  localStorage.setItem('pwa-installed', '1');
});

// ── File Opening ──────────────────────────────────────────────
document.getElementById('addBtnTop').addEventListener('click', () => fileInput.click());
document.getElementById('addBtnEmpty').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  await openFiles(files);
  fileInput.value = '';
});

async function openFiles(files) {
  const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) {
    showToast('Please select PDF files only');
    return;
  }
  for (const file of pdfs) {
    await openFile(file);
  }
}

async function openFile(file) {
  // Check for duplicate by name
  const existing = docs.find(d => d.name === file.name.replace(/\.pdf$/i, ''));
  if (existing) {
    setActive(existing.id);
    showToast(`"${existing.name}" is already open`);
    return;
  }

  const id = 'd' + Date.now() + Math.random().toString(36).slice(2, 7);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

    // Restore saved page/zoom if available
    const saved = getSavedDocState(file.name.replace(/\.pdf$/i, ''));

    const entry = {
      id,
      name: file.name.replace(/\.pdf$/i, ''),
      pdf,
      numPages: pdf.numPages,
      page: saved.page || 1,
      scale: saved.scale || 1.0,
      arrayBuffer
    };
    docs.push(entry);
    renderTabs();
    setActive(id);
    saveState();
  } catch (err) {
    console.error(err);
    showToast(`Could not open "${file.name}"`);
  }
}

// ── Tabs ──────────────────────────────────────────────────────
function renderTabs() {
  tabstrip.innerHTML = '';
  docs.forEach(d => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (d.id === activeId ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', d.id === activeId ? 'true' : 'false');
    tab.setAttribute('aria-label', d.name);
    tab.tabIndex = 0;

    tab.innerHTML = `
      <svg class="tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
      <span class="tab-name" title="${escHtml(d.name)}">${escHtml(d.name)}</span>
      <button class="tab-close" aria-label="Close ${escHtml(d.name)}">×</button>
    `;

    tab.addEventListener('click', (ev) => {
      if (ev.target.closest('.tab-close')) return;
      setActive(d.id);
    });
    tab.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setActive(d.id);
      }
    });
    tab.querySelector('.tab-close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeDoc(d.id);
    });

    tabstrip.appendChild(tab);
  });

  // Update count badge
  if (docs.length > 0) {
    countLabel.textContent = docs.length + ' open';
    countLabel.classList.add('visible');
  } else {
    countLabel.textContent = '';
    countLabel.classList.remove('visible');
  }

  // Scroll active tab into view
  const activeTab = tabstrip.querySelector('.tab.active');
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function closeDoc(id) {
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return;

  // Animate out
  const tabs = tabstrip.querySelectorAll('.tab');
  if (tabs[idx]) tabs[idx].classList.add('closing');

  setTimeout(() => {
    try { docs[idx].pdf.destroy(); } catch (e) { /* ignore */ }
    docs.splice(idx, 1);

    if (activeId === id) {
      activeId = docs.length ? docs[Math.max(0, idx - 1)].id : null;
    }
    renderTabs();
    if (activeId) {
      renderPage();
    } else {
      showEmpty();
    }
    saveState();
  }, 180);
}

// ── Active / Render ───────────────────────────────────────────
function setActive(id) {
  activeId = id;
  renderTabs();
  showViewer();
  renderPage();
  saveState();
}

function showEmpty() {
  emptyState.style.display = 'flex';
  viewerWrap.style.display = 'none';
  toolbar.style.display = 'none';
}

function showViewer() {
  emptyState.style.display = 'none';
  viewerWrap.style.display = 'flex';
  toolbar.style.display = 'block';
}

function currentDoc() {
  return docs.find(d => d.id === activeId);
}

let renderTask = null;

async function renderPage() {
  const entry = currentDoc();
  if (!entry) return;

  if (isRendering) {
    renderPending = true;
    if (renderTask) {
      try { renderTask.cancel(); } catch (e) { /* ignore */ }
    }
    return;
  }

  isRendering = true;
  viewerWrap.classList.add('rendering');

  try {
    const page = await entry.pdf.getPage(entry.page);
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x for perf
    const availW = viewerWrap.clientWidth - 32;
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = Math.min(availW / baseViewport.width, 1.4);
    const viewport = page.getViewport({ scale: entry.scale * fitScale });

    pdfCanvas.width  = Math.floor(viewport.width * dpr);
    pdfCanvas.height = Math.floor(viewport.height * dpr);
    pdfCanvas.style.width  = viewport.width + 'px';
    pdfCanvas.style.height = viewport.height + 'px';

    const ctx = pdfCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    pageInfo.textContent = entry.page + ' / ' + entry.numPages;
    zoomLabel.textContent = Math.round(entry.scale * 100) + '%';
    prevBtn.disabled = entry.page <= 1;
    nextBtn.disabled = entry.page >= entry.numPages;

    viewerWrap.classList.remove('rendering');
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('Render error:', err);
    }
    viewerWrap.classList.remove('rendering');
  } finally {
    isRendering = false;
    renderTask = null;
    if (renderPending) {
      renderPending = false;
      await renderPage();
    }
  }
}

// ── Page / Zoom Controls ──────────────────────────────────────
prevBtn.addEventListener('click', () => changePage(-1));
nextBtn.addEventListener('click', () => changePage(1));
zoomIn.addEventListener('click', () => changeZoom(0.2));
zoomOut.addEventListener('click', () => changeZoom(-0.2));
resetZoom.addEventListener('click', () => {
  const entry = currentDoc();
  if (!entry) return;
  entry.scale = 1.0;
  renderPage();
  saveState();
});

function changePage(delta) {
  const entry = currentDoc();
  if (!entry) return;
  const next = entry.page + delta;
  if (next < 1 || next > entry.numPages) return;
  entry.page = next;
  renderPage();
  saveState();
  // Scroll to top of viewer
  viewerWrap.scrollTop = 0;
}

function changeZoom(delta) {
  const entry = currentDoc();
  if (!entry) return;
  entry.scale = Math.min(4.0, Math.max(0.4, +(entry.scale + delta).toFixed(2)));
  renderPage();
  saveState();
}

// ── Keyboard Shortcuts ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Close modal
  if (e.key === 'Escape') {
    if (!settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
      return;
    }
  }

  // Don't intercept when typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key === 'o') {
    e.preventDefault();
    fileInput.click();
    return;
  }
  if (ctrl && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    changeZoom(0.2);
    return;
  }
  if (ctrl && e.key === '-') {
    e.preventDefault();
    changeZoom(-0.2);
    return;
  }
  if (ctrl && e.key === '0') {
    e.preventDefault();
    const entry = currentDoc();
    if (entry) { entry.scale = 1.0; renderPage(); saveState(); }
    return;
  }

  if (!currentDoc()) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      changePage(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      changePage(1);
      break;
    case ' ':
      e.preventDefault();
      if (e.shiftKey) changePage(-1);
      else changePage(1);
      break;
    case 'Delete':
    case 'Backspace':
      if (e.shiftKey && activeId) closeDoc(activeId);
      break;
  }
});

// ── Touch Gestures ────────────────────────────────────────────
let touchStartX = null;
let touchStartY = null;
let touchStartDist = null;
let touchStartScale = 1;

viewerWrap.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    // Pinch start
    touchStartDist = getTouchDist(e.touches);
    touchStartScale = currentDoc()?.scale || 1;
  } else if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

viewerWrap.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && touchStartDist !== null) {
    const dist = getTouchDist(e.touches);
    const ratio = dist / touchStartDist;
    const entry = currentDoc();
    if (entry) {
      entry.scale = Math.min(4.0, Math.max(0.4, +(touchStartScale * ratio).toFixed(2)));
      zoomLabel.textContent = Math.round(entry.scale * 100) + '%';
    }
  }
}, { passive: true });

viewerWrap.addEventListener('touchend', (e) => {
  if (touchStartDist !== null) {
    touchStartDist = null;
    renderPage();
    saveState();
    return;
  }
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
  if (Math.abs(dx) > 70 && dy < 60) {
    changePage(dx < 0 ? 1 : -1);
  }
  touchStartX = null;
  touchStartY = null;
}, { passive: true });

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Drag & Drop ───────────────────────────────────────────────
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  if ([...e.dataTransfer.items].some(i => i.type === 'application/pdf' || i.kind === 'file')) {
    dragCounter++;
    dropOverlay.classList.remove('hidden');
  }
});

document.addEventListener('dragleave', (e) => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.add('hidden');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');
  const files = [...e.dataTransfer.files];
  await openFiles(files);
});

// ── Settings Modal ────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
settingsClose.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});
settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// ── Resize ────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentDoc()) renderPage();
  }, 200);
});

// ── LocalStorage State ────────────────────────────────────────
function saveState() {
  try {
    const state = {
      activeId,
      docs: docs.map(d => ({
        id: d.id,
        name: d.name,
        page: d.page,
        scale: d.scale
      }))
    };
    localStorage.setItem('pdfshelf-state', JSON.stringify(state));
  } catch (e) { /* quota exceeded */ }
}

function getSavedDocState(name) {
  try {
    const raw = localStorage.getItem('pdfshelf-state');
    if (!raw) return {};
    const state = JSON.parse(raw);
    const found = state.docs?.find(d => d.name === name);
    return found || {};
  } catch (e) { return {}; }
}

// ── Utility ───────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Init ──────────────────────────────────────────────────────
showEmpty();
