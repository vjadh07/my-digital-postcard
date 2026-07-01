// Generates the film .cube LUTs used by the app.
// Each look is authored as a small chain of color ops so it is repeatable and easy to
// tweak. Run with: node tools/gen-luts.mjs
// The transforms work on display values (0..1), the same space the shader samples.

import { writeFileSync } from 'node:fs';

const N = 33; // 33x33x33 is the common size, good quality without huge files

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const saturate = (c, s) => {
  const l = luma(c.r, c.g, c.b);
  return { r: l + (c.r - l) * s, g: l + (c.g - l) * s, b: l + (c.b - l) * s };
};
const contrast = (c, amt, pivot = 0.5) => ({
  r: (c.r - pivot) * amt + pivot,
  g: (c.g - pivot) * amt + pivot,
  b: (c.b - pivot) * amt + pivot,
});
const gain = (c, gr, gg, gb) => ({ r: c.r * gr, g: c.g * gg, b: c.b * gb });
const offset = (c, or_, og, ob) => ({ r: c.r + or_, g: c.g + og, b: c.b + ob });
const clampColor = (c) => ({ r: clamp(c.r), g: clamp(c.g), b: clamp(c.b) });

// Kodak warm: warm skin, olive greens, mint highlights, soft lifted contrast.
function kodakWarm(c) {
  let x = contrast(c, 1.08);
  x = gain(x, 1.05, 1.0, 0.95);
  const l = luma(x.r, x.g, x.b);
  const sh = 1 - l;
  x = offset(x, 0.02 * sh, 0.01 * sh, -0.005 * sh); // warm shadow lift
  const hi = l * l;
  x = offset(x, -0.005 * hi, 0.012 * hi, 0.02 * hi); // mint cyan highlights
  const greenExcess = Math.max(0, x.g - Math.max(x.r, x.b)); // pull pure greens to olive
  x = { r: x.r + 0.05 * greenExcess, g: x.g - 0.15 * greenExcess, b: x.b };
  x = saturate(x, 0.92);
  return clampColor(x);
}

// Overcast teal: cold, desaturated, misty, lifted blacks, reds still pop.
function overcastTeal(c) {
  let x = contrast(c, 0.92);
  x = offset(x, 0.02, 0.03, 0.035); // cool lifted blacks
  x = gain(x, 0.96, 1.0, 1.05);
  const l = luma(x.r, x.g, x.b);
  const sh = 1 - l;
  x = offset(x, -0.01 * sh, 0.02 * sh, 0.03 * sh); // teal in shadows and mids
  const redMask = clamp((x.r - Math.max(x.g, x.b)) * 3, 0, 1); // keep reds saturated
  x = saturate(x, 0.72 + 0.26 * redMask);
  return clampColor(x);
}

// Golden hour: deep warm light, richer contrast, warm highs against cool shadows.
function goldenHour(c) {
  let x = contrast(c, 1.12);
  x = gain(x, 1.1, 1.02, 0.9);
  const l = luma(x.r, x.g, x.b);
  const hi = l * l;
  const sh = (1 - l) * (1 - l);
  x = offset(x, 0.045 * hi, 0.02 * hi, -0.01 * hi); // warm highlights
  x = offset(x, -0.015 * sh, -0.005 * sh, 0.03 * sh); // cool shadows
  x = saturate(x, 1.08);
  return clampColor(x);
}

function writeCube(name, title, fn) {
  let out = `TITLE "${title}"\nLUT_3D_SIZE ${N}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n`;
  for (let b = 0; b < N; b++) {
    for (let g = 0; g < N; g++) {
      for (let r = 0; r < N; r++) {
        const c = clampColor(fn({ r: r / (N - 1), g: g / (N - 1), b: b / (N - 1) }));
        out += `${c.r.toFixed(6)} ${c.g.toFixed(6)} ${c.b.toFixed(6)}\n`;
      }
    }
  }
  writeFileSync(new URL(`../luts/${name}.cube`, import.meta.url), out);
  console.log(`wrote luts/${name}.cube`);
}

writeCube('kodak-warm', 'Kodak Warm', kodakWarm);
writeCube('overcast-teal', 'Overcast Teal', overcastTeal);
writeCube('golden-hour', 'Golden Hour', goldenHour);
