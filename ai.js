'use strict';

(function() {
  const P_VAL = 100, N_VAL = 320, B_VAL = 330, R_VAL = 500, Q_VAL = 900, K_VAL = 20000;

  const PST_PAWN = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ];

  function evaluate(s) {
    let score = 0;
    const b = s.board;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = b[sq];
      if (!p) continue;

      const type = p & 7;
      const isW = (p & 24) === 8;
      let val = 0;

      if (type === 1) val = P_VAL;
      else if (type === 2) val = N_VAL;
      else if (type === 3) val = B_VAL;
      else if (type === 4) val = R_VAL;
      else if (type === 5) val = Q_VAL;
      else if (type === 6) val = K_VAL;

      score += isW ? val : -val;
    }
    return score;
  }

  function minimax(s, depth, alpha, beta, isMaximizing) {
    if (depth === 0) return evaluate(s);

    const moves = window.AzEngine.genLegalMoves(s);
    if (moves.length === 0) {
      if (window.AzEngine.inCheck(s, s.turn === 'w')) {
        return isMaximizing ? -99999 : 99999;
      }
      return 0;
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let m of moves) {
        const nextState = window.AzEngine.cloneState(s);
        window.AzEngine.makeMove(nextState, m);
        const ev = minimax(nextState, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let m of moves) {
        const nextState = window.AzEngine.cloneState(s);
        window.AzEngine.makeMove(nextState, m);
        const ev = minimax(nextState, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function getBestMove(s, level) {
    const moves = window.AzEngine.genLegalMoves(s);
    if (moves.length === 0) return null;

    if (level === 1) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const depth = level === 2 ? 2 : level === 3 ? 3 : 4;
    const isW = s.turn === 'w';
    let bestMove = null;
    let bestVal = isW ? -Infinity : Infinity;

    for (let m of moves) {
      const nextState = window.AzEngine.cloneState(s);
      window.AzEngine.makeMove(nextState, m);
      const val = minimax(nextState, depth - 1, -Infinity, Infinity, !isW);

      if (isW ? (val > bestVal) : (val < bestVal)) {
        bestVal = val;
        bestMove = m;
      }
    }
    return bestMove || moves[0];
  }

  window.AzAI = { getBestMove, evaluate };
})();