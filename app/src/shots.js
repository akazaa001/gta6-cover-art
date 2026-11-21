// Fixed scenes for screenshots: ?shot=editor shows the maker with sample photos loaded;
// ?shot=cover shows the cover alone, drawn by the app itself at the window's size, in the size, layout and
// grade the query names. window.__shotReady is set once the scene is painted.

import { drawCover } from './cover.js';

/** The sample photos, in the order the scenes cycle through them. */
const SAMPLE_ORDER = ['pier', 'boulevard', 'neon'];

/**
 * Runs a shot scene. `api` is the maker's wiring: loadSamples, loadImage, setState, redraw and state.
 * `query` carries photo, caption, subcaption, layout, grade, size and fill.
 */
export async function runShot(shot, query, api) {
  const canvas = document.getElementById('cover');
  await Promise.all([
    document.fonts.load('80px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]).catch(() => {});
  await api.loadSamples();

  const caption = query.get('caption') ?? 'Sunset Heist';
  const subcaption = query.get('subcaption') ?? 'welcome to the coast';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  api.setState({ caption, subcaption, layout, grade, captionPosition: 'bottom' });
  document.getElementById('caption').value = caption;
  document.getElementById('subcaption').value = subcaption;

  const chosen = query.get('photo') ?? 'pier';
  const photos = api.state.photos;
  const byName = (name) => photos.find((p) => p.name === name);
  const order = [byName(chosen), ...SAMPLE_ORDER.map(byName).filter((p) => p && p.name !== chosen)];
  const n = api.state.panels.length;
  if (query.get('fill') === 'one') {
    // One photo across every panel, each panel cropped differently: the maker's one-photo fill.
    const photo = byName(chosen) ?? photos[0];
    const crops = [
      { zoom: 1, ox: 0, oy: 0 },
      { zoom: 1.6, ox: -0.45, oy: -0.2 },
      { zoom: 1.6, ox: 0.45, oy: 0.25 },
      { zoom: 2.1, ox: 0, oy: -0.35 },
      { zoom: 1.4, ox: -0.3, oy: 0.4 },
      { zoom: 1.8, ox: 0.35, oy: -0.3 },
      { zoom: 1.5, ox: 0, oy: 0.4 },
      { zoom: 2.2, ox: -0.4, oy: 0 },
      { zoom: 1.3, ox: 0.4, oy: 0.3 },
    ];
    for (let i = 0; i < n; i++) {
      if (photo) api.state.panels[i] = { photo: photo.img, ...crops[i % crops.length] };
    }
  } else {
    for (let i = 0; i < n; i++) {
      const photo = order[i % Math.max(1, order.length)];
      if (photo) api.state.panels[i] = { photo: photo.img, zoom: 1, ox: 0, oy: 0 };
    }
  }

  if (shot === 'cover') {
    // The cover alone, drawn at the window's own size: the screenshot is the app's own drawing.
    document.body.classList.add('shot-cover');
    const size = query.get('size') ?? 'square';
    api.setState({ exportSize: size });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCover(canvas.getContext('2d'), canvas.width, canvas.height, api.state);
  } else {
    // The editor, compacted so its whole control column fits the screenshot frame.
    document.body.classList.add('shot-editor');
    api.redraw();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
