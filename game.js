/* =========================================================
 * game.js — ChessWeb main controller.
 * Game state (chess.js), board UI (chessboard.js), clocks,
 * move list & navigation, highlights, sounds, themes,
 * captured-material tracking, and wiring for AI + P2P modes.
 * ========================================================= */
'use strict';

/* ============================ helpers ============================ */

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ============================ settings ============================ */

const Settings = (() => {
  const defaults = {
    theme: 'dark', board: 'classic', pieces: 'wikipedia',
    sound: true, autoFlip: false,
    customLight: '#f0d9b5', customDark: '#b58863'
  };
  let data;
  try { data = Object.assign({}, defaults, JSON.parse(localStorage.getItem('chessweb-settings') || '{}')); }
  catch (e) { data = Object.assign({}, defaults); }
  function save() { try { localStorage.setItem('chessweb-settings', JSON.stringify(data)); } catch (e) {} }
  return {
    get: (k) => data[k],
    set: (k, v) => { data[k] = v; save(); },
    all: () => data
  };
})();

const BOARD_THEMES = {
  classic: { light: '#f0d9b5', dark: '#b58863' },
  ocean:   { light: '#dee3e6', dark: '#8ca2ad' },
  forest:  { light: '#ffffdd', dark: '#86a666' },
  royal:   { light: '#f7f7f7', dark: '#547388' },
  coral:   { light: '#f7e6d4', dark: '#c58f62' },
  carbon:  { light: '#bbcbdb', dark: '#47525e' }
};

const PIECE_SETS = {
  wikipedia: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/',
  alpha: 'https://chessboardjs.com/img/chesspieces/alpha/'
};

const TIME_PRESETS = [
  { label: '1 min • Bullet',  base: 60,   inc: 0 },
  { label: '3 min • Blitz',   base: 180,  inc: 0 },
  { label: '3+2 • Blitz',     base: 180,  inc: 2 },
  { label: '5 min • Blitz',   base: 300,  inc: 0 },
  { label: '10 min • Rapid',  base: 600,  inc: 0 },
  { label: '15+10 • Rapid',   base: 900,  inc: 10 },
  { label: '30 min • Classical', base: 1800, inc: 0 },
  { label: '∞ No clock',      base: 0,    inc: 0 }
];

function applyAppearance() {
  document.body.dataset.theme = Settings.get('theme');
  const bt = BOARD_THEMES[Settings.get('board')] || BOARD_THEMES.classic;
  const light = Settings.get('board') === 'custom' ? Settings.get('customLight') : bt.light;
  const dark  = Settings.get('board') === 'custom' ? Settings.get('customDark')  : bt.dark;
  document.documentElement.style.setProperty('--sq-light', light);
  document.documentElement.style.setProperty('--sq-dark', dark);
}

/* ============================ sounds ============================ */

const SoundFX = (() => {
  let ctx = null;
  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, when) {
    const c = ensure();
    if (!c) return;
    try {
      const t0 = c.currentTime + (when || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  return {
    unlock() { ensure(); },
    play(name) {
      if (!Settings.get('sound')) return;
      try {
        switch (name) {
          case 'move':    tone(520, 0.08, 'triangle', 0.18); break;
          case 'capture': tone(300, 0.09, 'square', 0.12); tone(180, 0.13, 'triangle', 0.2, 0.02); break;
          case 'castle':  tone(420, 0.07, 'triangle', 0.18); tone(560, 0.07, 'triangle', 0.18, 0.08); break;
          case 'check':   tone(880, 0.11, 'sine', 0.2); tone(880, 0.13, 'sine', 0.2, 0.15); break;
          case 'notify':  tone(660, 0.09, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2, 0.09); break;
          case 'start':   tone(440, 0.09, 'triangle', 0.18); tone(660, 0.14, 'triangle', 0.18, 0.09); break;
          case 'end':     tone(523, 0.14, 'triangle', 0.18); tone(392, 0.14, 'triangle', 0.18, 0.13); tone(262, 0.3, 'triangle', 0.18, 0.27); break;
          case 'illegal': tone(160, 0.12, 'sawtooth', 0.1); break;
        }
      } catch (e) {}
    }
  };
})();

/* ============================ game state ============================ */

const G = {
  game: null,
  mode: null,            // 'online' | 'local' | 'ai'
  myColor: 'w',
  orientation: 'white',
  over: false,
  result: null,          // '1-0' | '0-1' | '1/2-1/2'
  reason: null,
  moves: [],             // verbose move history
  viewIndex: 0,          // plies shown on the board (moves.length = live)
  selected: null,
  legalMoves: [],
  hasClock: true,
  base: 600,
  clocks: { w: 600, b: 600, inc: 0 },
  activeColor: 'w',
  clockTimer: null,
  clockLast: 0,
  aiLevel: 'medium',
  aiThinking: false,
  drawOfferedBy: null,   // 'w' | 'b' | null
  rematchSent: false
};

let board = null;
let promoCallback = null;
let confirmCallback = null;
let toastTimer = null;
let selectedAiLevel = 'medium';

function newChess() { return new Chess(); }

/* ============================ board ============================ */

function pieceThemeUrl(piece) {
  const base = PIECE_SETS[Settings.get('pieces')] || PIECE_SETS.wikipedia;
  return base + piece + '.png';
}

function initBoard() {
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    showNotation: false,
    pieceTheme: pieceThemeUrl,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: () => { if (G && G.game && G.viewIndex === G.moves.length) board.position(G.game.fen()); }
  });
}

function rebuildBoard() {
  const el = $('#board');
  el.innerHTML = '';
  board = Chessboard('board', {
    draggable: true,
    position: G && G.game ? G.game.fen() : 'start',
    showNotation: false,
    pieceTheme: pieceThemeUrl,
    orientation: G ? G.orientation : 'white',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: () => { if (G && G.game && G.viewIndex === G.moves.length) board.position(G.game.fen()); }
  });
  requestAnimationFrame(() => { resizeBoard(); refreshMarks(); });
}

function onDragStart(source, piece) {
  SoundFX.unlock();
  if (!G || !G.game || G.over) return false;
  if (G.viewIndex !== G.moves.length) return false;
  return canMoveColor(piece.charAt(0));
}

function onDrop(source, target) {
  if (source === target) return;
  if (!G || !G.game || G.over) return 'snapback';
  if (G.viewIndex !== G.moves.length) return 'snapback';
  const res = attemptMove(source, target);
  if (res === 'pending') return;      // promotion dialog is open; board updates after the choice
  return res ? undefined : 'snapback';
}

function canMoveColor(color) {
  if (!G || !G.game || G.over) return false;
  if (color !== G.game.turn()) return false;
  switch (G.mode) {
    case 'local': return true;
    case 'online': return color === G.myColor && Network.isOpen();
    case 'ai': return color === 'w';
    default: return false;
  }
}

/* ---------- click-to-move ---------- */

function bindBoardClicks() {
  $('#board').addEventListener('click', (e) => {
    const sqEl = e.target.closest('.square-55d63');
    if (!sqEl || !G || !G.game) return;
    let sq = sqEl.getAttribute('data-square');
    if (!sq) sq = squareFromPoint(e);
    if (sq) handleSquareClick(sq);
  });
}

function squareFromPoint(e) {
  const rect = $('#board').getBoundingClientRect();
  if (!rect.width) return null;
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.width) return null;
  const size = rect.width / 8;
  const file = clamp(Math.floor(x / size), 0, 7);
  const row = clamp(Math.floor(y / size), 0, 7);
  const rank = G.orientation === 'white' ? 7 - row : row;
  return 'abcdefgh'[file] + String(rank + 1);
}

function handleSquareClick(sq) {
  SoundFX.unlock();
  if (!G || !G.game || G.over) return;
  if (G.viewIndex !== G.moves.length) jumpToLive();
  const piece = G.game.get(sq);
  if (G.selected) {
    if (sq === G.selected) { clearSelection(); return; }
    const legal = G.legalMoves.filter(m => m.to === sq);
    if (legal.length) {
      const from = G.selected;
      clearSelection();
      attemptMove(from, sq);
      return;
    }
    if (piece && canMoveColor(piece.color)) selectSquare(sq);
    else clearSelection();
  } else if (piece && canMoveColor(piece.color)) {
    selectSquare(sq);
  }
}

/* ---------- highlights ---------- */

function squareEl(sq) { return $('#board .square-55d63[data-square="' + sq + '"]'); }

function clearBoardMarks() {
  $$('#board .mv-dot').forEach(d => d.remove());
  $$('#board .square-55d63').forEach(el => el.classList.remove('hl-move', 'hl-selected', 'hl-check'));
}

function refreshMarks() {
  if (!G || !G.game) return;
  clearBoardMarks();
  if (G.viewIndex > 0) markLastMove(G.moves[G.viewIndex - 1]);
  const shown = replay(G.viewIndex);
  markCheck(shown);
}

function markLastMove(move) {
  if (!move) return;
  const a = squareEl(move.from), b = squareEl(move.to);
  if (a) a.classList.add('hl-move');
  if (b) b.classList.add('hl-move');
}

function markCheck(chessObj) {
  if (!chessObj || !chessObj.in_check()) return;
  const color = chessObj.turn();
  const b = chessObj.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.type === 'k' && p.color === color) {
        const el = squareEl('abcdefgh'[c] + String(8 - r));
        if (el) el.classList.add('hl-check');
      }
    }
  }
}

function selectSquare(sq) {
  clearSelection();
  G.selected = sq;
  G.legalMoves = G.game.moves({ square: sq, verbose: true });
  const el = squareEl(sq);
  if (el) el.classList.add('hl-selected');
  G.legalMoves.forEach(m => {
    const t = squareEl(m.to);
    if (!t) return;
    const dot = document.createElement('div');
    dot.className = 'mv-dot' + ((m.captured || m.flags.indexOf('e') !== -1) ? ' ring' : '');
    t.appendChild(dot);
  });
}

function clearSelection() {
  G.selected = null;
  G.legalMoves = [];
  $$('#board .mv-dot').forEach(d => d.remove());
  $$('#board .square-55d63.hl-selected').forEach(el => el.classList.remove('hl-selected'));
}

/* ============================ move pipeline ============================ */

function attemptMove(from, to) {
  const promos = G.game.moves({ square: from, verbose: true })
    .filter(m => m.to === to && m.flags.indexOf('p') !== -1);
  if (promos.length) {
    openPromotion(G.game.turn(), (choice) => {
      if (!choice) { board.position(G.game.fen()); return; }
      doMove(from, to, choice);
    });
    return 'pending';
  }
  return doMove(from, to, undefined);
}

function doMove(from, to, promo, opts) {
  opts = opts || {};
  let move;
  try { move = G.game.move({ from: from, to: to, promotion: promo || 'q' }); }
  catch (e) { move = null; }
  if (!move) {
    SoundFX.play('illegal');
    if (board) board.position(G.game.fen());
    return false;
  }
  G.moves.push(move);
  applyIncrement(move.color);
  if (G.mode === 'online' && !opts.remote && Network.isOpen()) {
    Network.send({ type: 'move', from: from, to: to, promo: move.promotion, w: round1(G.clocks.w), b: round1(G.clocks.b) });
  }
  postMove(move);
  return true;
}

function applyIncrement(color) {
  if (G.clocks.inc) G.clocks[color] += G.clocks.inc;
}

function postMove(move) {
  G.viewIndex = G.moves.length;
  board.position(G.game.fen());
  if (move.captured) SoundFX.play('capture');
  else if (move.flags === 'k' || move.flags === 'q') SoundFX.play('castle');
  else SoundFX.play('move');
  renderMoveList();
  renderCaptured();
  refreshMarks();
  if (checkGameEnd()) return;
  if (G.game.in_check()) SoundFX.play('check');
  updateTurnUI();
  maybeAutoFlip();
  maybeAiMove();
}

function checkGameEnd() {
  const g = G.game;
  if (g.in_checkmate())      { finalize(g.turn() === 'w' ? '0-1' : '1-0', 'Checkmate'); return true; }
  if (g.in_stalemate())      { finalize('1/2-1/2', 'Stalemate'); return true; }
  if (g.insufficient_material()) { finalize('1/2-1/2', 'Insufficient material'); return true; }
  if (g.in_threefold_repetition()) { finalize('1/2-1/2', 'Threefold repetition'); return true; }
  if (g.in_draw())           { finalize('1/2-1/2', 'Fifty-move rule'); return true; }
  return false;
}

function finalize(result, reason) {
  if (G.over) return;
  G.over = true;
  G.result = result;
  G.reason = reason;
  stopClocks();
  clearSelection();
  SoundFX.play('end');
  updateTurnUI();
  updateActionButtons();
  showGameOver(result, reason);
}

/* ============================ clocks ============================ */

function startClocks() {
  stopClocks();
  if (!G.hasClock) { updateClockUI(); return; }
  G.activeColor = G.game.turn();
  G.clockLast = Date.now();
  G.clockTimer = setInterval(tickClock, 100);
  updateClockUI();
}

function stopClocks() {
  if (G.clockTimer) { clearInterval(G.clockTimer); G.clockTimer = null; }
}

function tickClock() {
  if (!G.hasClock || G.over || !G.game) return;
  const now = Date.now();
  const dt = (now - G.clockLast) / 1000;
  G.clockLast = now;
  G.activeColor = G.game.turn();
  G.clocks[G.activeColor] = Math.max(0, G.clocks[G.activeColor] - dt);
  updateClockUI();
  if (G.clocks[G.activeColor] <= 0) onFlag(G.activeColor);
}

function hasMatingMaterial(chessObj, color) {
  const b = chessObj.board();
  let minors = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') return true;
      if (p.type === 'n' || p.type === 'b') minors++;
    }
  }
  return minors >= 2;
}

function onFlag(loser) {
  const winner = loser === 'w' ? 'b' : 'w';
  let result = '1/2-1/2', reason = 'Time out — insufficient mating material';
  if (hasMatingMaterial(G.game, winner)) {
    result = winner === 'w' ? '1-0' : '0-1';
    reason = 'Time out';
  }
  if (G.mode === 'online' && Network.isOpen()) {
    Network.send({ type: 'timeout', result: result, reason: reason });
  }
  finalize(result, reason);
}

function fmtClock(s) {
  if (!G.hasClock) return '∞';
  s = Math.max(0, s);
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function barColors() {
  return G.orientation === 'white' ? { top: 'b', bottom: 'w' } : { top: 'w', bottom: 'b' };
}

function updateClockUI() {
  if (!G || !G.game) return;
  const c = barColors();
  const topEl = $('#clock-top'), botEl = $('#clock-bottom');
  topEl.textContent = fmtClock(G.clocks[c.top]);
  botEl.textContent = fmtClock(G.clocks[c.bottom]);
  const lowT = 30;
  topEl.classList.toggle('low', G.hasClock && G.clocks[c.top] < lowT);
  botEl.classList.toggle('low', G.hasClock && G.clocks[c.bottom] < lowT);
  topEl.classList.toggle('active', !G.over && G.hasClock && c.top === G.game.turn());
  botEl.classList.toggle('active', !G.over && G.hasClock && c.bottom === G.game.turn());
}

/* ============================ move list ============================ */

function renderMoveList() {
  const ol = $('#move-list');
  ol.innerHTML = '';
  for (let i = 0; i < G.moves.length; i += 2) {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'mv-num';
    num.textContent = (i / 2 + 1) + '.';
    li.appendChild(num);
    li.appendChild(mvSpan(i));
    if (G.moves[i + 1]) li.appendChild(mvSpan(i + 1));
    ol.appendChild(li);
  }
  highlightCurrentMove();
  ol.scrollTop = ol.scrollHeight;
  $('#move-count').textContent = G.moves.length ? 'Move ' + (Math.floor((G.viewIndex - 1) / 2) + 1) : '';
}

function mvSpan(i) {
  const s = document.createElement('span');
  s.className = 'mv';
  s.dataset.i = i;
  s.textContent = G.moves[i].san;
  return s;
}

function highlightCurrentMove() {
  $$('#move-list .mv').forEach(el => {
    const on = (+el.dataset.i) === G.viewIndex - 1;
    el.classList.toggle('current', on);
    if (on) el.scrollIntoView({ block: 'nearest' });
  });
}

function replay(n) {
  const t = newChess();
  for (let k = 0; k < n && k < G.moves.length; k++) t.move(G.moves[k].san);
  return t;
}

function viewAt(n) {
  n = clamp(n, 0, G.moves.length);
  G.viewIndex = n;
  const shown = replay(n);
  board.position(shown.fen(), false);
  refreshMarks();
  highlightCurrentMove();
  $('#btn-rewind-start').disabled = n === 0;
  $('#btn-rewind').disabled = n === 0;
  $('#btn-forward').disabled = n === G.moves.length;
  $('#btn-forward-end').disabled = n === G.moves.length;
  $('#move-count').textContent = n ? 'Move ' + (Math.floor((n - 1) / 2) + 1) : '';
}

function jumpToLive() { viewAt(G.moves.length); }

/* ============================ captured material ============================ */

const GLYPH = { w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }, b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' } };
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };

function renderCaptured() {
  if (!G || !G.game) return;
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  const b = G.game.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (p && counts[p.color][p.type] !== undefined) counts[p.color][p.type]++;
  }
  let matW = 0, matB = 0;
  ['p', 'n', 'b', 'r', 'q'].forEach(t => { matW += PIECE_VALUE[t] * counts.w[t]; matB += PIECE_VALUE[t] * counts.b[t]; });
  const diff = matW - matB; // > 0: White is up material

  function capturedHtml(byColor) { // pieces captured BY that color
    const victim = byColor === 'w' ? 'b' : 'w';
    let html = '';
    ['q', 'r', 'b', 'n', 'p'].forEach(t => {
      const missing = START_COUNT[t] - counts[victim][t];
      for (let k = 0; k < missing; k++) html += '<span class="' + (victim === 'w' ? 'cw' : 'cb') + '">' + GLYPH[victim][t] + '</span>';
    });
    return html;
  }

  const c = barColors();
  $('#captured-top').innerHTML = capturedHtml(c.top);
  $('#captured-bottom').innerHTML = capturedHtml(c.bottom);
  const advTop = diff * (c.top === 'w' ? 1 : -1);
  const advBot = diff * (c.bottom === 'w' ? 1 : -1);
  $('#adv-top').textContent = advTop > 0 ? '+' + advTop : '';
  $('#adv-bottom').textContent = advBot > 0 ? '+' + advBot : '';
}

/* ============================ players / header UI ============================ */

function nameFor(color) {
  if (G.mode === 'online') return color === G.myColor ? 'You' : 'Opponent';
  if (G.mode === 'ai') return color === 'w' ? 'You' : 'Computer';
  return color === 'w' ? 'White' : 'Black';
}

function updateBars() {
  if (!G) return;
  const c = barColors();
  $('#name-top').textContent = nameFor(c.top);
  $('#name-bottom').textContent = nameFor(c.bottom);
  renderCaptured();
  updateClockUI();
  updateTurnUI();
}

function updateHeader() {
  let title = 'Chess';
  if (G.mode === 'online') title = 'Online • Room ' + (Network.code() || '—');
  else if (G.mode === 'ai') title = 'vs Computer • ' + selectedAiLevel.charAt(0).toUpperCase() + selectedAiLevel.slice(1);
  else if (G.mode === 'local') title = 'Pass & Play';
  $('#header-title').textContent = title;
}

function updateTurnUI() {
  if (!G || !G.game) return;
  const c = barColors();
  $('#bar-top').classList.toggle('turn', !G.over && c.top === G.game.turn());
  $('#bar-bottom').classList.toggle('turn', !G.over && c.bottom === G.game.turn());
  updateClockUI();
}

function setStatus(text) { $('#status-line').textContent = text || ''; }

function updateActionButtons() {
  const over = G.over;
  $('#btn-resign').disabled = over;
  $('#btn-draw').disabled = over;
  updateDrawButton();
}

function mySideColor() { return G.myColor; }

function updateDrawButton() {
  const label = $('#btn-draw');
  if (G.drawOfferedBy && G.drawOfferedBy !== mySideColor()) {
    label.innerHTML = '½<span> Accept draw</span>';
  } else {
    label.innerHTML = '½<span> Draw</span>';
  }
  label.disabled = G.over;
}

function maybeAutoFlip() {
  if (G.mode !== 'local' || !Settings.get('autoFlip') || G.over) return;
  const want = G.game.turn() === 'w' ? 'white' : 'black';
  if (want !== G.orientation) {
    G.orientation = want;
    board.orientation(want);
    updateBars();
    refreshMarks();
  }
}

/* ============================ AI mode ============================ */

function maybeAiMove() {
  if (G.mode !== 'ai' || G.over || G.aiThinking) return;
  if (G.game.turn() !== 'b') return;
  G.aiThinking = true;
  setStatus('🤖 Computer is thinking…');
  setTimeout(() => {
    AI.getBestMove(G.game.fen(), G.aiLevel).then((uci) => {
      G.aiThinking = false;
      setStatus('');
      if (G.over || !uci) return;
      jumpToLiveIfNeeded();
      doMove(uci.slice(0, 2), uci.slice(2, 4), uci.charAt(4) || undefined);
    }).catch(() => { G.aiThinking = false; setStatus(''); });
  }, 350);
}

function jumpToLiveIfNeeded() { if (G.viewIndex !== G.moves.length) jumpToLive(); }

function handleAiDrawOffer() {
  // AI (Black) accepts when it is not objectively better; declines otherwise.
  const b = G.game.board();
  const counts = { w: 0, b: 0 };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (p) counts[p.color] += PIECE_VALUE[p.type] || 0;
  }
  const aiBetter = (counts.b - counts.w) > 1;
  setStatus('');
  if (aiBetter) { toast('Computer declines the draw offer'); G.drawOfferedBy = null; updateDrawButton(); }
  else finalize('1/2-1/2', 'Draw by agreement');
}

/* ============================ game setup ============================ */

function setupGame(mode, opts) {
  opts = opts || {};
  G.mode = mode;
  G.aiLevel = opts.level || selectedAiLevel || 'medium';
  G.myColor = opts.myColor || 'w';
  G.game = newChess();
  G.moves = [];
  G.viewIndex = 0;
  G.over = false;
  G.result = null;
  G.reason = null;
  G.selected = null;
  G.legalMoves = [];
  G.drawOfferedBy = null;
  G.rematchSent = false;
  G.aiThinking = false;
  G.base = opts.base !== undefined ? opts.base : 600;
  G.clocks = { w: G.base, b: G.base, inc: opts.inc || 0 };
  G.hasClock = G.base > 0;
  G.orientation = (mode === 'online' || mode === 'ai') ? (G.myColor === 'w' ? 'white' : 'black') : 'white';
  board.orientation(G.orientation);
  board.position('start');
  updateHeader();
  updateBars();
  renderMoveList();
  renderCaptured();
  clearBoardMarks();
  updateActionButtons();
  setStatus('');
  showScreen('game');
  setTimeout(resizeBoard, 30);
  setTimeout(resizeBoard, 320);
  if (G.hasClock) startClocks(); else updateClockUI();
  SoundFX.play('start');
}

/* ============================ screens & modals ============================ */

function showScreen(name) {
  $('#screen-home').classList.toggle('active', name === 'home');
  $('#screen-game').classList.toggle('active', name === 'game');
  if (name === 'game') setTimeout(resizeBoard, 40);
}

function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }

function toast(msg, sticky) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function hideToast() { $('#toast').classList.remove('show'); clearTimeout(toastTimer); }

function askConfirm(title, text, okLabel, cb) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#btn-confirm-ok').textContent = okLabel || 'Accept';
  confirmCallback = cb;
  openModal('modal-confirm');
}

function showGameOver(result, reason) {
  $('#go-icon').textContent = result === '1/2-1/2' ? '⚖️' : '🏆';
  $('#go-title').textContent = result === '1/2-1/2' ? 'Draw' : (result === '1-0' ? 'White wins' : 'Black wins');
  $('#go-reason').textContent = reason || '';
  $('#btn-go-rematch').style.display = (G.mode === 'online' && !Network.isOpen()) ? 'none' : '';
  openModal('modal-gameover');
}

/* ============================ promotion ============================ */

function openPromotion(color, cb) {
  promoCallback = cb;
  $$('#promo-row .promo-btn').forEach(b => {
    b.style.color = color === 'w' ? '#f2f2f2' : '#15181c';
    b.style.textShadow = color === 'w' ? '0 0 4px rgba(0,0,0,.9)' : '0 0 3px rgba(255,255,255,.4)';
  });
  openModal('modal-promotion');
}

function bindPromotion() {
  $$('#promo-row .promo-btn').forEach(b => {
    b.addEventListener('click', () => {
      closeModal('modal-promotion');
      const cb = promoCallback; promoCallback = null;
      if (cb) cb(b.dataset.piece);
    });
  });
  $('#btn-promo-cancel').addEventListener('click', () => {
    closeModal('modal-promotion');
    const cb = promoCallback; promoCallback = null;
    if (cb) cb(null);
  });
}

/* ============================ online flow ============================ */

let selectedTime = { base: 300, inc: 0 };

function readTimeSelect(id) {
  const v = ($('#' + id).value || '300|0').split('|');
  return { base: parseInt(v[0], 10) || 0, inc: parseInt(v[1], 10) || 0 };
}

function inviteLink(code) {
  return location.origin + location.pathname + '#room=' + code;
}

function bindOnlineModal() {
  $('#btn-create-room').addEventListener('click', () => {
    const err = $('#online-error');
    err.textContent = '';
    selectedTime = readTimeSelect('online-time');
    const btn = $('#btn-create-room');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    Network.createRoom().then((code) => {
      btn.disabled = false;
      btn.textContent = 'Create Room';
      $('#room-info').classList.remove('hidden');
      $('#room-code').textContent = code;
      $('#room-waiting').textContent = 'Waiting for opponent to join…';
      updateHeader();
    }).catch((msg) => {
      btn.disabled = false;
      btn.textContent = 'Create Room';
      err.textContent = msg || 'Could not create the room. Please try again.';
    });
  });

  $('#btn-copy-link').addEventListener('click', () => {
    const code = Network.code();
    if (!code) return;
    const link = inviteLink(code);
    const done = () => toast('Invite link copied to clipboard');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => fallbackCopy(link, done));
    } else fallbackCopy(link, done);
  });

  $('#btn-join-room').addEventListener('click', () => {
    const err = $('#online-error');
    err.textContent = '';
    const raw = $('#join-code').value;
    const btn = $('#btn-join-room');
    btn.disabled = true;
    btn.textContent = 'Joining…';
    Network.joinRoom(raw).then(() => {
      btn.disabled = false;
      btn.textContent = 'Join Room';
      $('#room-waiting') && ($('#room-waiting').textContent = 'Connected — waiting for host…');
      toast('Connected! Waiting for the game to start…');
      closeModal('modal-online');
    }).catch((msg) => {
      btn.disabled = false;
      btn.textContent = 'Join Room';
      err.textContent = msg;
    });
  });

  // closing the online modal while hosting cancels the room
  $('#modal-online').addEventListener('click', (e) => {
    if (e.target === $('#modal-online')) cancelRoomIfHosting();
  });
  $$('#modal-online .modal-close').forEach(b => b.addEventListener('click', cancelRoomIfHosting));
}

function cancelRoomIfHosting() {
  if (Network.isHost() && !G.mode) Network.cleanup();
  if (G.mode !== 'online') { $('#room-info').classList.add('hidden'); $('#online-error').textContent = ''; }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch (e) { toast(text); }
}

/* ---------- network events ---------- */

function bindNetwork() {
  Network.on('playerJoined', () => {          // host side: opponent connected
    SoundFX.play('notify');
    closeModal('modal-online');
    setupGame('online', { myColor: 'w', base: selectedTime.base, inc: selectedTime.inc });
    Network.send({ type: 'start', base: selectedTime.base, inc: selectedTime.inc });
    toast('Opponent joined! You play White.');
  });

  Network.on('start', (d) => {                // joiner side: game begins
    SoundFX.play('notify');
    setupGame('online', { myColor: 'b', base: d.base, inc: d.inc });
    toast('Game started! You play Black.');
  });

  Network.on('move', (d) => {
    if (!G.game || G.over) return;
    jumpToLiveIfNeeded();
    const mv = doMove(d.from, d.to, d.promo, { remote: true });
    if (mv) { G.clocks.w = d.w; G.clocks.b = d.b; updateClockUI(); }
    else if (Network.isHost()) sendState();
  });

  Network.on('resync', () => sendState());

  Network.on('state', (d) => applyState(d));

  Network.on('disconnected', () => {
    if (G.mode !== 'online') return;
    setNetStatus('Connection lost — reconnecting…', 'bad');
    toast('Connection lost — trying to reconnect…', true);
  });

  Network.on('reconnected', () => {
    hideToast();
    if (Network.isHost() && G.mode === 'online') {
      sendState();
      setNetStatus('Opponent reconnected', 'good');
      toast('Opponent reconnected');
    } else {
      setNetStatus('Reconnected — syncing…', 'good');
    }
  });

  Network.on('relistening', () => {
    if (G.mode === 'online') setNetStatus('Connection lost — reconnecting…', 'bad');
  });

  Network.on('latency', (ms) => {
    if (G.mode === 'online' && Network.isOpen()) setNetStatus('Room ' + Network.code() + ' • ' + ms + 'ms', 'good');
  });

  Network.on('fatal', (d) => {
    if (G.mode === 'online') { toast(d.msg || 'Connection error', true); setNetStatus(d.msg || 'Connection error', 'bad'); }
    else { $('#online-error').textContent = d.msg || 'Connection error.'; }
  });

  Network.on('resign', () => {
    const winner = G.myColor === 'w' ? '1-0' : '0-1';
    finalize(winner, 'Resignation');
  });

  Network.on('drawOffer', (d) => {
    G.drawOfferedBy = d.by;
    updateDrawButton();
    SoundFX.play('notify');
    askConfirm('Draw offer', 'Your opponent offers a draw.', 'Accept', (ok) => {
      if (ok) { Network.send({ type: 'drawAnswer', accept: true }); G.drawOfferedBy = null; finalize('1/2-1/2', 'Draw by agreement'); }
      else { Network.send({ type: 'drawAnswer', accept: false }); G.drawOfferedBy = null; updateDrawButton(); }
    });
  });

  Network.on('drawAnswer', (d) => {
    if (d.accept) { G.drawOfferedBy = null; finalize('1/2-1/2', 'Draw by agreement'); }
    else { G.drawOfferedBy = null; updateDrawButton(); toast('Draw offer declined'); }
  });

  Network.on('timeout', (d) => { if (!G.over) finalize(d.result, d.reason); });

  Network.on('rematch', () => {
    SoundFX.play('notify');
    askConfirm('Rematch', 'Your opponent wants a rematch — colors will swap.', 'Accept', (ok) => {
      if (ok) { Network.send({ type: 'rematchAccept' }); beginRematch(); }
      else Network.send({ type: 'rematchDecline' });
    });
  });

  Network.on('rematchAccept', () => beginRematch());
  Network.on('rematchDecline', () => toast('Rematch declined'));
}

function setNetStatus(text, cls) {
  const el = $('#net-status');
  el.textContent = text || '';
  el.className = 'net-status' + (cls ? ' ' + cls : '');
}

function sendState() {
  if (!Network.isOpen()) return;
  Network.send({
    type: 'state',
    moves: G.game.history(),
    w: round1(G.clocks.w),
    b: round1(G.clocks.b),
    over: G.over,
    result: G.result,
    reason: G.reason,
    drawOfferedBy: G.drawOfferedBy
  });
}

function applyState(d) {
  if (!d || !Array.isArray(d.moves)) return;
  G.game = newChess();
  G.moves = [];
  for (let i = 0; i < d.moves.length; i++) {
    const m = G.game.move(d.moves[i]);
    if (m) G.moves.push(m);
  }
  G.clocks.w = d.w; G.clocks.b = d.b;
  G.drawOfferedBy = d.drawOfferedBy || null;
  G.viewIndex = G.moves.length;
  board.position(G.game.fen());
  renderMoveList();
  renderCaptured();
  refreshMarks();
  updateActionButtons();
  updateTurnUI();
  if (d.over) {
    if (!G.over) finalize(d.result, d.reason || 'Game over');
  } else {
    startClocks();
    setNetStatus('Room ' + Network.code() + ' • synced', 'good');
    toast('Game state synced');
  }
}

function beginRematch() {
  closeModal('modal-gameover');
  G.myColor = G.myColor === 'w' ? 'b' : 'w';
  setupGame('online', { myColor: G.myColor, base: G.base, inc: G.clocks.inc });
  toast('Rematch started! You play ' + (G.myColor === 'w' ? 'White' : 'Black') + '.');
}

/* ============================ action buttons ============================ */

function bindActions() {
  $('#btn-home').addEventListener('click', () => {
    if (G.mode === 'online' && !G.over) {
      askConfirm('Leave game?', 'You will resign the current online game.', 'Leave', (ok) => {
        if (!ok) return;
        if (Network.isOpen()) Network.send({ type: 'resign' });
        Network.cleanup();
        leaveToHome();
      });
    } else {
      Network.cleanup();
      leaveToHome();
    }
  });

  $('#btn-resign').addEventListener('click', () => {
    if (G.over) return;
    askConfirm('Resign?', 'Are you sure you want to resign this game?', 'Resign', (ok) => {
      if (!ok) return;
      if (G.mode === 'online' && Network.isOpen()) Network.send({ type: 'resign' });
      const loser = G.mode === 'online' ? G.myColor : G.game.turn();
      finalize(loser === 'w' ? '0-1' : '1-0', 'Resignation');
    });
  });

  $('#btn-draw').addEventListener('click', () => {
    if (G.over) return;
    if (G.mode === 'ai') { handleAiDrawOffer(); return; }
    if (G.mode === 'local') { finalize('1/2-1/2', 'Draw by agreement'); return; }
    if (!Network.isOpen()) { toast('Not connected'); return; }
    if (G.drawOfferedBy && G.drawOfferedBy !== mySideColor()) {
      Network.send({ type: 'drawAnswer', accept: true });
      G.drawOfferedBy = null;
      finalize('1/2-1/2', 'Draw by agreement');
    } else if (!G.drawOfferedBy) {
      G.drawOfferedBy = mySideColor();
      Network.send({ type: 'drawOffer', by: G.myColor });
      updateDrawButton();
      toast('Draw offer sent');
    }
  });

  const requestRematch = () => {
    if (G.mode === 'online') {
      if (!Network.isOpen()) { toast('Not connected'); return; }
      Network.send({ type: 'rematch' });
      G.rematchSent = true;
      toast('Rematch request sent — waiting for opponent…');
    } else {
      closeModal('modal-gameover');
      if (G.mode === 'ai') setupGame('ai', { level: G.aiLevel, base: G.base, inc: G.clocks.inc });
      else setupGame('local', { base: G.base, inc: G.clocks.inc });
    }
  };
  $('#btn-rematch').addEventListener('click', requestRematch);
  $('#btn-go-rematch').addEventListener('click', requestRematch);

  $('#btn-flip').addEventListener('click', () => {
    G.orientation = G.orientation === 'white' ? 'black' : 'white';
    board.orientation(G.orientation);
    updateBars();
    refreshMarks();
  });

  $('#btn-go-home').addEventListener('click', () => { closeModal('modal-gameover'); leaveToHome(); });

  $('#btn-rewind-start').addEventListener('click', () => viewAt(0));
  $('#btn-rewind').addEventListener('click', () => viewAt(G.viewIndex - 1));
  $('#btn-forward').addEventListener('click', () => viewAt(G.viewIndex + 1));
  $('#btn-forward-end').addEventListener('click', () => jumpToLive());

  $('#move-list').addEventListener('click', (e) => {
    const el = e.target.closest('.mv');
    if (el) viewAt((+el.dataset.i) + 1);
  });

  $('#btn-confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    const cb = confirmCallback; confirmCallback = null;
    if (cb) cb(true);
  });
  $('#btn-confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    const cb = confirmCallback; confirmCallback = null;
    if (cb) cb(false);
  });
}

function leaveToHome() {
  stopClocks();
  G.mode = null;
  setNetStatus('');
  setStatus('');
  showScreen('home');
}

/* ============================ home / mode buttons ============================ */

function buildTimeSelects() {
  ['online-time', 'local-time', 'ai-time'].forEach(id => {
    const sel = $('#' + id);
    sel.innerHTML = TIME_PRESETS.map(p =>
      '<option value="' + p.base + '|' + p.inc + '"' + (p.base === 300 && p.inc === 0 ? ' selected' : '') + '>' + p.label + '</option>'
    ).join('');
  });
}

function bindHome() {
  $('#btn-play-online').addEventListener('click', () => { $('#online-error').textContent = ''; openModal('modal-online'); });
  $('#btn-play-local').addEventListener('click', () => openModal('modal-local'));
  $('#btn-play-ai').addEventListener('click', () => openModal('modal-ai'));
  $('#btn-home-settings').addEventListener('click', () => openModal('modal-settings'));
  $('#btn-settings').addEventListener('click', () => openModal('modal-settings'));

  $('#btn-start-local').addEventListener('click', () => {
    const t = readTimeSelect('local-time');
    closeModal('modal-local');
    setupGame('local', { base: t.base, inc: t.inc });
  });

  $$('#modal-ai .diff-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('#modal-ai .diff-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      selectedAiLevel = b.dataset.level;
    });
  });
  $('#btn-start-ai').addEventListener('click', () => {
    const t = readTimeSelect('ai-time');
    closeModal('modal-ai');
    setupGame('ai', { level: selectedAiLevel, base: t.base, inc: t.inc });
  });
}

/* ============================ settings modal ============================ */

function bindSettings() {
  $('#set-theme').value = Settings.get('theme');
  $('#set-pieces').value = Settings.get('pieces');
  $('#set-sound').checked = !!Settings.get('sound');
  $('#set-autoflip').checked = !!Settings.get('autoFlip');
  $('#set-custom-light').value = Settings.get('customLight');
  $('#set-custom-dark').value = Settings.get('customDark');

  const sw = $('#board-swatches');
  sw.innerHTML = '';
  Object.keys(BOARD_THEMES).forEach(key => {
    const b = document.createElement('button');
    b.className = 'swatch' + (Settings.get('board') === key ? ' selected' : '');
    b.dataset.theme = key;
    b.title = key;
    b.innerHTML = '<i style="background:' + BOARD_THEMES[key].light + '"></i><i style="background:' + BOARD_THEMES[key].dark + '"></i><i style="background:' + BOARD_THEMES[key].dark + '"></i><i style="background:' + BOARD_THEMES[key].light + '"></i>';
    b.addEventListener('click', () => {
      Settings.set('board', key);
      $$('#board-swatches .swatch').forEach(x => x.classList.toggle('selected', x === b));
      applyAppearance();
    });
    sw.appendChild(b);
  });

  $('#set-theme').addEventListener('change', (e) => { Settings.set('theme', e.target.value); applyAppearance(); });

  $('#set-pieces').addEventListener('change', (e) => { Settings.set('pieces', e.target.value); rebuildBoard(); });

  $('#set-sound').addEventListener('change', (e) => Settings.set('sound', e.target.checked));
  $('#set-autoflip').addEventListener('change', (e) => {
    Settings.set('autoFlip', e.target.checked);
    if (e.target.checked) maybeAutoFlip();
  });

  $('#set-custom-light').addEventListener('input', (e) => { Settings.set('customLight', e.target.value); Settings.set('board', 'custom'); applyAppearance(); markCustomSwatch(); });
  $('#set-custom-dark').addEventListener('input', (e) => { Settings.set('customDark', e.target.value); Settings.set('board', 'custom'); applyAppearance(); markCustomSwatch(); });
}

function markCustomSwatch() { $$('#board-swatches .swatch').forEach(x => x.classList.remove('selected')); }

/* ============================ responsive board sizing ============================ */

function resizeBoard() {
  if (!board) return;
  const wrap = $('#board-wrap');
  if (!wrap || !$('#screen-game').classList.contains('active')) return;
  const w = wrap.clientWidth;
  const header = $('#game-header').offsetHeight || 52;
  const bar = ($('.player-bar') && $('.player-bar').offsetHeight) || 48;
  const h = window.innerHeight - header - bar * 2 - 60;
  const size = Math.floor(Math.max(240, Math.min(w, h, 640)));
  const el = $('#board');
  if (el && el.style.width !== size + 'px') el.style.width = size + 'px';
  board.resize();
}

/* ============================ invite links ============================ */

function parseInviteHash() {
  const m = (location.hash || '').match(/room=(\d{6})/);
  if (!m) return;
  location.hash = '';
  $('#join-code').value = m[1];
  openModal('modal-online');
  setTimeout(() => $('#join-code').focus(), 150);
}

/* ============================ init ============================ */

function bindModalsGeneric() {
  $$('.modal-close').forEach(b => {
    if (b.closest('#modal-online')) return; // online modal has its own handler (cancels room)
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
  $$('.modal-backdrop').forEach(bd => {
    if (bd.id === 'modal-online') return;
    bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(bd.id); });
  });
}

function init() {
  G.game = newChess();
  applyAppearance();
  buildTimeSelects();
  initBoard();
  bindBoardClicks();
  bindHome();
  bindOnlineModal();
  bindActions();
  bindPromotion();
  bindSettings();
  bindModalsGeneric();
  bindNetwork();
  parseInviteHash();
  showScreen('home');
  AI.init(); // preload Stockfish in the background
  document.addEventListener('pointerdown', () => SoundFX.unlock(), { once: true });
  window.addEventListener('resize', resizeBoard);
  window.addEventListener('orientationchange', () => setTimeout(resizeBoard, 250));
  window.addEventListener('pagehide', () => Network.cleanup(true));
}

document.addEventListener('DOMContentLoaded', init);
