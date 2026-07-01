// GLSL ES 3.00 sources for the render passes.
// One shared fullscreen vertex shader, one fragment shader per pass.

export const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Pass 1: apply the film LUT to the source. The source is flipped on Y here so the
// rest of the pipeline stays in GL orientation and presents upright.
export const LUT_FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uSrc;
uniform sampler3D uLut;
uniform float uLutSize;
uniform float uStrength;
void main() {
  vec3 c = texture(uSrc, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  vec3 coord = (clamp(c, 0.0, 1.0) * (uLutSize - 1.0) + 0.5) / uLutSize;
  vec3 graded = texture(uLut, coord).rgb;
  frag = vec4(mix(c, graded, uStrength), 1.0);
}`;

// Pass 2: keep only the highlights above a threshold, for halation and bloom.
export const THRESHOLD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(0.0, l - uThreshold) / max(1.0 - uThreshold, 1e-3);
  frag = vec4(c * k, 1.0);
}`;

// Separable Gaussian blur, run once per direction.
export const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  float w[5];
  w[0] = 0.227027; w[1] = 0.194595; w[2] = 0.121622; w[3] = 0.054054; w[4] = 0.016216;
  vec3 sum = texture(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    sum += texture(uTex, vUv + uDir * float(i)).rgb * w[i];
    sum += texture(uTex, vUv - uDir * float(i)).rgb * w[i];
  }
  frag = vec4(sum, 1.0);
}`;

// Pass 5: combine graded image with the blurred highlights and add the camera
// artifacts (halation, bloom, grain, vignette). Renders straight to the canvas.
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uGraded;
uniform sampler2D uBloom;
uniform float uGrain;
uniform float uHalation;
uniform float uBloomAmt;
uniform vec3 uHalaTint;
uniform float uVignette;
uniform vec2 uRes;
uniform vec2 uSeed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 c = texture(uGraded, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;

  // halation: warm-tinted highlight bleed, screen blended
  vec3 hal = bloom * uHalaTint * uHalation;
  c = 1.0 - (1.0 - c) * (1.0 - hal);

  // bloom: soft additive glow
  c += bloom * uBloomAmt;

  // grain, strongest in the mid tones so highlights and shadows stay clean
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float lumMod = clamp(1.0 - abs(l - 0.5) * 2.0, 0.2, 1.0);
  float n = hash(vUv * uRes + uSeed) - 0.5;
  c += n * uGrain * lumMod;

  // vignette, gentle corner darkening
  vec2 d = vUv - 0.5;
  c *= clamp(1.0 - uVignette * dot(d, d) * 2.2, 0.0, 1.0);

  frag = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
