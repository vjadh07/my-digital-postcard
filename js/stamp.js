// Builds the final postage stamp on a 2D canvas: perforated paper edges, a title, a big
// number, the graded photo, an optional date stamp, and an optional halftone print.

const PAPER = '#efe9dc';
const INK = '#111';
const DATE_COLOR = '#ff9d3c';
const HALFTONE_INK = '#c9203f';

const STAMP_H = 1500;
const STAMP_W = Math.round(STAMP_H * 0.74);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const wr = w / h;
  let sw, sh, sx, sy;
  if (ir > wr) {
    sh = img.height;
    sw = sh * wr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / wr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Turn a canvas into a one-ink halftone print on paper.
function halftone(src, ink, paper, dot) {
  const w = src.width;
  const h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  octx.fillStyle = paper;
  octx.fillRect(0, 0, w, h);
  const tctx = src.getContext('2d');
  const data = tctx.getImageData(0, 0, w, h).data;
  octx.fillStyle = ink;
  for (let y = 0; y < h; y += dot) {
    for (let x = 0; x < w; x += dot) {
      const i = (y * w + x) * 4;
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const r = (1 - lum) * dot * 0.72;
      if (r > 0.3) {
        octx.beginPath();
        octx.arc(x + dot / 2, y + dot / 2, r, 0, Math.PI * 2);
        octx.fill();
      }
    }
  }
  return out;
}

// Copy a source (gl canvas / image) into a plain 2D canvas so we can read pixels.
function toCanvas(src) {
  const w = src.width || src.videoWidth || src.naturalWidth;
  const h = src.height || src.videoHeight || src.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return c;
}

export function renderStamp(graded, opts = {}) {
  const {
    title = 'POSTCARD',
    subtitle = 'DIGITAL POSTCARD',
    number = '26',
    caption = '',
    showDate = true,
    halftoneOn = false,
  } = opts;

  const W = STAMP_W;
  const H = STAMP_H;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const r = Math.round(W * 0.024); // perforation radius
  const px0 = r;
  const py0 = r;
  const pw = W - 2 * r;
  const ph = H - 2 * r;

  // paper body
  ctx.fillStyle = PAPER;
  ctx.fillRect(px0, py0, pw, ph);

  // faint warm shading so the paper is not flat
  const grad = ctx.createRadialGradient(W / 2, H * 0.4, W * 0.1, W / 2, H * 0.5, H * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(120,110,90,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(px0, py0, pw, ph);

  // punch the perforation bites around the edges
  ctx.globalCompositeOperation = 'destination-out';
  const nx = Math.round(pw / (r * 1.7));
  const ny = Math.round(ph / (r * 1.7));
  const sx = pw / nx;
  const sy = ph / ny;
  const bite = (cx, cy) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i <= nx; i++) {
    bite(px0 + i * sx, py0);
    bite(px0 + i * sx, py0 + ph);
  }
  for (let i = 0; i <= ny; i++) {
    bite(px0, py0 + i * sy);
    bite(px0 + pw, py0 + i * sy);
  }
  ctx.globalCompositeOperation = 'source-over';

  // content layout
  const m = Math.round(pw * 0.08);
  const cx = px0 + m;
  const cw = pw - 2 * m;

  // title block
  const titleSize = Math.round(pw * 0.11);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(pw * 0.045)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(title.toUpperCase(), cx, py0 + m + Math.round(pw * 0.05));
  ctx.font = `600 ${Math.round(pw * 0.03)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(subtitle.toUpperCase(), cx, py0 + m + Math.round(pw * 0.085));
  ctx.font = `800 ${titleSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(String(number), cx, py0 + m + Math.round(pw * 0.085) + titleSize);

  // photo window
  const winY = py0 + m + Math.round(pw * 0.085) + titleSize + Math.round(pw * 0.04);
  const winH = H - r - m - winY - Math.round(pw * 0.06);
  let photo = toCanvas(graded);
  if (halftoneOn) {
    const dot = Math.max(3, Math.round(photo.width / 180));
    photo = halftone(photo, HALFTONE_INK, PAPER, dot);
  }
  ctx.save();
  roundRect(ctx, cx, winY, cw, winH, Math.round(pw * 0.02));
  ctx.clip();
  drawCover(ctx, photo, cx, winY, cw, winH);

  // date stamp burned into the corner of the photo
  if (showDate) {
    const d = new Date();
    const stamp = `${d.getFullYear()} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    ctx.font = `700 ${Math.round(pw * 0.032)}px "Courier New", monospace`;
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(255,120,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = DATE_COLOR;
    ctx.fillText(stamp, cx + cw - Math.round(pw * 0.03), winY + winH - Math.round(pw * 0.03));
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // caption line under the photo
  if (caption) {
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(pw * 0.026)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(caption.toUpperCase(), cx, H - r - m + Math.round(pw * 0.01));
  }

  return canvas;
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
