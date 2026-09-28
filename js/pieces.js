// AZCHESS Premium SVG pieces — original vector set, chess-app style.
const SHAPES = {
  p:'M22.5 7.2c-3.1 0-5.5 2.5-5.5 5.5 0 2.1 1.2 3.9 3 4.8-4.2 2.2-6.1 7.3-6.5 13.2h18c-.4-5.9-2.3-11-6.5-13.2 1.8-.9 3-2.7 3-4.8 0-3-2.4-5.5-5.5-5.5zM10.5 34h24v4.2h-24z',
  r:'M11 38.2v-3.7l3.1-3.1V19l-3.1-3.1V7.8h5.2v3.4h3.3V7.8h5.9v3.4h3.3V7.8H34v8.1L30.9 19v12.4l3.1 3.1v3.7z',
  n:'M11.2 36.8c.1-6.1 2.2-10.9 6.8-15-3.1.2-6.2 1.2-8.8-.2v-3.1c2.5-4.3 5.5-7.7 9-10.2l1.4-4.2 4.6 4.4c7.1 1.2 11.5 7.2 11.1 15.5-.2 4.5-1.3 8.8-3 12.8zM10 37h27v2.5H10z',
  b:'M22.5 5.2c-2 0-3.7 1.7-3.7 3.7 0 1.5.9 2.8 2.2 3.4-4.6 3.2-7 7.4-7 11.3 0 2.9 1.3 5.2 3.2 6.9-2 .9-4 1.5-6.2 1.5v3h23v-3c-2.2 0-4.2-.6-6.2-1.5 1.9-1.7 3.2-4 3.2-6.9 0-3.9-2.4-8.1-7-11.3 1.3-.6 2.2-1.9 2.2-3.4 0-2-1.7-3.7-3.7-3.7zM11 36h23v3H11z',
  q:'M8.5 11.4c0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7c0 .5-.1.9-.4 1.3l3.4-3.1c0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7c0 .3 0 .6-.1.9l.3-.1.3.1c-.1-.3-.1-.6-.1-.9 0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7l3.4 3.1c-.3-.4-.4-.8-.4-1.3 0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7c0 .7-.3 1.4-.8 1.9l-4.1 15.2h-16L9.3 13.3c-.5-.5-.8-1.2-.8-1.9zM12 30.5h21v3.2H12zM10.5 34.2h24v4.4h-24z',
  k:'M20.8 3h3.4v3.2h3.2v3.2h-3.2v4c6.6 1.1 10.9 5.5 10.9 11.2 0 2.8-1.2 5.2-3.1 7.1 1.1.5 2.3.9 3.7 1.1v3H10.3v-3c1.4-.2 2.6-.6 3.7-1.1-1.9-1.9-3.1-4.3-3.1-7.1 0-5.7 4.3-10.1 10.9-11.2v-4h-3.2V6.2h3.2zM11 34h23v4.2H11z'
};
export const PIECE_SETS = {
  classic:{w:['#fffdf8','#b9a98e'],b:['#34363c','#090a0d'],sw:1.05},
  modern:{w:['#f7fafc','#9aa6b7'],b:['#3a414c','#11151b'],sw:1},
  tournament:{w:['#fff','#777'],b:['#171717','#000'],sw:1.2}
};
const cache=new Map();
export function pieceSVG(set,color,type){
  const key=`${set}|${color}|${type}`;
  if(cache.has(key)) return cache.get(key);
  const c=PIECE_SETS[set]||PIECE_SETS.classic, [a,b]=c[color];
  const id=`az-${set}-${color}-${type}`.replace(/[^a-z0-9-]/gi,'');
  const dark=color==='b';
  const eye=type==='n'?`<circle cx="28" cy="14.8" r="1.15" fill="${dark?'#d9dce2':'#3b3b3b'}" opacity=".9"/>`:'';
  const svg=`<svg viewBox="0 0 45 45" aria-hidden="true" focusable="false" class="piece-svg">
    <defs>
      <linearGradient id="${id}-g" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".48" stop-color="${dark?'#555962':'#fff'}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark?'#767b84':'#fff'}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <filter id="${id}-sh" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="1.8" stdDeviation="1.2" flood-color="#000" flood-opacity="${dark?.62:.34}"/></filter>
    </defs>
    <g filter="url(#${id}-sh)">
      <path d="${SHAPES[type]}" fill="url(#${id}-g)" stroke="url(#${id}-edge)" stroke-width="${c.sw}" stroke-linejoin="round"/>
      <path d="${SHAPES[type]}" fill="none" stroke="#fff" stroke-opacity="${dark?.10:.32}" stroke-width=".55" transform="translate(-.15,-.2)"/>
      ${eye}
    </g>
  </svg>`;
  cache.set(key,svg); return svg;
}
