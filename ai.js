/* =========================================================
 * ai.js — Chess engine wrapper.
 * Uses Stockfish 10 (WASM/asm.js via CDN) when available and
 * transparently falls back to a built-in alpha-beta engine
 * (piece-square tables) so "Play vs Computer" always works,
 * even fully offline or if the CDN is unreachable.
 * ========================================================= */
'use strict';

const AI = (() => {

  /* ---------- difficulty profiles ---------- */
  const LEVELS = {
    easy:   { skill: 4,  movetime: 250,  depth: 1, jitter: 140, label: 'Easy' },
    medium: { skill: 10, movetime: 600,  depth: 2, jitter: 12,  label: 'Medium' },
    hard:   { skill: 20, movetime: 1200, depth: 3, jitter: 0,   label: 'Hard' }
  };

  const ENGINE_URLS = [
    'https://cdn.jsdelivr.net/npm/stockfish@10.0.2/src/stockfish.js',
    'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.min.js'
  ];

  let engine = null;
  let engineReady = false;
  let engineLoading = null;
  let pendingSearch = null;
  let searchSeq = 0;

  /* ================= Stockfish loading ================= */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function bootEngine(factory) {
    engine = factory();
    const handler = (line) => {
      line = String(line && line.data ? line.data : line);
      if (line.indexOf('uciok') !== -1) {
        engine.postMessage('setoption name Skill Level value 10');
        engine.postMessage('isready');
      } else if (line.indexOf('readyok') !== -1) {
        engineReady = true;
      } else if (line.indexOf('bestmove') === 0) {
        const parts = line.split(/\s+/);
        const best = parts[1];
        const cb = pendingSearch;
        pendingSearch = null;
        if (cb && best && best !== '(none)' && best.indexOf('(none)') !== 0) cb(best);
      }
    };
    engine.onmessage = handler;
    try { engine.addEventListener('message', (ev) => handler(ev.data)); } catch (e) { /* onmessage alone is fine */ }
    engine.postMessage('uci');
  }

  function init() {
    if (engineLoading) return engineLoading;
    engineLoading = (async () => {
      for (const url of ENGINE_URLS) {
        try {
          await loadScript(url);
          const factory = window.STOCKFISH || window.stockfish;
          if (typeof factory === 'function') { bootEngine(factory); return true; }
        } catch (e) { /* try next CDN */ }
      }
      return false; // fallback engine will be used
    })();
    return engineLoading;
  }

  function stockfishBestMove(fen, level) {
    const lv = LEVELS[level] || LEVELS.medium;
    return new Promise((resolve) => {
      const seq = ++searchSeq;
      const guard = setTimeout(() => {
        if (searchSeq === seq) { pendingSearch = null; resolve(fallbackBestMove(fen, level)); }
      }, lv.movetime * 4 + 3000);
      pendingSearch = (mv) => {
        clearTimeout(guard);
        if (searchSeq === seq) resolve(mv);
      };
      try {
        engine.postMessage('setoption name Skill Level value ' + lv.skill);
        engine.postMessage('position fen ' + fen);
        engine.postMessage('go movetime ' + lv.movetime);
      } catch (e) {
        clearTimeout(guard);
        pendingSearch = null;
        resolve(fallbackBestMove(fen, level));
      }
    });
  }

  /* ================= Built-in fallback engine ================= */

  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [  0,  0,  0,  0,  0,  0,  0,  0,
         50, 50, 50, 50, 50, 50, 50, 50,
         10, 10, 20, 30, 30, 20, 10, 10,
          5,  5, 10, 25, 25, 10,  5,  5,
          0,  0,  0, 20, 20,  0,  0,  0,
          5, -5,-10,  0,  0,-10, -5,  5,
          5, 10, 10,-20,-20, 10, 10,  5,
          0,  0,  0,  0,  0,  0,  0,  0 ],
    n: [-50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50 ],
    b: [-20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20 ],
    r: [  0,  0,  0,  0,  0,  0,  0,  0,
          5, 10, 10, 10, 10, 10, 10,  5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
          0,  0,  0,  5,  5,  0,  0,  0 ],
    q: [-20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
         -5,  0,  5,  5,  5,  5,  0, -5,
          0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20 ],
    k: [-30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
         20, 20,  0,  0,  0,  0, 20, 20,
         20, 30, 10,  0,  0, 10, 30, 20 ]
  };

  function evaluate(g) {
    const b = g.board();
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        const sq = r * 8 + c;
        const v = VAL[p.type] + (p.color === 'w' ? PST[p.type][sq] : PST[p.type][sq ^ 56]);
        score += p.color === 'w' ? v : -v;
      }
    }
    return score;
  }

  function moveOrder(m) {
    return (m.captured ? VAL[m.captured] * 10 - VAL[m.piece] : 0) + (m.promotion ? 900 : 0);
  }

  function negamax(g, depth, alpha, beta) {
    if (g.game_over()) {
      if (g.in_checkmate()) return -100000 - depth; // prefer the fastest mate
      return 0; // stalemate / insufficient material / fifty-move
    }
    if (depth === 0) {
      const s = evaluate(g);
      return g.turn() === 'w' ? s : -s;
    }
    const moves = g.moves({ verbose: true }).sort((a, b) => moveOrder(b) - moveOrder(a));
    let best = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      g.move(moves[i]);
      const s = -negamax(g, depth - 1, -beta, -alpha);
      g.undo();
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function fallbackBestMove(fen, level) {
    const lv = LEVELS[level] || LEVELS.medium;
    const g = new Chess(fen);
    const moves = g.moves({ verbose: true });
    if (!moves.length) return null;
    moves.sort((a, b) => moveOrder(b) - moveOrder(a));
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      g.move(moves[i]);
      const s = -negamax(g, lv.depth - 1, -Infinity, Infinity);
      g.undo();
      const score = s + Math.random() * lv.jitter;
      if (score > bestScore) { bestScore = score; best = moves[i]; }
    }
    return best.from + best.to + (best.promotion || '');
  }

  /* ================= Public API ================= */

  function getBestMove(fen, level) {
    const lv = LEVELS[level] || LEVELS.medium;
    if (engineReady) {
      return stockfishBestMove(fen, level).catch(() => fallbackBestMove(fen, level));
    }
    // give Stockfish a brief chance if it is still booting
    return new Promise((resolve) => {
      let done = false;
      const finish = (mv) => { if (!done) { done = true; resolve(mv); } };
      setTimeout(() => finish(fallbackBestMove(fen, level)), lv.movetime + 400);
      if (engineReady) stockfishBestMove(fen, level).then(finish);
      else {
        const poll = setInterval(() => {
          if (engineReady) { clearInterval(poll); stockfishBestMove(fen, level).then(finish); }
        }, 120);
        setTimeout(() => clearInterval(poll), lv.movetime + 380);
      }
    });
  }

  return {
    init: init,
    getBestMove: getBestMove,
    isReady: () => engineReady
  };
})();
