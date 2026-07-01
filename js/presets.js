// Film looks. Each one is a real .cube LUT plus the artifact settings that make it
// read as a real camera. Strength stays below 1 so the grade never looks overcooked.

export const PRESETS = [
  {
    id: 'kodak-warm',
    name: 'Kodak Warm',
    lut: 'luts/kodak-warm.cube',
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
