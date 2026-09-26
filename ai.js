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
      -10, -20,-20,-20,-20,-20,-20,-10,
       20,  20,  0,  0,  0,  0,  20, 20,
       20,  30, 10,  0,  0, 10,  30, 20
    ]
  };

  function rawEval() {
    const b = E().board();
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const U = p.toUpperCase();
      const val = VAL[U];
      const isWhite = p === U;
      const pstIdx = isWhite ? i : 63 - i;
      const pstVal = PST[U] ? PST[U][pstIdx] : 0;
      const total = val + pstVal;
      score += isWhite ? total : -total;
    }
    return score;
  }

  function quiescence(alpha, beta, colorFactor) {
    const standPat = colorFactor * rawEval();
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = E().allLegal().filter(m => m.captured);
    for (const m of moves) {
      E().make(m);
      const score = -quiescence(-beta, -alpha, -colorFactor);
      E().unmake();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function minimax(depth, alpha, beta, colorFactor) {
    if (depth === 0) return quiescence(alpha, beta, colorFactor);
    const moves = E().allLegal();
    if (!moves.length) {
      if (E().inCheck(E().turn())) return -99999 + (4 - depth);
      return 0;
    }
    for (const m of moves) {
      E().make(m);
      const score = -minimax(depth - 1, -beta, -alpha, -colorFactor);
      E().unmake();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function bestMove(level) {
    const moves = E().allLegal();
    if (!moves.length) return null;

    // Səviyyə 1: Asan (təsadüfi və ya zəif gedişlər)
    if (level === 1) {
      if (Math.random() < 0.4) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
    }

    const depth = level === 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 : 4;
    const colorFactor = E().turn() === 'w' ? 1 : -1;

    let best = null;
    let bestVal = -999999;
    let alpha = -1000000;
    const beta = 1000000;

    // Sadə fiqur üstünlüyü sıralaması (heuristic)
    moves.sort((a, b) => {
      let sa = a.captured ? VAL[a.captured.toUpperCase()] || 0 : 0;
      let sb = b.captured ? VAL[b.captured.toUpperCase()] || 0 : 0;
      return sb - sa;
    });

    for (const m of moves) {
      E().make(m);
      const val = -minimax(depth - 1, -beta, -alpha, -colorFactor);
      E().unmake();
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
      if (val > alpha) alpha = val;
    }

    return best || moves[0];
  }

  AZ.AI = { bestMove, rawEval };
})();
