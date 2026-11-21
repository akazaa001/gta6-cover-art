// Draws a GTA-style multi-panel cover: photos in panels, a colour grade, a sun mark and bold caption
// lettering. Pure drawing: given a 2D context, a size and a state, it paints the whole cover, so the live
// preview and the exported PNGs are the same picture at different sizes.

/** The layouts the maker offers, in menu order. */
export const LAYOUTS = [
  { id: 'hero', name: 'Hero + three', panels: 4 },
  { id: 'grid4', name: 'Four panel grid', panels: 4 },
  { id: 'full', name: 'Full bleed', panels: 1 },
  { id: 'grid9', name: 'Nine panel mosaic', panels: 9 },
  { id: 'tilted', name: 'Tilted snapshots', panels: 4 },
];

/** The colour grades, in menu order. */
export const GRADES = [
  { id: 'sunset', name: 'Vice sunset' },
  { id: 'neon', name: 'Neon nights' },
  { id: 'gold', name: 'Golden hour' },
];

/** The caption colours the maker offers. */
export const CAPTION_COLOURS = ['#ffffff', '#ffe95e', '#ff5ea8', '#7ef9ff'];

/** How many panels a layout shows. */
export function panelCount(layout) {
  return (LAYOUTS.find((l) => l.id === layout) ?? LAYOUTS[0]).panels;
}

/**
 * The panels of a layout in cover space: each { x, y, w, h, rot } in pixels, rot in radians (0 unless the
 * layout tilts its snapshots). A gutter and an outer margin keep the panels off the cover's edge, except the
 * full-bleed layout, which fills the whole cover.
 */
export function panelRects(layout, W, H) {
  const m = Math.round(W * 0.022);
  const g = Math.round(W * 0.014);
  const innerW = W - 2 * m;
  const innerH = H - 2 * m;
  if (layout === 'hero') {
    const heroW = Math.round(innerW * 0.6);
    const sideX = m + heroW + g;
    const sideW = W - m - sideX;
    const cellH = Math.round((innerH - 2 * g) / 3);
    return [
      { x: m, y: m, w: heroW, h: innerH, rot: 0 },
      { x: sideX, y: m, w: sideW, h: cellH, rot: 0 },
      { x: sideX, y: m + cellH + g, w: sideW, h: cellH, rot: 0 },
      { x: sideX, y: m + 2 * (cellH + g), w: sideW, h: cellH, rot: 0 },
    ];
  }
  if (layout === 'grid4') {
    const cellW = Math.round((innerW - g) / 2);
    const cellH = Math.round((innerH - g) / 2);
    return [
      { x: m, y: m, w: cellW, h: cellH, rot: 0 },
      { x: m + cellW + g, y: m, w: cellW, h: cellH, rot: 0 },
      { x: m, y: m + cellH + g, w: cellW, h: cellH, rot: 0 },
      { x: m + cellW + g, y: m + cellH + g, w: cellW, h: cellH, rot: 0 },
    ];
  }
  if (layout === 'full') return [{ x: 0, y: 0, w: W, h: H, rot: 0 }];
  if (layout === 'grid9') {
    const cellW = Math.round((innerW - 2 * g) / 3);
    const cellH = Math.round((innerH - 2 * g) / 3);
    const rects = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push({ x: m + c * (cellW + g), y: m + r * (cellH + g), w: cellW, h: cellH, rot: 0 });
      }
    }
    return rects;
  }
  // Tilted snapshots: four overlapping cards, each rotated a few degrees, on a deep gradient ground.
  const cardW = Math.round(W * 0.54);
  const cardH = Math.round(H * 0.44);
  const centres = [
    [0.31, 0.29, -0.09],
    [0.71, 0.26, 0.07],
    [0.29, 0.72, 0.05],
    [0.70, 0.70, -0.07],
  ];
  return centres.map(([cx, cy, rot]) => ({
    x: Math.round(cx * W - cardW / 2),
    y: Math.round(cy * H - cardH / 2),
    w: cardW,
    h: cardH,
    rot,
  }));
}

/** Paints one photo into a panel rect, cover-fitting it with the panel's zoom and pan offsets. */
function drawPhotoInto(ctx, photo, rect, zoom, ox, oy) {
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * Math.max(0.5, zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w * 0.45;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h * 0.45;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** A panel with no photo yet: a deep gradient with a faint "add photo" mark. */
function drawEmptyPanel(ctx, rect) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#3a1c5c');
  grad.addColorStop(1, '#1c0f33');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, rect.w * 0.008);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.min(rect.w, rect.h) * 0.09;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.lineTo(cx, cy + r * 0.55);
  ctx.stroke();
  ctx.restore();
}

/** Wraps `text` into at most two lines that fit `maxWidth` at `size` in the Anton face. */
function wrapCaption(ctx, text, size, maxWidth) {
  ctx.font = `${size}px Anton, sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === 2) break;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

/** The caption block: an optional Pacifico subcaption over the bold Anton main caption, outlined and shadowed. */
function drawCaption(ctx, W, H, state) {
  const main = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim();
  if (!main && !sub) return;
  const top = state.captionPosition === 'top';
  const maxWidth = W * 0.9;
  let size = H * 0.105;
  let lines = main ? wrapCaption(ctx, main, size, maxWidth) : [];
  while (lines.length > 0 && size > H * 0.03) {
    ctx.font = `${size}px Anton, sans-serif`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth) break;
    size -= H * 0.004;
    lines = wrapCaption(ctx, main, size, maxWidth);
  }
  const subSize = H * 0.042;
  const lineHeight = size * 0.98;
  const blockH = lines.length * lineHeight + (sub ? subSize * 1.5 : 0);
  const baseY = top ? H * 0.055 + blockH : H * 0.955;
  const blockTop = baseY - blockH;
  let y = top
    ? blockTop + (sub ? subSize * 1.5 : 0) + lineHeight * 0.85
    : baseY - (lines.length - 1) * lineHeight;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (sub) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff8fd0';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = subSize * 0.35;
    ctx.shadowOffsetY = subSize * 0.08;
    const subY = blockTop + subSize;
    ctx.fillText(sub, W / 2, subY);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#160a2b';
  ctx.fillStyle = state.captionColor || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.05;
  for (const line of lines) {
    ctx.strokeText(line, W / 2, y);
    ctx.fillText(line, W / 2, y);
    y += lineHeight;
  }
  ctx.restore();
}

/** The sun mark: a glowing gradient disc for warm grades, a neon ring for the neon grade. It sits in the
 *  top-centre gap of the cover, over the panels' join, so it never covers a face in a photo. */
function drawSunMark(ctx, W, H, grade) {
  const cx = W * 0.5;
  const cy = H * 0.085;
  const r = Math.max(14, W * 0.042);
  ctx.save();
  if (grade === 'neon') {
    ctx.strokeStyle = '#37f6ff';
    ctx.lineWidth = Math.max(3, r * 0.1);
    ctx.shadowColor = '#37f6ff';
    ctx.shadowBlur = r * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff4fd8';
    ctx.shadowColor = '#ff4fd8';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#ffe9a3');
    grad.addColorStop(0.55, '#ff9e57');
    grad.addColorStop(1, '#ff4f7e');
    ctx.shadowColor = '#ff7a4d';
    ctx.shadowBlur = r * 0.9;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A colour grade washed over the finished panels, then a vignette to hold the edges together. */
function drawGrade(ctx, W, H, grade) {
  ctx.save();
  if (grade === 'sunset') {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 120, 90, 0.05)');
    wash.addColorStop(0.55, 'rgba(255, 90, 120, 0.10)');
    wash.addColorStop(1, 'rgba(190, 30, 110, 0.30)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = '#ff7a3c';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'neon') {
    const wash = ctx.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, 'rgba(55, 246, 255, 0.16)');
    wash.addColorStop(0.5, 'rgba(120, 60, 255, 0.10)');
    wash.addColorStop(1, 'rgba(255, 79, 216, 0.20)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 200, 90, 0.10)');
    wash.addColorStop(1, 'rgba(255, 140, 40, 0.26)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = '#ffb347';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(16, 0, 28, 0)');
  vig.addColorStop(1, 'rgba(16, 0, 28, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/**
 * Paints the whole cover for `state` onto `ctx` at W x H. `state` is
 * { layout, grade, caption, subcaption, captionColor, captionPosition, panels: [{ photo, zoom, ox, oy }] }.
 * Panels with no photo get the empty placeholder; tilted cards get a white snapshot frame.
 */
export function drawCover(ctx, W, H, state) {
  const layout = state.layout || 'hero';
  const grade = state.grade || 'sunset';
  ctx.clearRect(0, 0, W, H);
  if (layout === 'tilted') {
    const ground = ctx.createLinearGradient(0, 0, W, H);
    ground.addColorStop(0, '#2a1145');
    ground.addColorStop(1, '#12081f');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#160a2b';
    ctx.fillRect(0, 0, W, H);
  }
  const rects = panelRects(layout, W, H);
  const frame = Math.max(4, Math.round(W * 0.012));
  rects.forEach((rect, i) => {
    const panel = (state.panels || [])[i] || {};
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      if (layout === 'tilted') {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = W * 0.02;
        ctx.shadowOffsetY = W * 0.008;
        ctx.fillStyle = '#f7f2ea';
        ctx.fillRect(-frame, -frame, rect.w + 2 * frame, rect.h + 2 * frame + frame * 2);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
    }
    const inner = layout === 'tilted'
      ? { x: 0, y: 0, w: rect.w, h: rect.h - frame * 2 }
      : rect;
    if (panel.photo) drawPhotoInto(ctx, panel.photo, inner, panel.zoom ?? 1, panel.ox ?? 0, panel.oy ?? 0);
    else drawEmptyPanel(ctx, inner);
    ctx.restore();
  });
  drawGrade(ctx, W, H, grade);
  drawSunMark(ctx, W, H, grade);
  drawCaption(ctx, W, H, state);
}
