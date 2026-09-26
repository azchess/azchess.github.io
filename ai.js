/* ============================================================
   AzChess — ai.js
   Minimax (negamax) + alfa-beta budama + quiescence
   Səviyyələr: 1 Asan | 2 Orta | 3 Çətin | 4 Qrosmeyster
   ============================================================ */
'use strict';
(function () {
  const E = () => AZ.Engine;

  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

  // Piece-Square Tables (ağın perspektivindən, indeks 0 = a8)
  const PST = {
    P: [
       0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 25, 25, 10,  5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       5, 10, 10,-20,-20, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    N: [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ],
    B: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    R: [
       0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       0,  0,  0,  5,  5,  0,  0,  0
    ],
    Q: [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ],
    K: [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       20, 20,  0,  0,  0,  0, 20, 20,
       20, 30, 10,  0,  0, 10, 30, 20
    ]
  };

  // Ağ perspektivindən sentipiyada qiymətləndirmə
  function rawEval() {
    const b = E().board();
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const U = p.toUpperCase();
      const c = AZ.Engine.colorOf(p);
      const v = VAL[U] + PST[U][c === 'w' ? i : i ^ 56];
      s += c === 'w' ? v : -v;
    }
    return s;
  }

  // Gedişdə olan tərəfin perspektivindən
  function evaluate() {
    const cp = rawEval();
    return E().turn() === 'w' ? cp : -cp;
  }

  let nodes = 0;
  const MAX_NODES = 250000;

  function moveScore(m) {
    if (m.captured) return 10 * VAL[m.captured.toUpperCase()] - VAL[m.piece.toUpperCase()] / 10;
    if (m.promotion) return 8000;
    return 0;
  }
  function orderMoves(moves) { moves.sort((a, b) => moveScore(b) - moveScore(a)); }

  // Quiescence: yalnız vurmalar (səthin qiymətləndirməsi)
  function quiesce(alpha, beta, qd) {
    nodes++;
    const stand = evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return alpha;
    const caps = E().allLegal().filter(m => m.captured);
    orderMoves(caps);
    for (const m of caps) {
      E().make(m);
      const s = -quiesce(-beta, -alpha, qd - 1);
      E().unmake();
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
      if (nodes > MAX_NODES) return alpha;
    }
    return alpha;
  }

  function negamax(depth, alpha, beta, ply) {
    nodes++;
    if (depth === 0) return quiesce(alpha, beta, 6);
    const moves = E().allLegal();
    if (!moves.length) return E().inCheck(E().turn()) ? -100000 + ply : 0;
    orderMoves(moves);
    let best = -Infinity;
    for (const m of moves) {
      E().make(m);
      const s = -negamax(depth - 1, -beta, -alpha, ply + 1);
      E().unmake();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
      if (nodes > MAX_NODES) return best;
    }
    return best;
  }

  const LEVELS = {
    1: { d: 1, jit: .4 },   // Asan — tez-tez səhv
    2: { d: 2, jit: .08 },  // Orta
    3: { d: 3, jit: 0 },    // Çətin
    4: { d: 4, jit: 0 }     // Qrosmeyster
  };

  function bestMove(level) {
    const cfg = LEVELS[level] || LEVELS[2];
    const moves = E().allLegal();
    if (!moves.length) return null;
    if (Math.random() < cfg.jit) return moves[Math.floor(Math.random() * moves.length)];

    nodes = 0;
    orderMoves(moves);
    let bestScore = -Infinity;
    const equals = [];
    for (const m of moves) {
      E().make(m);
      const s = -negamax(cfg.d - 1, -Infinity, Infinity, 1);
      E().unmake();
      if (s > bestScore) { bestScore = s; equals.length = 0; equals.push(m); }
      else if (s === bestScore) equals.push(m);
      if (nodes > MAX_NODES) break;
    }
    return equals[Math.floor(Math.random() * equals.length)] || moves[0];
  }

  AZ.AI = { rawEval, evaluate, bestMove };
})();