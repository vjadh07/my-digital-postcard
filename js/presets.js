// Film looks. Each one is a real .cube LUT plus the artifact settings that make it
// read as a real camera. Strength stays below 1 so the grade never looks overcooked.

export const PRESETS = [
  {
    id: 'kodak-warm',
    name: 'Kodak Warm',
    lut: 'luts/kodak-warm.cube',
    swatch: 'linear-gradient(135deg, #ecd095 0%, #b9a05a 55%, #7f6238 100%)',
    strength: 0.85,
    threshold: 0.72,
    halation: 0.5,
    halaTint: [1.0, 0.55, 0.35],
    bloom: 0.18,
    grain: 0.07,
    vignette: 0.28,
  },
  {
    id: 'overcast-teal',
    name: 'Overcast Teal',
    lut: 'luts/overcast-teal.cube',
    swatch: 'linear-gradient(135deg, #a6bfbc 0%, #6f8f92 55%, #3f565c 100%)',
    strength: 0.9,
    threshold: 0.78,
    halation: 0.22,
    halaTint: [0.7, 0.85, 1.0],
    bloom: 0.12,
    grain: 0.075,
    vignette: 0.34,
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    lut: 'luts/golden-hour.cube',
    swatch: 'linear-gradient(135deg, #f6b64c 0%, #c87b2b 55%, #5a3b28 100%)',
    strength: 0.85,
    threshold: 0.68,
    halation: 0.6,
    halaTint: [1.0, 0.5, 0.25],
    bloom: 0.22,
    grain: 0.06,
    vignette: 0.3,
  },
];

export const getPreset = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];
