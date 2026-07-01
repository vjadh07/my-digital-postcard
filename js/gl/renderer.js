// WebGL2 renderer. Runs the film pipeline: LUT grade, then highlight blur reused for
// halation and bloom, then grain and vignette composited to the canvas.
import { VERT, LUT_FRAG, THRESHOLD_FRAG, BLUR_FRAG, COMPOSITE_FRAG } from './shaders.js';

const MAX_SIDE = 1600; // cap processing size for memory and speed

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile failed: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function program(gl, vsrc, fsrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true, // so the stamp compositor can read the graded frame
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.canvas = canvas;

    this.progLut = program(gl, VERT, LUT_FRAG);
    this.progThresh = program(gl, VERT, THRESHOLD_FRAG);
    this.progBlur = program(gl, VERT, BLUR_FRAG);
    this.progComposite = program(gl, VERT, COMPOSITE_FRAG);

    // fullscreen quad as a triangle strip
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    this.srcTex = this._tex();
    this.lutTex = null;
    this.lutSize = 0;
    this.fbos = null;
    this.w = 0;
    this.h = 0;
  }

  _tex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _fbo(w, h) {
    const gl = this.gl;
    const tex = this._tex();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  setLut(lut) {
    const gl = this.gl;
    if (!this.lutTex) this.lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(
      gl.TEXTURE_3D, 0, gl.RGBA8, lut.size, lut.size, lut.size, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, lut.data,
    );
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    this.lutSize = lut.size;
  }

  _freeFbos() {
    const gl = this.gl;
    if (!this.fbos) return;
    for (const key of Object.keys(this.fbos)) {
      gl.deleteTexture(this.fbos[key].tex);
      gl.deleteFramebuffer(this.fbos[key].fb);
    }
    this.fbos = null;
  }

  _resize(sw, sh) {
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.max(2, Math.round(sw * scale));
    const h = Math.max(2, Math.round(sh * scale));
    if (w === this.w && h === this.h && this.fbos) return;
    this._freeFbos();
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);
    this.fbos = {
      graded: this._fbo(w, h),
      brightA: this._fbo(hw, hh),
      brightB: this._fbo(hw, hh),
    };
  }

  // source is a video, image, bitmap or canvas. Uploads the current frame.
  setSource(source, width, height) {
    const gl = this.gl;
    this._resize(width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  _draw(fbo) {
    const gl = this.gl;
    if (fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
      gl.viewport(0, 0, fbo.w, fbo.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // p is a preset. opts.blurPasses controls quality (fewer for live preview).
  render(p, opts = {}) {
    const gl = this.gl;
    const f = this.fbos;
    if (!f || !this.lutTex) return;
    const blurPasses = opts.blurPasses ?? 3;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    // 1. LUT grade -> graded
    gl.useProgram(this.progLut);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(gl.getUniformLocation(this.progLut, 'uSrc'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.uniform1i(gl.getUniformLocation(this.progLut, 'uLut'), 1);
    gl.uniform1f(gl.getUniformLocation(this.progLut, 'uLutSize'), this.lutSize);
    gl.uniform1f(gl.getUniformLocation(this.progLut, 'uStrength'), p.strength);
    this._draw(f.graded);

    // 2. highlight extract -> brightA
    gl.useProgram(this.progThresh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, f.graded.tex);
    gl.uniform1i(gl.getUniformLocation(this.progThresh, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.progThresh, 'uThreshold'), p.threshold);
    this._draw(f.brightA);

    // 3. separable blur, ping-pong between brightA and brightB
    gl.useProgram(this.progBlur);
    const dirLoc = gl.getUniformLocation(this.progBlur, 'uDir');
    let src = f.brightA;
    let dst = f.brightB;
    for (let i = 0; i < blurPasses; i++) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(gl.getUniformLocation(this.progBlur, 'uTex'), 0);
      gl.uniform2f(dirLoc, 1 / src.w, 0);
      this._draw(dst);
      [src, dst] = [dst, src];
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(dirLoc, 0, 1 / src.h);
      this._draw(dst);
      [src, dst] = [dst, src];
    }
    const blurred = src;

    // 4. composite -> canvas
    gl.useProgram(this.progComposite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, f.graded.tex);
    gl.uniform1i(gl.getUniformLocation(this.progComposite, 'uGraded'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurred.tex);
    gl.uniform1i(gl.getUniformLocation(this.progComposite, 'uBloom'), 1);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uGrain'), p.grain);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uHalation'), p.halation);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uBloomAmt'), p.bloom);
    gl.uniform3fv(gl.getUniformLocation(this.progComposite, 'uHalaTint'), p.halaTint);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uVignette'), p.vignette);
    gl.uniform2f(gl.getUniformLocation(this.progComposite, 'uRes'), this.w, this.h);
    const seed = opts.seed ?? [Math.random() * 1000, Math.random() * 1000];
    gl.uniform2f(gl.getUniformLocation(this.progComposite, 'uSeed'), seed[0], seed[1]);
    this._draw(null);
  }
}
