// Bir həndəsə, üç üslub. Koordinat sistemi: 45x45.
const SHAPES = {
  p: 'M22.5 8a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zM19.5 17.5h6l1.8 4.5c2.6 2 4.2 7 4.2 14h-18c0-7 1.6-12 4.2-14zM11.5 36h22v3h-22z',
  r: 'M11 39v-3.5l3-3V19l-3-3V9h5v3h3.5V9h5v3H29V9h5v7l-3 3v13.5l3 3V39z',
  n: 'M14 37C14 30 16 26 20 22 17 22 12 24 9 22V19C11 16 15 10 18 8L20 3 24 7C34 8 39 18 38 30V37zM12 37h26v2.5H12z',
  b: 'M22.5 6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM22.5 11c-6 3.5-8.5 8-8.5 12.5 0 3 1.5 5 3 6.5h11c1.5-1.5 3-3.5 3-6.5 0-4.5-2.5-9-8.5-12.5zM13 32h19v3c-3 0-5-1-7-2h-5c-2 1-4 2-7 2zM11 36h23v3H11z',
  q: 'M9 11a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 9 11zM15 7.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM22.5 6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM30 7.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM36 11a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM9.5 15l4.5 15h17l4.5-15-6.5 8-6.5-11-6.5 11zM12.5 30h20v3.5h-20zM11 34h23v4.5H11z',
  k: 'M21 3.5h3v3h3v3h-3V13h-3V9.5h-3v-3h3zM22.5 13c-7.5 0-13 5-11.5 11.5l2.5 6h18l2.5-6C35.5 18 30 13 22.5 13zM12 31h21v3H12zM10.5 34h24v4.5h-24z'
};

// [fill, stroke] per colour + stroke width
export const PIECE_SETS = {
  classic: { w: ['#f7f2e8', '#26262b'], b: ['#33333b', '#0b0b0e'], sw: 1.5 },
  modern: { w: ['#f1f5f9', '#7b8798'], b: ['#3c4452', '#1b1f27'], sw: 0.9 },
  tournament: { w: ['#ffffff', '#000000'], b: ['#161616', '#000000'], sw: 2.2 }
};

const cache = new Map();

export function pieceSVG(set, color, type) {
  const key = set + color + type;
  let svg = cache.get(key);
  if (!svg) {
    const cfg = PIECE_SETS[set] || PIECE_SETS.classic;
    const [fill, stroke] = cfg[color];
    const eye = type === 'n' ? `<circle cx="17" cy="14" r="1.4" fill="${stroke}"/>` : '';
    svg = `<svg viewBox="0 0 45 45" aria-hidden="true" focusable="false"><path d="${SHAPES[type]}" fill="${fill}" stroke="${stroke}" stroke-width="${cfg.sw}" stroke-linejoin="round"/>${eye}</svg>`;
    cache.set(key, svg);
  }
  return svg;
}
