'use strict';

const EMPTY = 0, W = 8, B = 16;
const P = 1, N = 2, BISH = 3, R = 4, Q = 5, K = 6;

const SQUARES = {
  a8:112, b8:113, c8:114, d8:115, e8:116, f8:117, g8:118, h8:119,
  a1:0,   b1:1,   c1:2,   d1:3,   e1:4,   f1:5,   g1:6,   h1:7
};

function isOffboard(sq) { return (sq & 0x88) !== 0; }

function createInitialState() {
  const board = new Array(128).fill(EMPTY);
  const setup = [R, N, BISH, Q, K, BISH, N, R];
  for (let i = 0; i < 8; i++) {
    board[i] = W | setup[i];
    board[16 + i] = W | P;
    board[96 + i] = B | P;
    board[112 + i] = B | setup[i];
  }
  return {
    board,
    turn: 'w',
    castling: 0b1111,
    ep: null,
    halfmove: 0,
    fullmove: 1,
    kingSq: { w: 4, b: 116 }
  };
}

function cloneState(s) {
  return {
    board: [...s.board],
    turn: s.turn,
    castling: s.castling,
    ep: s.ep,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
    kingSq: { ...s.kingSq }
  };
}

function isAttacked(s, sq, byWhite) {
  const b = s.board;
  const col = byWhite ? W : B;

  const pawnDir = byWhite ? -16 : 16;
  for (let pdir of [pawnDir - 1, pawnDir + 1]) {
    const from = sq + pdir;
    if (!isOffboard(from) && b[from] === (col | P)) return true;
  }

  const kOffsets = [33, 31, 18, 14, -33, -31, -18, -14];
  for (let off of kOffsets) {
    const from = sq + off;
    if (!isOffboard(from) && b[from] === (col | N)) return true;
  }

  const rays = [
    { dirs: [15, 17, -15, -17], types: [BISH, Q] },
    { dirs: [16, -16, 1, -1], types: [R, Q] }
  ];
  for (let rayGroup of rays) {
    for (let dir of rayGroup.dirs) {
      let curr = sq + dir;
      while (!isOffboard(curr)) {
        const piece = b[curr];
        if (piece !== EMPTY) {
          if ((piece & 24) === col && rayGroup.types.includes(piece & 7)) return true;
          break;
        }
        curr += dir;
      }
    }
  }

  const kingDirs = [15, 17, -15, -17, 16, -16, 1, -1];
  for (let dir of kingDirs) {
    const from = sq + dir;
    if (!isOffboard(from) && b[from] === (col | K)) return true;
  }

  return false;
}

function inCheck(s, isWhite) {
  return isAttacked(s, s.kingSq[isWhite ? 'w' : 'b'], !isWhite);
}

function genPseudoMoves(s) {
  const moves = [];
  const b = s.board;
  const isW = s.turn === 'w';
  const myCol = isW ? W : B;
  const oppCol = isW ? B : W;

  for (let sq = 0; sq < 128; sq++) {
    if (isOffboard(sq)) continue;
    const p = b[sq];
    if (!p || (p & 24) !== myCol) continue;

    const type = p & 7;

    if (type === P) {
      const fwd = isW ? 16 : -16;
      const nextSq = sq + fwd;
      if (!isOffboard(nextSq) && b[nextSq] === EMPTY) {
        if ((isW && nextSq >= 112) || (!isW && nextSq <= 7)) {
          for (let promo of ['q', 'r', 'b', 'n']) moves.push({ from: sq, to: nextSq, piece: p, promo });
        } else {
          moves.push({ from: sq, to: nextSq, piece: p });
          const startRank = isW ? (sq >= 16 && sq <= 23) : (sq >= 96 && sq <= 103);
          if (startRank && b[sq + fwd * 2] === EMPTY) {
            moves.push({ from: sq, to: sq + fwd * 2, piece: p, doublePush: true });
          }
        }
      }
      for (let capOff of [fwd - 1, fwd + 1]) {
        const capSq = sq + capOff;
        if (isOffboard(capSq)) continue;
        if (b[capSq] && (b[capSq] & 24) === oppCol) {
          if ((isW && capSq >= 112) || (!isW && capSq <= 7)) {
            for (let promo of ['q', 'r', 'b', 'n']) moves.push({ from: sq, to: capSq, piece: p, promo, captured: b[capSq] });
          } else {
            moves.push({ from: sq, to: capSq, piece: p, captured: b[capSq] });
          }
        } else if (capSq === s.ep) {
          moves.push({ from: sq, to: capSq, piece: p, captured: oppCol | P, isEP: true });
        }
      }
    } else if (type === N) {
      for (let off of [33, 31, 18, 14, -33, -31, -18, -14]) {
        const to = sq + off;
        if (isOffboard(to)) continue;
        if (!b[to] || (b[to] & 24) === oppCol) {
          moves.push({ from: sq, to, piece: p, captured: b[to] || null });
        }
      }
    } else if (type === BISH || type === R || type === Q) {
      const dirs = type === BISH ? [15, 17, -15, -17] : type === R ? [16, -16, 1, -1] : [15, 17, -15, -17, 16, -16, 1, -1];
      for (let dir of dirs) {
        let to = sq + dir;
        while (!isOffboard(to)) {
          if (!b[to]) {
            moves.push({ from: sq, to, piece: p });
          } else {
            if ((b[to] & 24) === oppCol) moves.push({ from: sq, to, piece: p, captured: b[to] });
            break;
          }
          to += dir;
        }
      }
    } else if (type === K) {
      for (let off of [15, 17, -15, -17, 16, -16, 1, -1]) {
        const to = sq + off;
        if (isOffboard(to)) continue;
        if (!b[to] || (b[to] & 24) === oppCol) {
          moves.push({ from: sq, to, piece: p, captured: b[to] || null });
        }
      }
      if (isW && sq === 4 && !inCheck(s, true)) {
        if ((s.castling & 1) && !b[5] && !b[6] && !isAttacked(s, 5, false) && !isAttacked(s, 6, false)) {
          moves.push({ from: 4, to: 6, piece: p, castle: 'K' });
        }
        if ((s.castling & 2) && !b[1] && !b[2] && !b[3] && !isAttacked(s, 3, false) && !isAttacked(s, 2, false)) {
          moves.push({ from: 4, to: 2, piece: p, castle: 'Q' });
        }
      } else if (!isW && sq === 116 && !inCheck(s, false)) {
        if ((s.castling & 4) && !b[117] && !b[118] && !isAttacked(s, 117, true) && !isAttacked(s, 118, true)) {
          moves.push({ from: 116, to: 118, piece: p, castle: 'k' });
        }
        if ((s.castling & 8) && !b[113] && !b[114] && !b[115] && !isAttacked(s, 115, true) && !isAttacked(s, 114, true)) {
          moves.push({ from: 116, to: 114, piece: p, castle: 'q' });
        }
      }
    }
  }
  return moves;
}

function makeMove(s, m) {
  const undo = {
    castling: s.castling,
    ep: s.ep,
    halfmove: s.halfmove,
    kingSq: { ...s.kingSq },
    captured: m.captured
  };

  const isW = s.turn === 'w';
  s.board[m.from] = EMPTY;

  if (m.promo) {
    const promoMap = { q: Q, r: R, b: BISH, n: N };
    s.board[m.to] = (isW ? W : B) | promoMap[m.promo];
  } else {
    s.board[m.to] = m.piece;
  }

  if (m.isEP) {
    const capSq = m.to + (isW ? -16 : 16);
    s.board[capSq] = EMPTY;
  }

  if (m.castle) {
    if (m.castle === 'K') { s.board[7] = EMPTY; s.board[5] = W | R; }
    if (m.castle === 'Q') { s.board[0] = EMPTY; s.board[3] = W | R; }
    if (m.castle === 'k') { s.board[119] = EMPTY; s.board[117] = B | R; }
    if (m.castle === 'q') { s.board[112] = EMPTY; s.board[115] = B | R; }
  }

  if ((m.piece & 7) === K) s.kingSq[s.turn] = m.to;

  if (m.from === 0 || m.to === 0) s.castling &= ~2;
  if (m.from === 7 || m.to === 7) s.castling &= ~1;
  if (m.from === 112 || m.to === 112) s.castling &= ~8;
  if (m.from === 119 || m.to === 119) s.castling &= ~4;
  if ((m.piece & 7) === K) s.castling &= isW ? ~3 : ~12;

  s.ep = m.doublePush ? (m.from + (isW ? 16 : -16)) : null;

  if ((m.piece & 7) === P || m.captured) s.halfmove = 0;
  else s.halfmove++;

  if (!isW) s.fullmove++;
  s.turn = isW ? 'b' : 'w';

  return undo;
}

function genLegalMoves(s) {
  const pseudos = genPseudoMoves(s);
  const legals = [];
  const currentTurnIsWhite = s.turn === 'w';
  for (let m of pseudos) {
    const nextState = cloneState(s);
    makeMove(nextState, m);
    if (!inCheck(nextState, currentTurnIsWhite)) {
      legals.push(m);
    }
  }
  return legals;
}

window.AzEngine = {
  createInitialState, cloneState, genLegalMoves, makeMove, inCheck, SQUARES
};

const I18N = {
  az: {
    vsAI: "🤖 AI ilə", passPlay: "👥 Yan-yana", playOnline: "🌐 Onlayn",
    moves: "Gedişlər", draw: "Heç-heçə", resign: "Tərk et", copyPGN: "PGN Kopyala",
    settings: "Tənzimləmələr", boardTheme: "Lövhə Mövzusu", pieceSet: "Fiqur Dəsti",
    difficulty: "AI Səviyyəsi", timeControl: "Vaxt Kontrolu", sound: "Səs Effektləri",
    autoFlip: "Avto Çevirmə", createRoom: "Yeni Otaq Yarat", joinRoom: "Qoşul",
    waiting: "Rəqib gözlənilir...", inviteLink: "Dəvət Linkini Kopyala",
    promotion: "Fiqur Seçin", rematch: "Yenidən Oyna", newGame: "Yeni Oyun"
  },
  en: {
    vsAI: "🤖 vs AI", passPlay: "👥 Pass & Play", playOnline: "🌐 Online",
    moves: "Moves", draw: "Draw", resign: "Resign", copyPGN: "Copy PGN",
    settings: "Settings", boardTheme: "Board Theme", pieceSet: "Piece Set",
    difficulty: "AI Level", timeControl: "Time Control", sound: "Sound Effects",
    autoFlip: "Auto Flip", createRoom: "Create Room", joinRoom: "Join",
    waiting: "Waiting for opponent...", inviteLink: "Copy Invite Link",
    promotion: "Promote Pawn", rematch: "Rematch", newGame: "New Game"
  },
  ru: {
    vsAI: "🤖 c ИИ", passPlay: "👥 Вдвоем", playOnline: "🌐 Онлайн",
    moves: "Ходы", draw: "Ничья", resign: "Сдаться", copyPGN: "Скопировать PGN",
    settings: "Настройки", boardTheme: "Тема доски", pieceSet: "Набор фигур",
    difficulty: "Уровень ИИ", timeControl: "Контроль времени", sound: "Звуки",
    autoFlip: "Автоповорот", createRoom: "Создать комнату", joinRoom: "Войти",
    waiting: "Ожидание соперника...", inviteLink: "Ссылка-приглашение",
    promotion: "Превращение фигуры", rematch: "Реванш", newGame: "Новая игра"
  }
};

class AudioSynth {
  constructor() { this.ctx = null; }
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  play(freq, type = 'sine', duration = 0.1) {
    if (!App.settings.sound) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
}
const soundFx = new AudioSynth();

const App = {
  state: createInitialState(),
  mode: 'ai',
  orientation: 'w',
  myColor: 'w',
  selectedSq: null,
  legalMoves: [],
  history: [],
  viewPly: 0,
  premove: null,
  arrows: [],
  rightClickStart: null,
  clocks: { w: 300, b: 300, inc: 3 },
  timerInterval: null,
  settings: {
    lang: 'az', theme: 'neon', pieceSet: 'cburnett',
    aiLevel: 2, sound: true, autoFlip: false
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  resetGame();
});

function initUI() {
  renderBoardFramework();
  setupEventListeners();
  updateI18n();
}

function renderBoardFramework() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = r * 16 + f;
      const squareEl = document.createElement('div');
      squareEl.className = `square ${(r + f) % 2 === 0 ? 'dark' : 'light'}`;
      squareEl.dataset.sq = sq;

      if (f === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'coord coord-rank';
        rankLabel.textContent = r + 1;
        squareEl.appendChild(rankLabel);
      }
      if (r === 0) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'coord coord-file';
        fileLabel.textContent = String.fromCharCode(97 + f);
        squareEl.appendChild(fileLabel);
      }

      boardEl.appendChild(squareEl);
    }
  }
  refreshBoardView();
}

function refreshBoardView() {
  const boardEl = document.getElementById('board');
  const isFlipped = App.orientation === 'b';
  boardEl.style.transform = isFlipped ? 'rotate(180deg)' : 'none';

  const squares = boardEl.querySelectorAll('.square');
  squares.forEach(sqEl => {
    const sq = parseInt(sqEl.dataset.sq);
    sqEl.style.transform = isFlipped ? 'rotate(180deg)' : 'none';

    const oldPiece = sqEl.querySelector('.piece');
    if (oldPiece) oldPiece.remove();

    const oldDots = sqEl.querySelectorAll('.legal-dot, .legal-capture');
    oldDots.forEach(d => d.remove());

    sqEl.classList.remove('selected', 'check');

    const p = App.state.board[sq];
    if (p !== EMPTY) {
      const pieceEl = document.createElement('div');
      pieceEl.className = 'piece';
      setPieceImage(pieceEl, p);
      sqEl.appendChild(pieceEl);
    }

    if (App.selectedSq === sq) sqEl.classList.add('selected');

    if (inCheck(App.state, App.state.turn === 'w') && App.state.kingSq[App.state.turn] === sq) {
      sqEl.classList.add('check');
    }
  });

  if (App.selectedSq !== null) {
    const valid = App.legalMoves.filter(m => m.from === App.selectedSq);
    valid.forEach(m => {
      const targetSqEl = boardEl.querySelector(`[data-sq="${m.to}"]`);
      if (targetSqEl) {
        const indicator = document.createElement('div');
        indicator.className = m.captured ? 'legal-capture' : 'legal-dot';
        targetSqEl.appendChild(indicator);
      }
    });
  }
  updateEvalBar();
}

function setPieceImage(el, p) {
  const isWhite = (p & 24) === W;
  const typeMap = { [P]: 'p', [N]: 'n', [BISH]: 'b', [R]: 'r', [Q]: 'q', [K]: 'k' };
  const name = (isWhite ? 'w' : 'b') + typeMap[p & 7];

  if (App.settings.pieceSet === 'unicode') {
    const uniMap = {
      wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
      bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚'
    };
    el.textContent = uniMap[name];
    el.style.fontSize = '2.8rem';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
  } else {
    const url = `https://lichess1.org/assets/piece/${App.settings.pieceSet}/${name}.svg`;
    el.style.backgroundImage = `url('${url}')`;
  }
}

function setupEventListeners() {
  const boardEl = document.getElementById('board');

  boardEl.addEventListener('click', (e) => {
    const sqEl = e.target.closest('.square');
    if (!sqEl) return;
    const sq = parseInt(sqEl.dataset.sq);
    handleSquareClick(sq);
  });

  document.querySelectorAll('.btn-mode').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      App.mode = e.target.id.replace('btn-mode-', '');
      if (App.mode === 'online') {
        openModal('modal-online');
      } else {
        resetGame();
      }
    });
  });

  document.getElementById('btn-open-settings').onclick = () => openModal('modal-settings');
  document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);

  document.getElementById('sel-lang').onchange = (e) => {
    App.settings.lang = e.target.value;
    updateI18n();
  };

  document.getElementById('set-board-theme').onchange = (e) => {
    document.body.setAttribute('data-theme', e.target.value);
  };
}

function handleSquareClick(sq) {
  if (App.selectedSq === null) {
    if (App.state.board[sq] !== EMPTY) {
      const isWhitePiece = (App.state.board[sq] & 24) === W;
      if ((isWhitePiece && App.state.turn === 'w') || (!isWhitePiece && App.state.turn === 'b')) {
        App.selectedSq = sq;
        App.legalMoves = window.AzEngine.genLegalMoves(App.state);
        soundFx.play(400, 'sine', 0.05);
      }
    }
  } else {
    const move = App.legalMoves.find(m => m.from === App.selectedSq && m.to === sq);
    if (move) {
      executeMove(move);
    }
    App.selectedSq = null;
  }
  refreshBoardView();
}

function executeMove(m) {
  const undo = window.AzEngine.makeMove(App.state, m);
  App.history.push({ move: m, undo });
  App.viewPly = App.history.length;

  if (m.captured) soundFx.play(800, 'triangle', 0.15);
  else soundFx.play(600, 'sine', 0.08);

  refreshBoardView();
  updateMoveList();

  if (App.mode === 'ai' && App.state.turn === 'b') {
    setTimeout(() => {
      if (window.AzAI) {
        const aiMove = window.AzAI.getBestMove(App.state, App.settings.aiLevel);
        if (aiMove) executeMove(aiMove);
      }
    }, 300);
  }
}

function updateMoveList() {
  const tbody = document.getElementById('moves-list');
  tbody.innerHTML = '';
  for (let i = 0; i < App.history.length; i += 2) {
    const tr = document.createElement('tr');
    const numTd = document.createElement('td');
    numTd.textContent = Math.floor(i / 2) + 1;

    const wTd = document.createElement('td');
    wTd.textContent = formatMoveSan(App.history[i].move);

    const bTd = document.createElement('td');
    bTd.textContent = App.history[i + 1] ? formatMoveSan(App.history[i + 1].move) : '';

    tr.appendChild(numTd); tr.appendChild(wTd); tr.appendChild(bTd);
    tbody.appendChild(tr);
  }
}

function formatMoveSan(m) {
  const files = ['a','b','c','d','e','f','g','h'];
  const toStr = files[m.to % 16] + (Math.floor(m.to / 16) + 1);
  return toStr;
}

function updateEvalBar() {
  let score = 0;
  for (let i = 0; i < 128; i++) {
    if (isOffboard(i)) continue;
    const p = App.state.board[i];
    if (!p) continue;
    const val = [0, 1, 3, 3, 5, 9, 0][p & 7];
    score += ((p & 24) === W) ? val : -val;
  }
  const fillPct = Math.min(Math.max(50 + score * 5, 5), 95);
  document.getElementById('eval-fill').style.height = `${fillPct}%`;
  document.getElementById('eval-text').textContent = (score >= 0 ? '+' : '') + score.toFixed(1);
}

function resetGame() {
  App.state = window.AzEngine.createInitialState();
  App.history = [];
  App.selectedSq = null;
  refreshBoardView();
  updateMoveList();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }

function updateI18n() {
  const dict = I18N[App.settings.lang] || I18N.az;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
}