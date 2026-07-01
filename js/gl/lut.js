// Parses a .cube 3D LUT into an RGBA byte array ready for a WebGL2 3D texture.
// Byte (unorm) data is used so the hardware can do trilinear filtering directly.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function parseCube(text) {
  let size = 0;
  const values = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE') || line.startsWith('DOMAIN_')) continue;
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (line.startsWith('LUT_1D_SIZE')) throw new Error('1D LUTs are not supported');
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }
  if (!size) throw new Error('missing LUT_3D_SIZE');
  const count = size * size * size;
  if (values.length < count * 3) throw new Error('LUT has fewer entries than declared');

  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4 + 0] = Math.round(clamp01(values[i * 3 + 0]) * 255);
    data[i * 4 + 1] = Math.round(clamp01(values[i * 3 + 1]) * 255);
    data[i * 4 + 2] = Math.round(clamp01(values[i * 3 + 2]) * 255);
    data[i * 4 + 3] = 255;
  }
  return { size, data };
}

export async function loadCube(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load LUT: ${url}`);
  return parseCube(await res.text());
}
