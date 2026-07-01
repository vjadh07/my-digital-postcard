import { Renderer } from './gl/renderer.js';
import { Camera } from './camera.js';
import { decodeFile } from './upload.js';
import { PRESETS } from './presets.js';
import { loadCube } from './gl/lut.js';
import { renderStamp, downloadCanvas } from './stamp.js';

const $ = (id) => document.getElementById(id);
const glCanvas = $('gl');
const feed = $('feed');

let renderer;
let camera;
let preset = PRESETS[0];
const lutCache = new Map();
let hasStill = false;
let still = null;
let stillSeed = [111, 222];
let raf = 0;
let stampCanvas = null;

const showErr = (msg) => {
  $('err').textContent = msg;
  $('err').hidden = false;
};
const clearErr = () => {
  $('err').hidden = true;
};

async function ensureLut(p) {
  if (!lutCache.has(p.id)) lutCache.set(p.id, await loadCube(p.lut));
  renderer.setLut(lutCache.get(p.id));
}

function stopLive() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function liveLoop() {
  raf = requestAnimationFrame(liveLoop);
  if (!camera || !camera.ready) return;
  renderer.setSource(feed, feed.videoWidth, feed.videoHeight);
  renderer.render(preset, {
    blurPasses: 1,
    seed: [Math.random() * 1000, Math.random() * 1000],
  });
}

async function startCamera() {
  clearErr();
  try {
    if (!camera) camera = new Camera(feed);
    await ensureLut(preset);
    await camera.start();
    hasStill = false;
    still = null;
    $('hint').hidden = true;
    $('btnShutter').hidden = false;
    $('btnRetake').hidden = true;
    $('stampPanel').hidden = true;
    stopLive();
    liveLoop();
  } catch (e) {
    showErr('camera error: ' + e.message);
  }
}

function gradeStill() {
  const w = still.width || still.naturalWidth;
  const h = still.height || still.naturalHeight;
  renderer.setSource(still, w, h);
  renderer.render(preset, { blurPasses: 3, seed: stillSeed });
}

async function useStill(src) {
  stopLive();
  await ensureLut(preset);
  still = src;
  stillSeed = [Math.random() * 1000, Math.random() * 1000];
  gradeStill();
  hasStill = true;
  $('hint').hidden = true;
  $('btnShutter').hidden = true;
  $('stampPanel').hidden = false;
  buildStamp();
}

function capture() {
  if (!camera || !camera.ready) return;
  flash();
  useStill(camera.capture());
  $('btnRetake').hidden = false;
}

async function onFile(file) {
  clearErr();
  try {
    const img = await decodeFile(file);
    if (camera) camera.stop();
    stopLive();
    await useStill(img);
    $('btnRetake').hidden = true;
  } catch (e) {
    showErr(e.message);
  }
}

function retake() {
  if (!camera || !camera.stream) {
    startCamera();
    return;
  }
  hasStill = false;
  $('stampPanel').hidden = true;
  $('btnShutter').hidden = false;
  $('btnRetake').hidden = true;
  stopLive();
  liveLoop();
}

function buildStamp() {
  stampCanvas = renderStamp(glCanvas, {
    title: $('title').value || 'POSTCARD',
    number: $('number').value || '26',
    caption: $('caption').value,
    subtitle: preset.name,
    showDate: $('dateToggle').checked,
    halftoneOn: $('halftoneToggle').checked,
  });
  const holder = $('stampPreview');
  holder.innerHTML = '';
  stampCanvas.className = 'stampImg';
  holder.appendChild(stampCanvas);
}

async function selectFilm(p) {
  preset = p;
  setReadout(p.name);
  document
    .querySelectorAll('.film')
    .forEach((b) => b.classList.toggle('active', b.dataset.id === p.id));
  await ensureLut(p);
  if (hasStill) {
    gradeStill();
    buildStamp();
  }
}

function setReadout(name) {
  const r = $('readout');
  if (r) r.textContent = name.toLowerCase();
}

function flash() {
  const f = $('flash');
  f.classList.remove('fire');
  void f.offsetWidth; // restart the animation
  f.classList.add('fire');
}

function buildFilms() {
  const box = $('films');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'film' + (i === 0 ? ' active' : '');
    b.dataset.id = p.id;
    b.innerHTML = '<span class="sw"></span><span class="fl"></span>';
    b.querySelector('.sw').style.background = p.swatch;
    b.querySelector('.fl').textContent = p.name;
    b.onclick = () => selectFilm(p);
    box.appendChild(b);
  });
}

function initDrop() {
  const vp = $('viewport');
  ['dragover', 'dragenter'].forEach((ev) =>
    vp.addEventListener(ev, (e) => {
      e.preventDefault();
      vp.classList.add('drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    vp.addEventListener(ev, (e) => {
      e.preventDefault();
      vp.classList.remove('drag');
    }),
  );
  vp.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  });
}

function main() {
  try {
    renderer = new Renderer(glCanvas);
  } catch (e) {
    showErr(e.message);
    return;
  }
  buildFilms();
  setReadout(preset.name);
  $('btnCamera').onclick = startCamera;
  $('file').onchange = (e) => {
    if (e.target.files[0]) onFile(e.target.files[0]);
  };
  $('btnShutter').onclick = capture;
  $('btnRetake').onclick = retake;
  $('btnDownload').onclick = () => {
    if (!stampCanvas) buildStamp();
    downloadCanvas(stampCanvas, 'postcard.png');
  };
  ['title', 'number', 'caption'].forEach((id) =>
    $(id).addEventListener('input', () => hasStill && buildStamp()),
  );
  ['dateToggle', 'halftoneToggle'].forEach((id) =>
    $(id).addEventListener('change', () => hasStill && buildStamp()),
  );
  initDrop();
}

main();
