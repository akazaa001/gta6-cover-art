// Wires the cover maker: the photo library, the layout/grade/caption controls, dragging a photo inside
// its panel, and exporting the cover as a PNG in the three post sizes. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).

import { drawCover, panelCount, panelRects, LAYOUTS, GRADES, CAPTION_COLOURS } from './cover.js';
import { runShot } from './shots.js';

/** The three post sizes the maker exports, in menu order. */
export const EXPORT_SIZES = [
  { id: 'square', name: 'Square · 1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Portrait · 1080 x 1350', w: 1080, h: 1350 },
  { id: 'landscape', name: 'Landscape · 1920 x 1080', w: 1920, h: 1080 },
];

/** A blank panel: no photo yet, shown as a placeholder until one is assigned. */
function blankPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0 };
}

/** The maker's state: nine panel slots (every layout uses a prefix of them), the active photo and panel. */
const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'Sunset Heist',
  subcaption: 'welcome to the coast',
  captionColor: '#ffffff',
  captionPosition: 'bottom',
  exportSize: 'square',
  panels: Array.from({ length: 9 }, blankPanel),
  photos: [],
  activePhoto: -1,
  selectedPanel: 0,
};

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const status = $('status');

/** The preview canvas's backing size for the chosen export size: longest side 900. */
function previewSize() {
  const size = EXPORT_SIZES.find((s) => s.id === state.exportSize) ?? EXPORT_SIZES[0];
  const scale = 900 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

/** Repaints the preview canvas from the state, at the preview size. */
export function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, state);
  drawSelection(ctx, w, h);
  $('zoom').value = String((state.panels[state.selectedPanel]?.zoom ?? 1));
  $('panx').value = String((state.panels[state.selectedPanel]?.ox ?? 0));
  $('pany').value = String((state.panels[state.selectedPanel]?.oy ?? 0));
}

/** Outlines the selected panel on the preview so the pan and zoom sliders have a visible target. */
function drawSelection(ctx, W, H) {
  const rects = panelRects(state.layout, W, H);
  const rect = rects[state.selectedPanel];
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = '#ffe95e';
  ctx.lineWidth = Math.max(2, W * 0.006);
  ctx.setLineDash([Math.max(6, W * 0.012), Math.max(4, W * 0.008)]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Adds a loaded image to the library strip and makes it the active photo. */
function addPhoto(img, name) {
  state.photos.push({ img, name });
  state.activePhoto = state.photos.length - 1;
  renderLibrary();
}

/** Rebuilds the photo library strip: one thumbnail per photo, the active one marked. */
function renderLibrary() {
  const strip = $('library');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb' + (i === state.activePhoto ? ' active' : '');
    button.title = `${photo.name} — click to paint panels with it`;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    button.appendChild(thumb);
    button.addEventListener('click', () => {
      state.activePhoto = i;
      renderLibrary();
      setStatus(`${photo.name} is the active photo — click a panel to paint it in.`);
    });
    strip.appendChild(button);
  });
  $('fillall').disabled = state.activePhoto < 0;
}

/** Paints the active photo into every panel of the current layout. */
function fillAllPanels() {
  if (state.activePhoto < 0) return;
  const photo = state.photos[state.activePhoto].img;
  for (let i = 0; i < panelCount(state.layout); i++) {
    state.panels[i] = { photo, zoom: 1, ox: 0, oy: 0 };
  }
  redraw();
  setStatus('Every panel now uses the active photo.');
}

/** Loads the three sample photos into the library and paints them across the panels. */
async function loadSamples() {
  const names = ['pier', 'boulevard', 'neon'];
  for (const name of names) {
    if (state.photos.some((p) => p.name === name)) continue;
    try {
      addPhoto(await loadImage(`samples/${name}.jpg`), name);
    } catch {
      // A missing sample just means fewer photos to paint with; the maker still works.
    }
  }
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    const photo = state.photos[i % Math.max(1, state.photos.length)];
    if (photo) state.panels[i] = { photo: photo.img, zoom: 1, ox: 0, oy: 0 };
  }
  renderLibrary();
  redraw();
}

/** Reads files the user picked from their machine into the library, never uploading them. */
async function loadUserFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      addPhoto(await loadImage(URL.createObjectURL(file)), file.name.replace(/\.[^.]+$/, ''));
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  redraw();
}

/** Which panel of the preview the point (in canvas pixels) falls in, or -1. */
function panelAt(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

/** A click on the preview: paints the active photo into the panel, or selects a panel already filled. */
function onCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = panelAt(x, y);
  if (i < 0) return;
  state.selectedPanel = i;
  if (state.activePhoto >= 0) {
    const panel = state.panels[i];
    panel.photo = state.photos[state.activePhoto].img;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    setStatus(`Panel ${i + 1} painted with ${state.photos[state.activePhoto].name}.`);
  }
  redraw();
}

/** Dragging on the preview pans the selected panel's photo inside its panel. */
let drag = null;
function onCanvasDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = panelAt(x, y);
  if (i < 0) return;
  state.selectedPanel = i;
  const panel = state.panels[i];
  if (!panel.photo) return;
  drag = { x, y, ox: panel.ox, oy: panel.oy, w: canvas.width, h: canvas.height };
  canvas.setPointerCapture(e.pointerId);
  redraw();
}
function onCanvasMove(e) {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const panel = state.panels[state.selectedPanel];
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const r = rects[state.selectedPanel];
  if (!panel || !r) return;
  panel.ox = Math.max(-1, Math.min(1, drag.ox + ((x - drag.x) / r.w) * 2));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + ((y - drag.y) / r.h) * 2));
  redraw();
}
function onCanvasUp() {
  drag = null;
}

/** The mouse wheel over the preview zooms the selected panel's photo. */
function onCanvasWheel(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = panelAt(x, y);
  if (i < 0) return;
  e.preventDefault();
  state.selectedPanel = i;
  const panel = state.panels[i];
  if (!panel.photo) return;
  panel.zoom = Math.max(0.5, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}

/** Renders the cover at full export size and downloads it as a PNG. */
function exportCover(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), size.w, size.h, state);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved cover-${size.w}x${size.h}.png`);
  }, 'image/png');
}

/** The status line under the export buttons. */
function setStatus(text) {
  status.textContent = text;
}

/** Builds the layout, grade, colour and size button rows from the renderer's own lists. */
function buildOptionRows() {
  const layoutRow = $('layouts');
  for (const layout of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.name;
    b.dataset.id = layout.id;
    b.addEventListener('click', () => {
      state.layout = layout.id;
      state.selectedPanel = 0;
      markActive(layoutRow, layout.id);
      redraw();
    });
    layoutRow.appendChild(b);
  }
  const gradeRow = $('grades');
  for (const grade of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = grade.name;
    b.dataset.id = grade.id;
    b.addEventListener('click', () => {
      state.grade = grade.id;
      markActive(gradeRow, grade.id);
      redraw();
    });
    gradeRow.appendChild(b);
  }
  const colourRow = $('colours');
  for (const colour of CAPTION_COLOURS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = colour;
    b.dataset.id = colour;
    b.setAttribute('aria-label', `Caption colour ${colour}`);
    b.addEventListener('click', () => {
      state.captionColor = colour;
      markActive(colourRow, colour);
      redraw();
    });
    colourRow.appendChild(b);
  }
  const sizeRow = $('sizes');
  for (const size of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = size.name;
    b.dataset.id = size.id;
    b.addEventListener('click', () => {
      state.exportSize = size.id;
      markActive(sizeRow, size.id);
      redraw();
    });
    sizeRow.appendChild(b);
  }
  markActive(layoutRow, state.layout);
  markActive(gradeRow, state.grade);
  markActive(colourRow, state.captionColor);
  markActive(sizeRow, state.exportSize);
}

/** Marks one button of a row active and the rest plain. */
function markActive(row, id) {
  for (const b of row.querySelectorAll('button')) b.classList.toggle('active', b.dataset.id === id);
}

/** Wires every control on the page. */
function wireControls() {
  $('photo').addEventListener('change', (e) => loadUserFiles([...e.target.files]));
  $('samples').addEventListener('click', loadSamples);
  $('fillall').addEventListener('click', fillAllPanels);
  $('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    redraw();
  });
  $('subcaption').addEventListener('input', (e) => {
    state.subcaption = e.target.value;
    redraw();
  });
  $('captiontop').addEventListener('click', () => {
    state.captionPosition = state.captionPosition === 'top' ? 'bottom' : 'top';
    $('captiontop').textContent = state.captionPosition === 'top' ? 'Caption: top' : 'Caption: bottom';
    redraw();
  });
  $('zoom').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].zoom = Number(e.target.value);
    redraw();
  });
  $('panx').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].ox = Number(e.target.value);
    redraw();
  });
  $('pany').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].oy = Number(e.target.value);
    redraw();
  });
  $('export').addEventListener('click', () => {
    const size = EXPORT_SIZES.find((s) => s.id === state.exportSize) ?? EXPORT_SIZES[0];
    exportCover(size);
  });
  $('exportall').addEventListener('click', () => {
    for (const size of EXPORT_SIZES) exportCover(size);
  });
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('pointerdown', onCanvasDown);
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerup', onCanvasUp);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
}

/** Waits until the two display faces are ready to draw, so the first paint is already lettered. */
async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // The system faces still draw; the cover just loses its display lettering.
  }
}

buildOptionRows();
wireControls();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSamples,
    loadImage,
    setState(next) {
      Object.assign(state, next);
    },
    redraw,
    state,
  });
} else {
  fontsReady().then(() => redraw());
  loadSamples();
}
