/* ============================================================
   AzChess — game.js
   Şahmat mühərriki + taxta UI + premove + oxlar + səs + i18n
   ============================================================ */
'use strict';
window.AZ = window.AZ || {};

/* ==================== ŞAHMAT MÜHƏRRIKI ==================== */
AZ.Engine = (function () {
  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let board = new Array(64).fill(null), turn = 'w', castling = {K:true, Q:true, k:true, q:true}, ep = -1, halfmove = 0, fullmove = 1, undoStack = [];

  const fileOf  = s => s & 7;
  const rankOf  = s => s >> 3;
  const sq      = (f, r) => r * 8 + f;
  const name    = s => FILES[fileOf(s)] + (rankOf(s) + 1);
  const colorOf = p => (p === p.toUpperCase() ? 'w' : 'b');

  function load(fen) {
    const parts = fen.split(' ');
    board = new Array(64).fill(null);
    parts[0].split('/').forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += +ch;
        else board[sq(f++, r)] = ch;
      }
    });
    turn = parts[1];
    castling = {
      K: parts[2].includes('K'), Q: parts[2].includes('Q'),
      k: parts[2].includes('k'), q: parts[2].includes('q')
    };
    ep = parts[3] === '-' ? -1 : FILES.indexOf(parts[3][0]) + (8 - +parts[3][1]) * 8;
    halfmove = +parts[4] || 0;
    fullmove = +parts[5] || 1;
    undoStack = [];
  }

  function fen() {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let row = '', empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = board[sq(f, r)];
        if (p) { if (empty) { row += empty; empty = 0; } row += p; }
        else empty++;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    const c = (castling.K ? 'K' : '') + (castling.Q ? 'Q' : '') + (castling.k ? 'k' : '') + (castling.q ? 'q' : '') || '-';
    return [rows.join('/'), turn, c, ep >= 0 ? name(ep) : '-', halfmove, fullmove].join(' ');
  }

  function kingSq(c) {
    const k = c === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (board[i] === k) return i;
    return -1;
  }

  function isAttacked(s, byColor) {
    const f = fileOf(s), r = rankOf(s);
    if (byColor === 'w') {
      if (f > 0 && r < 7 && board[s + 7] === 'P') return true;
      if (f < 7 && r < 7 && board[s + 9] === 'P') return true;
    } else {
      if (f > 0 && r > 0 && board[s - 9] === 'p') return true;
      if (f < 7 && r > 0 && board[s - 7] === 'p') return true;
    }
    const NO = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    const nP = byColor === 'w' ? 'N' : 'n';
    for (const [df, dr] of NO) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && board[sq(nf, nr)] === nP) return true;
    }
    const kP = byColor === 'w' ? 'K' : 'k';
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && board[sq(nf, nr)] === kP) return true;
    }
    const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const straight = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const scan = (dirs, pieces) => {
      for (const [df, dr] of dirs) {
        let nf = f + df, nr = r + dr;
        while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          const p = board[sq(nf, nr)];
          if (p) { if (colorOf(p) === byColor && pieces.includes(p.toUpperCase())) return true; break; }
          nf += df; nr += dr;
        }
      }
      return false;
    };
    if (scan(diag, ['B', 'Q'])) return true;
    if (scan(straight, ['R', 'Q'])) return true;
    return false;
  }

  function inCheck(c) { return isAttacked(kingSq(c), c === 'w' ? 'b' : 'w'); }

  function addCastles(c, moves) {
    const opp = c === 'w' ? 'b' : 'w';
    if (c === 'w' && board[60] === 'K') {
      if (castling.K && !board[61] && !board[62] &&
          !isAttacked(60, opp) && !isAttacked(61, opp) && !isAttacked(62, opp))
        moves.push({ from: 60, to: 62, piece: 'K', castle: 'K' });
      if (castling.Q && !board[59] && !board[58] && !board[57] &&
          !isAttacked(60, opp) && !isAttacked(59, opp) && !isAttacked(58, opp))
        moves.push({ from: 60, to: 58, piece: 'K', castle: 'Q' });
    }
    if (c === 'b' && board[4] === 'k') {
      if (castling.k && !board[5] && !board[6] &&
          !isAttacked(4, opp) && !isAttacked(5, opp) && !isAttacked(6, opp))
        moves.push({ from: 4, to: 6, piece: 'k', castle: 'K' });
      if (castling.q && !board[3] && !board[2] && !board[1] &&
          !isAttacked(4, opp) && !isAttacked(3, opp) && !isAttacked(2, opp))
        moves.push({ from: 4, to: 2, piece: 'k', castle: 'Q' });
    }
  }

  function pseudo(s, capsOnly) {
    const p = board[s];
    if (!p) return [];
    const c = colorOf(p), f = fileOf(s), r = rankOf(s), U = p.toUpperCase();
    const moves = [];
    const addQuiet = to => moves.push({ from: s, to, piece: p, captured: null });
    const addCap = (to, extra) => moves.push(Object.assign({ from: s, to, piece: p, captured: board[to] || null }, extra));

    if (U === 'N' || U === 'K') {
      const offs = U === 'N'
        ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
        : [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      for (const [df, dr] of offs) {
        const nf = f + df, nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const t = board[sq(nf, nr)];
        if (!t) addQuiet(sq(nf, nr));
        else if (colorOf(t) !== c) addCap(sq(nf, nr));
      }
      if (U === 'K' && !capsOnly) addCastles(c, moves);
    } else if (U === 'B' || U === 'R' || U === 'Q') {
      const dirs = U === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        : U === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [df, dr] of dirs) {
        let nf = f + df, nr = r + dr;
        while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          const t = board[sq(nf, nr)];
          if (!t) addQuiet(sq(nf, nr));
          else { if (colorOf(t) !== c) addCap(sq(nf, nr)); break; }
          nf += df; nr += dr;
        }
      }
    } else {
      const dir = c === 'w' ? -8 : 8;
      const promoRow = c === 'w' ? 0 : 7;
      const step = c === 'w' ? -1 : 1;
      for (const df of [-1, 1]) {
        const nf = f + df, nr = r + step;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const to = sq(nf, nr);
        if (board[to] && colorOf(board[to]) !== c) {
          if (nr === promoRow)
            for (const pr of ['q', 'r', 'b', 'n']) addCap(to, { promotion: pr });
          else addCap(to);
        } else if (to === ep) {
          const cs = to + (c === 'w' ? 8 : -8);
          moves.push({ from: s, to, piece: p, captured: board[cs], ep: true });
        }
      }
      if (!capsOnly) {
        const one = s + dir;
        if (!board[one]) {
          if (rankOf(one) === promoRow)
            for (const pr of ['q', 'r', 'b', 'n']) moves.push({ from: s, to: one, piece: p, captured: null, promotion: pr });
          else addQuiet(one);
          const two = s + dir * 2;
          if (r === (c === 'w' ? 6 : 1) && !board[two])
            moves.push({ from: s, to: two, piece: p, captured: null, double: true });
        }
      }
    }
    return moves;
  }

  function make(m) {
    const u = { m, epCaptured: null, castling: Object.assign({}, castling), ep, halfmove, fullmove };
    if (m.ep) {
      const cs = m.to + (turn === 'w' ? 8 : -8);
      u.epCaptured = board[cs];
      board[cs] = null;
    }
    board[m.to] = m.promotion ? (turn === 'w' ? m.promotion.toUpperCase() : m.promotion) : m.piece;
    board[m.from] = null;
    if (m.castle === 'K') { const r = turn === 'w' ? 63 : 7; board[r - 2] = board[r]; board[r] = null; }
    if (m.castle === 'Q') { const r = turn === 'w' ? 56 : 0; board[r + 3] = board[r]; board[r] = null; }
    if (m.piece === 'K') { castling.K = castling.Q = false; }
    if (m.piece === 'k') { castling.k = castling.q = false; }
    const clearRook = (s, right) => { if (s === m.from || s === m.to) castling[right] = false; };
    clearRook(56, 'Q'); clearRook(63, 'K'); clearRook(0, 'q'); clearRook(7, 'k');
    ep = -1;
    if (m.piece === 'P' || m.piece === 'p') {
      if (Math.abs(m.to - m.from) === 16) ep = (m.to + m.from) / 2;
      halfmove = 0;
    } else if (m.captured || u.epCaptured) halfmove = 0;
    else halfmove++;
    if (turn === 'b') fullmove++;
    turn = turn === 'w' ? 'b' : 'w';
    undoStack.push(u);
  }

  function unmake() {
    const u = undoStack.pop();
    if (!u) return;
    const m = u.m;
    turn = turn === 'w' ? 'b' : 'w';
    board[m.from] = m.piece;
    board[m.to] = null;
    if (m.captured && !m.ep) board[m.to] = m.captured;
    if (m.ep) { board[m.to] = null; board[m.to + (turn === 'w' ? 8 : -8)] = u.epCaptured; }
    if (m.castle === 'K') { const r = turn === 'w' ? 63 : 7; board[r] = board[r - 2]; board[r - 2] = null; }
    if (m.castle === 'Q') { const r = turn === 'w' ? 56 : 0; board[r] = board[r + 3]; board[r + 3] = null; }
    castling = u.castling; ep = u.ep; halfmove = u.halfmove; fullmove = u.fullmove;
  }

  function legalFrom(s) {
    const p = board[s];
    if (!p) return [];
    const c = colorOf(p), out = [];
    for (const m of pseudo(s, false)) {
      make(m);
      if (!isAttacked(kingSq(c), c === 'w' ? 'b' : 'w')) out.push(m);
      unmake();
    }
    return out;
  }

  function allLegal() {
    const out = [];
    for (let i = 0; i < 64; i++)
      if (board[i] && colorOf(board[i]) === turn) out.push.apply(out, legalFrom(i));
    return out;
  }

  function insufficient() {
    const rest = board.filter(p => p && p.toUpperCase() !== 'K');
    if (rest.length === 0) return true;
    if (rest.length === 1 && 'BNbn'.includes(rest[0])) return true;
    return false;
  }

  function status() {
    if (!allLegal().length) return inCheck(turn) ? 'checkmate' : 'stalemate';
    if (halfmove >= 100) return 'fifty';
    if (insufficient()) return 'insufficient';
    return 'playing';
  }

  function moveSAN(m) {
    let san;
    if (m.castle === 'K') san = 'O-O';
    else if (m.castle === 'Q') san = 'O-O-O';
    else if (m.piece.toUpperCase() === 'P') {
      san = (m.captured ? FILES[fileOf(m.from)] + 'x' : '') + name(m.to);
      if (m.promotion) san += '=' + m.promotion.toUpperCase();
      if (m.ep) san += ' e.p.';
    } else {
      const U = m.piece.toUpperCase();
      const others = allLegal().filter(x => x !== m && x.piece === m.piece && x.to === m.to);
      let dis = '';
      if (others.length) {
        if (!others.some(o => fileOf(o.from) === fileOf(m.from))) dis = FILES[fileOf(m.from)];
        else if (!others.some(o => rankOf(o.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
        else dis = name(m.from);
      }
      san = U + dis + (m.captured ? 'x' : '') + name(m.to);
    }
    make(m);
    if (inCheck(turn)) san += allLegal().length ? '+' : '#';
    unmake();
    return san;
  }

  return {
    reset: () => load(START_FEN), load, fen,
    board: () => board, turn: () => turn,
    legalFrom, allLegal, make, unmake,
    inCheck, status, moveSAN,
    name, fileOf, rankOf, sq, colorOf
  };
})();

/* ==================== TƏRCÜMƏLƏR (i18n) ==================== */
AZ.I18N = {
  az: {
    tagline: 'Müasir onlayn şahmat təcrübəsi',
    modeOnline: 'Onlayn Oyna', modePvp: 'Pass & Play', modeAi: 'Kompüterə Qarşı',
    createRoom: 'Otaq yarat', join: 'Qoşul', or: 'və ya', codePlaceholder: '6 rəqəmli kod',
    shareCode: '6 rəqəmli kodu rəqibinlə paylaş:', copyLink: 'Dəvət linkini kopyala', copied: 'Kopyalandı!',
    cancel: 'Ləğv et', waiting: 'Rəqib gözlənilir…', connecting: 'Bağlanılır…', creating: 'Otaq yaradılır…',
    roomNotFound: 'Otaq tapılmadı!', netError: 'Şəbəkə xətası',
    newGame: 'Yeni oyun', flipBoard: 'Lövhəni çevir', resign: 'Təslim ol',
    settings: 'Parametrlər', theme: 'Lövhə mövzusu', difficulty: 'Səviyyə', sound: 'Səs effektləri', language: 'Dil',
    classic: 'Klassik Qəhvəyi', blue: 'Mavi', green: 'Chess.com Yaşıl', purple: 'Bənövşəyi', neon: 'Neon',
    level1: 'Asan', level2: 'Orta', level3: 'Çətin', level4: 'Qrosmeyster',
    whiteToMove: 'Ağ gedişdə', blackToMove: 'Qara gedişdə', check: 'Şah!',
    checkmate: 'Mat!', stalemate: 'Pat', insufficient: 'Material azlığı', fifty: '50 gediş qaydası',
    draw: 'Heç-heçə', whiteWins: 'Ağ qalib gəldi! 🏆', blackWins: 'Qara qalib gəldi! 🏆',
    youWin: 'Siz qalib gəldiniz! 🎉', youLose: 'Siz uduzdunuz',
    aiThinking: 'Kompüter düşünür…', choosePromotion: 'Piyadanı fiqura çevirin',
    menu: 'Menyu', opponentLeft: 'Rəqib bağlantını kəsdi — siz qalibsiniz',
    rematchSent: 'Revansh təklifi göndərildi', rematchOffer: 'Rəqib revansh istəyir — "Yeni oyun" basın',
    viewing: 'Keçmiş mövqe', opponentResigned: 'Rəqib təslim oldu',
    drawSuffix: 'Heç-heçə'
  },
  en: {
    tagline: 'A modern online chess experience',
    modeOnline: 'Play Online', modePvp: 'Pass & Play', modeAi: 'vs Computer',
    createRoom: 'Create Room', join: 'Join', or: 'or', codePlaceholder: '6-digit code',
    shareCode: 'Share this 6-digit code with your opponent:', copyLink: 'Copy invite link', copied: 'Copied!',
    cancel: 'Cancel', waiting: 'Waiting for opponent…', connecting: 'Connecting…', creating: 'Creating room…',
    roomNotFound: 'Room not found!', netError: 'Network error',
    newGame: 'New Game', flipBoard: 'Flip Board', resign: 'Resign',
    settings: 'Settings', theme: 'Board Theme', difficulty: 'Difficulty', sound: 'Sound Effects', language: 'Language',
    classic: 'Classic Brown', blue: 'Blue', green: 'Chess.com Green', purple: 'Purple', neon: 'Neon',
    level1: 'Easy', level2: 'Medium', level3: 'Hard', level4: 'Master',
    whiteToMove: 'White to move', blackToMove: 'Black to move', check: 'Check!',
    checkmate: 'Checkmate!', stalemate: 'Stalemate', insufficient: 'Insufficient material', fifty: 'Fifty-move rule',
    draw: 'Draw', whiteWins: 'White wins! 🏆', blackWins: 'Black wins! 🏆',
    youWin: 'You win! 🎉', youLose: 'You lose',
    aiThinking: 'Computer is thinking…', choosePromotion: 'Promote pawn to',
    menu: 'Menu', opponentLeft: 'Opponent disconnected — you win',
    rematchSent: 'Rematch offer sent', rematchOffer: 'Opponent wants a rematch — press "New Game"',
    viewing: 'Viewing past position', opponentResigned: 'Opponent resigned',
    drawSuffix: 'Draw'
  },
  ru: {
    tagline: 'Современный онлайн-шахматный опыт',
    modeOnline: 'Играть онлайн', modePvp: 'Вдвоём', modeAi: 'С компьютером',
    createRoom: 'Создать комнату', join: 'Войти', or: 'или', codePlaceholder: '6-значный код',
    shareCode: 'Поделитесь этим 6-значным кодом с соперником:', copyLink: 'Скопировать ссылку', copied: 'Скопировано!',
    cancel: 'Отмена', waiting: 'Ожидание соперника…', connecting: 'Подключение…', creating: 'Создание комнаты…',
    roomNotFound: 'Комната не найдена!', netError: 'Ошибка сети',
    newGame: 'Новая игра', flipBoard: 'Перевернуть', resign: 'Сдаться',
    settings: 'Настройки', theme: 'Тема доски', difficulty: 'Сложность', sound: 'Звуковые эффекты', language: 'Язык',
    classic: 'Классический коричневый', blue: 'Синий', green: 'Зелёный Chess.com', purple: 'Фиолетовый', neon: 'Неон',
    level1: 'Лёгкий', level2: 'Средний', level3: 'Сложный', level4: 'Гроссмейстер',
    whiteToMove: 'Ход белых', blackToMove: 'Ход чёрных', check: 'Шах!',
    checkmate: 'Мат!', stalemate: 'Пат', insufficient: 'Недостаточно материала', fifty: 'Правило 50 ходов',
    draw: 'Ничья', whiteWins: 'Белые победили! 🏆', blackWins: 'Чёрные победили! 🏆',
    youWin: 'Вы победили! 🎉', youLose: 'Вы проиграли',
    aiThinking: 'Компьютер думает…', choosePromotion: 'Превратить пешку в',
    menu: 'Меню', opponentLeft: 'Соперник отключился — вы победили',
    rematchSent: 'Предложение реванша отправлено', rematchOffer: 'Соперник хочет реванш — нажмите «Новая игра»',
    viewing: 'Просмотр позиции', opponentResigned: 'Соперник сдался',
    drawSuffix: 'Ничья'
  }
};

AZ.t = function (key) {
  const d = AZ.I18N[AZ.Game.lang] || AZ.I18N.az;
  return d[key] || AZ.I18N.az[key] || key;
};

/* ==================== SƏS EFFEKTLƏRİ (Web Audio) ==================== */
AZ.AudioFX = {
  ctx: null,
  ready() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ignore */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return !!this.ctx;
  },
  tone(freq, dur, type, vol, when, slide) {
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || .12, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, when) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const g = this.ctx.createGain(); g.gain.value = vol || .18;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination);
    s.start(this.ctx.currentTime + (when || 0));
  },
  play(kind) {
    if (!AZ.Game.sound || !this.ready()) return;
    switch (kind) {
      case 'move':    this.tone(520, .08, 'triangle', .14, 0, 340); break;
      case 'capture': this.noise(.12, .2); this.tone(240, .12, 'square', .07, 0, 120); break;
      case 'castle':  this.tone(440, .07, 'triangle', .12); this.tone(560, .08, 'triangle', .12, .07); break;
      case 'check':   this.tone(880, .12, 'sine', .13, 0, 1150); break;
      case 'premove': this.tone(700, .05, 'sine', .06); break;
      case 'select':  this.tone(600, .03, 'sine', .05); break;
      case 'start':   this.tone(523, .1, 'triangle', .11); this.tone(659, .12, 'triangle', .11, .1); break;
      case 'end':     this.tone(392, .18, 'triangle', .13); this.tone(311, .18, 'triangle', .13, .16); this.tone(262, .32, 'triangle', .13, .32); break;
    }
  }
};

/* ==================== OYUN / UI ==================== */
AZ.Game = (function () {
  const E = () => AZ.Engine;
  const $ = id => document.getElementById(id);

  const GLYPH = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  const G = {
    mode: null,
    myColor: 'w',
    orientation: 'w',
    level: 2,
    lang: 'az',
    sound: true,
    over: false,
    result: '',
    thinking: false,
    plies: [],
    viewPly: 0,
    selected: -1,
    targets: [],
    lastFrom: -1, lastTo: -1,
    premoves: [],
    preFrom: -1,
    arrows: [],
    marks: {},
    pending: null,
    rematchSent: false,
    rematchReceived: false,
    token: 0
  };

  let els = {};
  let dragState = null;
  let arrowDrag = null;
  let ghostEl = null;

  AZ.openModal = id => { const el = $(id); if (el) el.classList.add('open'); };
  AZ.closeModal = id => { const el = $(id); if (el) el.classList.remove('open'); };
  function closeAllModals() { document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); }

  function onModalClosed(id) {
    if (id === 'promoModal' && G.pending) { G.pending = null; deselect(); }
    if (id === 'onlineModal' && G.mode !== 'online' && AZ.Net) AZ.Net.leave();
  }

  function bindModals() {
    document.querySelectorAll('.modal').forEach(m => {
      m.querySelectorAll('[data-close]').forEach(x =>
        x.addEventListener('click', () => { m.classList.remove('open'); onModalClosed(m.id); }));
    });
  }

  function replayPosition() {
    const e = E();
    e.reset();
    for (let i = 0; i < G.viewPly; i++) e.make(G.plies[i].move);
  }

  function renderBoard() {
    if (!els.board) return;
    replayPosition();
    const e = E(), b = e.board();
    const checkSq = (G.viewPly === G.plies.length || G.viewPly > 0) && e.inCheck(e.turn())
      ? findKing(e.turn()) : -1;

    els.board.innerHTML = '';
    for (let d = 0; d < 64; d++) {
      const s = G.orientation === 'w' ? d : 63 - d;
      const cell = document.createElement('div');
      cell.className = 'sq ' + ((e.fileOf(s) + e.rankOf(s)) % 2 === 0 ? 'light' : 'dark');
      cell.dataset.sq = s;

      if (s === G.selected) cell.classList.add('selected');
      const lp = G.plies[G.viewPly - 1];
      if (lp && (s === lp.move.from || s === lp.move.to)) cell.classList.add('last-move');
      if (s === checkSq) cell.classList.add('in-check');
      const tg = G.targets.find(t => t.to === s);
      if (tg) cell.classList.add(tg.captured ? 'capture-target' : 'target');
      if (G.premoves.some(p => p.to === s)) cell.classList.add('premove');
      if (G.preFrom === s) cell.classList.add('pre-from');

      const mark = G.marks[s];
      if (mark) {
        const i = document.createElement('i');
        i.className = 'mark mark-' + mark;
        cell.appendChild(i);
      }

      const p = b[s];
      if (p) {
        const c = e.colorOf(p);
        const sp = document.createElement('span');
        sp.className = 'pc ' + (c === 'w' ? 'pc-w' : 'pc-b');
        sp.textContent = GLYPH[c][p.toLowerCase()];
        cell.appendChild(sp);
      }

      if (d % 8 === 0) {
        const cr = document.createElement('span');
        cr.className = 'coord coord-r';
        cr.textContent = e.rankOf(s) + 1;
        cell.appendChild(cr);
      }
      if (d >= 56) {
        const cf = document.createElement('span');
        cf.className = 'coord coord-f';
        cf.textContent = 'abcdefgh'[e.fileOf(s)];
        cell.appendChild(cf);
      }
      els.board.appendChild(cell);
    }
    renderArrows();
  }

  function findKing(c) {
    const b = E().board();
    const k = c === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (b[i] === k) return i;
    return -1;
  }

  function sqCenter(s) {
    const e = E();
    let f = e.fileOf(s), r = e.rankOf(s);
    if (G.orientation === 'b') { f = 7 - f; r = 7 - r; }
    return [(f + .5) * 100, (r + .5) * 100];
  }

  function arrowNode(x1, y1, x2, y2, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = x1 + ux * 26, sy = y1 + uy * 26;
    const ex = x2 - ux * 34, ey = y2 - uy * 34;
    const g = document.createElementNS(NS, 'g');
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', sx); line.setAttribute('y1', sy);
    line.setAttribute('x2', ex); line.setAttribute('y2', ey);
    line.setAttribute('stroke', color); line.setAttribute('stroke-width', '16');
    line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', '.8');
    const px = -uy, py = ux;
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points',
      `${ex + ux * 24},${ey + uy * 24} ${ex + px * 10},${ey + py * 10} ${ex - px * 10},${ey - py * 10}`);
    poly.setAttribute('fill', color); poly.setAttribute('opacity', '.8');
    g.appendChild(line); g.appendChild(poly);
    return g;
  }

  function renderArrows() {
    if (!els.arrowSvg) return;
    els.arrowSvg.innerHTML = '';
    G.arrows.forEach(a => {
      const [x1, y1] = sqCenter(a.from), [x2, y2] = sqCenter(a.to);
      els.arrowSvg.appendChild(arrowNode(x1, y1, x2, y2, '#58c858'));
    });
    if (arrowDrag) {
      const [x1, y1] = sqCenter(arrowDrag.from);
      els.arrowSvg.appendChild(arrowNode(x1, y1, arrowDrag.x, arrowDrag.y, '#58c858'));
    }
  }

  function renderMoves() {
    if (!els.moveList) return;
    const list = els.moveList;
    list.innerHTML = '';
    let row = null;
    G.plies.forEach((p, i) => {
      if (p.color === 'w') {
        row = document.createElement('div');
        row.className = 'move-row';
        const n = document.createElement('span');
        n.className = 'move-num';
        n.textContent = (i / 2 + 1) + '.';
        row.appendChild(n);
        list.appendChild(row);
      }
      const b = document.createElement('button');
      b.className = 'move-san'
        + (i + 1 === G.viewPly ? ' current' : '')
        + (i + 1 === G.plies.length ? ' latest' : '');
      b.textContent = p.san;
      b.addEventListener('click', () => jumpTo(i + 1));
      (row || list).appendChild(b);
    });
    list.scrollTop = list.scrollHeight;
    if (els.navFirst) els.navFirst.disabled = els.navPrev.disabled = G.viewPly === 0;
    if (els.navNext) els.navNext.disabled = els.navLast.disabled = G.viewPly >= G.plies.length;
  }

  const glyphs = list => list
    .slice()
    .sort((a, b2) => VAL[b2.toLowerCase()] - VAL[a.toLowerCase()])
    .map(p => {
      const c = p === p.toUpperCase() ? 'w' : 'b';
      return `<span class="pc-sm ${c === 'w' ? 'pc-w' : 'pc-b'}">${GLYPH[c][p.toLowerCase()]}</span>`;
    }).join('');

  function renderCaptured() {
    if (!els.capTop || !els.capBottom) return;
    const capByWhite = [], capByBlack = [];
    G.plies.forEach(p => {
      if (!p.captured) return;
      (p.color === 'w' ? capByWhite : capByBlack).push(p.captured);
    });
    const sum = l => l.reduce((s, p) => s + VAL[p.toLowerCase()], 0);
    const diff = sum(capByWhite) - sum(capByBlack);
    els.capTop.innerHTML = glyphs(capByBlack) + (diff < 0 ? `<span class="mat-diff">+${-diff}</span>` : '');
    els.capBottom.innerHTML = glyphs(capByWhite) + (diff > 0 ? `<span class="mat-diff">+${diff}</span>` : '');
  }

  function renderEval() {
    if (!els.evalFill || !els.evalScore) return;
    const cp = G.viewPly === 0 ? 0 : (G.plies[G.viewPly - 1].cp || 0);
    const pct = 50 + 50 * (2 / (1 + Math.exp(-cp / 380)) - 1);
    els.evalFill.style.height = Math.max(3, Math.min(97, pct)) + '%';
    const v = cp / 100;
    els.evalScore.textContent = (cp > 0 ? '+' : '') + v.toFixed(1);
    els.evalScore.classList.toggle('neg', cp < 0);
  }

  function renderStatus() {
    if (!els.status) return;
    if (G.over) { els.status.textContent = G.result; return; }
    if (G.rematchReceived && !G.rematchSent) { els.status.textContent = AZ.t('rematchOffer'); return; }
    if (G.rematchSent) { els.status.textContent = AZ.t('rematchSent'); return; }
    if (G.thinking) { els.status.textContent = AZ.t('aiThinking'); return; }
    const e = E();
    if (G.viewPly < G.plies.length) { els.status.textContent = AZ.t('viewing'); return; }
    const chk = e.inCheck(e.turn());
    els.status.textContent =
      (e.turn() === 'w' ? AZ.t('whiteToMove' ) : AZ.t('blackToMove')) + (chk ? ' • ' + AZ.t('check') : '');
  }

  function renderAll() {
    renderBoard();
    renderMoves();
    renderCaptured();
    renderEval();
    renderStatus();
  }

  function select(s) {
    if (G.selected === s) { deselect(); return; }
    G.selected = s;
    G.targets = E().legalFrom(s);
    AZ.AudioFX.play('select');
    renderBoard();
  }
  function deselect() {
    G.selected = -1;
    G.targets = [];
    renderBoard();
  }

  function doMove(m, opts) {
    opts = opts || {};
    const e = E();
    const san = e.moveSAN(m);
    e.make(m);
    const cp = AZ.AI && AZ.AI.rawEval ? AZ.AI.rawEval() : 0;
    const oppInCheck = e.inCheck(e.turn());
    G.plies.push({ move: m, san, color: e.colorOf(m.piece), captured: m.captured || null, cp, check: oppInCheck });
    G.viewPly = G.plies.length;
    G.lastFrom = m.from; G.lastTo = m.to;
    G.selected = -1; G.targets = []; G.preFrom = -1;
    G.arrows = [];
    if (!opts.silent) {
      AZ.AudioFX.play(m.captured ? 'capture' : (m.castle ? 'castle' : 'move'));
      if (oppInCheck) setTimeout(() => AZ.AudioFX.play('check'), 90);
    }
    const st = e.status();
    renderAll();
    if (st !== 'playing') { endGame(st); return; }
    postMove(m, opts);
  }

  function postMove(m, opts) {
    const e = E();
    if (G.mode === 'pvp') {
      G.orientation = G.orientation === 'w' ? 'b' : 'w';
      renderBoard();
      return;
    }
    if (G.mode === 'ai' && e.turn() !== G.myColor) { aiTurn(); return; }
    if (G.mode === 'online' && !opts.remote && AZ.Net) {
      AZ.Net.send({ t: 'move', from: m.from, to: m.to, promotion: m.promotion || null });
      return;
    }
    if (G.premoves.length && e.turn() === G.myColor) executePremoves();
  }

  function aiTurn() {
    G.thinking = true;
    renderStatus();
    const tok = G.token;
    setTimeout(() => {
      if (tok !== G.token || G.over) { G.thinking = false; return; }
      if (G.viewPly < G.plies.length) jumpTo(G.plies.length);
      const mv = AZ.AI.bestMove(G.level);
      G.thinking = false;
      if (mv && !G.over) doMove(mv);
      else renderAll();
    }, 90);
  }

  function handlePremove(s) {
    const e = E(), b = e.board();
    const p = b[s];
    const last = G.premoves[G.premoves.length - 1];
    if (last && last.to === s) {
      G.premoves.pop();
      AZ.AudioFX.play('select');
      renderBoard();
      return;
    }
    if (!last) {
      if (p && e.colorOf(p) === G.myColor) { G.preFrom = s; renderBoard(); }
    } else {
      G.premoves.push({ from: G.preFrom, to: s });
      G.preFrom = -1;
      AZ.AudioFX.play('premove');
      renderBoard();
    }
  }

  function executePremoves() {
    const e = E();
    while (G.premoves.length) {
      const pre = G.premoves[0];
      const legal = e.legalFrom(pre.from).filter(x => x.to === pre.to);
      G.premoves.shift();
      if (!legal.length) continue;
      const m = legal[0].promotion ? legal.find(x => x.promotion === 'q') : legal[0];
      doMove(m);
      return;
    }
    renderBoard();
  }

  function tryHumanMove(mv) {
    if (mv.promotion) {
      G.pending = { mv };
      showPromo(E().turn());
      return;
    }
    doMove(mv);
  }

  function showPromo(color) {
    const row = $('promoRow');
    if (!row) return;
    row.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach(p => {
      const b = document.createElement('button');
      b.className = 'promo-btn';
      const sp = document.createElement('span');
      sp.className = 'pc ' + (color === 'w' ? 'pc-w' : 'pc-b');
      sp.textContent = GLYPH[color][p];
      b.appendChild(sp);
      b.addEventListener('click', () => {
        AZ.closeModal('promoModal');
        const pend = G.pending; G.pending = null;
        const target = E().legalFrom(pend.mv.from).find(x => x.to === pend.mv.to && x.promotion === p);
        if (target) doMove(target);
      });
      row.appendChild(b);
    });
    AZ.openModal('promoModal');
  }

  function endGame(st) {
    G.over = true;
    const e = E();
    let res;
    if (st === 'checkmate') {
      const winner = e.turn() === 'w' ? 'b' : 'w';
      if (G.mode === 'ai') res = AZ.t(winner === G.myColor ? 'youWin' : 'youLose');
      else res = AZ.t(winner === 'w' ? 'whiteWins' : 'blackWins');
      res = AZ.t('checkmate') + ' ' + res;
    } else if (st === 'disconnect') {
      res = AZ.t('opponentLeft');
    } else if (st === 'resign') {
      res = AZ.t('youLose');
    } else {
      res = AZ.t('drawSuffix') + ' — ' + AZ.t(st);
    }
    G.result = res;
    AZ.AudioFX.play('end');
    const ot = $('overTitle');
    if (ot) ot.textContent = res;
    AZ.openModal('overModal');
    renderStatus();
  }

  function jumpTo(ply) {
    G.viewPly = Math.max(0, Math.min(ply, G.plies.length));
    if (G.viewPly === G.plies.length) { G.selected = -1; G.targets = []; }
    renderAll();
  }

  function squareAtPoint(x, y) {
    if (!els.board) return -1;
    const r = els.board.getBoundingClientRect();
    if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return -1;
    const f = Math.floor((x - r.left) / r.width * 8);
    const rk = Math.floor((y - r.top) / r.height * 8);
    const d = rk * 8 + f;
    return G.orientation === 'w' ? d : 63 - d;
  }

  function pointerToSvg(x, y) {
    if (!els.board) return [0, 0];
    const r = els.board.getBoundingClientRect();
    return [
      Math.max(0, Math.min(800, (x - r.left) / r.width * 800)),
      Math.max(0, Math.min(800, (y - r.top) / r.height * 800))
    ];
  }

  function onLeftDown(s) {
    if (G.over) return;
    if (G.viewPly < G.plies.length) { jumpTo(G.plies.length); return; }
    const e = E(), b = e.board(), p = b[s];
    const mySide = G.mode === 'pvp' ? e.turn() : G.myColor;
    if (e.turn() !== mySide) { handlePremove(s); return; }
    if (G.selected >= 0) {
      if (s === G.selected) { deselect(); return; }
      const mv = G.targets.find(t => t.to === s);
      if (mv) { tryHumanMove(mv); return; }
    }
    if (p && e.colorOf(p) === e.turn()) select(s);
    else deselect();
  }

  function onRightDown(s) {
    if (G.premoves.length || G.preFrom >= 0) {
      G.premoves = []; G.preFrom = -1;
      renderBoard();
      return;
    }
    const [x, y] = sqCenter(s);
    arrowDrag = { from: s, x, y };
    renderArrows();
  }

  function onRightMove(x, y) {
    if (!arrowDrag) return;
    const pt = pointerToSvg(x, y);
    arrowDrag.x = pt[0]; arrowDrag.y = pt[1];
    renderArrows();
  }

  function onRightUp(x, y) {
    if (!arrowDrag) return;
    const from = arrowDrag.from;
    arrowDrag = null;
    const s = squareAtPoint(x, y);
    if (s < 0) { renderArrows(); return; }
    if (s === from) {
      const cur = G.marks[from];
      if (!cur) G.marks[from] = 'green';
      else if (cur === 'green') G.marks[from] = 'red';
      else delete G.marks[from];
    } else {
      const existed = G.arrows.some(a => a.from === from && a.to === s);
      G.arrows = G.arrows.filter(a => !(a.from === from && a.to === s));
      if (!existed) G.arrows.push({ from, to: s });
    }
    renderBoard();
  }

  function makeGhost(piece, color, x, y) {
    removeGhost();
    ghostEl = document.createElement('div');
    ghostEl.className = 'ghost-piece pc ' + (color === 'w' ? 'pc-w' : 'pc-b');
    ghostEl.textContent = GLYPH[color][piece.toLowerCase()];
    document.body.appendChild(ghostEl);
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    if (ghostEl) { ghostEl.style.left = x + 'px'; ghostEl.style.top = y + 'px'; }
  }
  function removeGhost() {
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
  }

  function bindBoard() {
    if (!els.board) return;
    els.board.addEventListener('contextmenu', e => e.preventDefault());
    els.board.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    els.board.addEventListener('pointerdown', e => {
      AZ.AudioFX.ready();
      const s = squareAtPoint(e.clientX, e.clientY);
      if (s < 0) return;
      if (e.button === 2) { onRightDown(s); return; }
      if (e.button !== 0) return;
      e.preventDefault();
      dragState = { sq: s, x: e.clientX, y: e.clientY, active: false, btn: 0 };
      onLeftDown(s);
    });

    window.addEventListener('pointermove', e => {
      if (arrowDrag) { onRightMove(e.clientX, e.clientY); return; }
      if (!dragState || dragState.btn !== 0) return;
      const dist = Math.hypot(e.clientX - dragState.x, e.clientY - dragState.y);
      if (!dragState.active && dist > 10 && G.selected === dragState.sq) {
        const p = E().board()[dragState.sq];
        if (p && E().colorOf(p) === E().turn()) {
          dragState.active = true;
          makeGhost(p, E().colorOf(p), e.clientX, e.clientY);
        }
      }
      if (dragState.active) moveGhost(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', e => {
      if (e.button === 2) { onRightUp(e.clientX, e.clientY); return; }
      if (!dragState) return;
      const ds = dragState;
      dragState = null;
      if (ds.active) {
        removeGhost();
        const t = squareAtPoint(e.clientX, e.clientY);
        if (t >= 0 && t !== ds.sq) {
          const mv = G.targets.find(x => x.to === t);
          if (mv) tryHumanMove(mv);
        }
      }
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') jumpTo(G.viewPly - 1);
      else if (e.key === 'ArrowRight') jumpTo(G.viewPly + 1);
      else if (e.key === 'Home') jumpTo(0);
      else if (e.key === 'End') jumpTo(G.plies.length);
    });
  }

  function startGame(mode) {
    G.token++;
    E().reset();
    G.mode = mode;
    G.over = false; G.result = '';
    G.plies = []; G.viewPly = 0;
    G.selected = -1; G.targets = [];
    G.lastFrom = -1; G.lastTo = -1;
    G.premoves = []; G.preFrom = -1;
    G.arrows = []; G.marks = {};
    G.pending = null;
    G.thinking = false;
    G.rematchSent = false; G.rematchReceived = false;
    
    // Həmişə ağlar aşağıda (w) başlasın
    G.myColor = 'w'; 
    G.orientation = 'w';

    closeAllModals();
    if (els.btnResign) els.btnResign.style.display = mode === 'pvp' ? 'none' : '';
    renderAll();
    AZ.AudioFX.play('start');
  }

  function startOnline(color) {
    startGame('online');
    G.myColor = color;
    G.orientation = color;
    renderAll();
  }

  function applyOpponentMove(from, to, promotion) {
    if (G.over || G.mode !== 'online') return;
    if (G.viewPly < G.plies.length) jumpTo(G.plies.length);
    const legal = E().legalFrom(from).filter(m => m.to === to && (!promotion || m.promotion === promotion));
    if (legal.length) doMove(legal[0], { remote: true });
  }

  function opponentResigned() {
    if (!G.over) {
      G.result = AZ.t('opponentResigned') + ' — ' + AZ.t('youWin');
      G.over = true;
      AZ.AudioFX.play('end');
      const ot = $('overTitle');
      if (ot) ot.textContent = G.result;
      AZ.openModal('overModal');
      renderStatus();
    }
  }

  function opponentLeft() {
    if (!G.over) endGame('disconnect');
  }

  function rematchReceived() {
    if (G.rematchSent) { startOnline(G.myColor); }
    else { G.rematchReceived = true; renderStatus(); }
  }

  function bindUI() {
    const bindClick = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

    bindClick('btnOnline', () => AZ.openModal('onlineModal'));
    bindClick('menuOnline', () => { closeAllModals(); AZ.openModal('onlineModal'); });
    bindClick('btnPvp', () => startGame('pvp'));
    bindClick('menuPvp', () => startGame('pvp'));
    bindClick('btnAi', () => startGame('ai'));
    bindClick('menuAi', () => startGame('ai'));

    bindClick('btnFlip', () => {
      G.orientation = G.orientation === 'w' ? 'b' : 'w';
      renderBoard();
    });

    bindClick('btnNew', () => {
      if (G.mode === 'online' && AZ.Net) {
        AZ.Net.send({ t: 'rematch' });
        if (G.rematchReceived) startOnline(G.myColor);
        else { G.rematchSent = true; renderStatus(); }
      } else startGame(G.mode || 'ai');
    });

    bindClick('btnOverNew', () => { const btn = $('btnNew'); if (btn) btn.click(); });
    bindClick('btnOverMenu', () => { closeAllModals(); AZ.openModal('menuModal'); });

    bindClick('btnResign', () => {
      if (G.over || G.mode === 'pvp') return;
      if (G.mode === 'online' && AZ.Net) AZ.Net.send({ t: 'resign' });
      G.over = true;
      G.result = AZ.t('youLose');
      AZ.AudioFX.play('end');
      const ot = $('overTitle');
      if (ot) ot.textContent = G.result;
      AZ.openModal('overModal');
      renderStatus();
    });

    bindClick('navFirst', () => jumpTo(0));
    bindClick('navPrev', () => jumpTo(G.viewPly - 1));
    bindClick('navNext', () => jumpTo(G.viewPly + 1));
    bindClick('navLast', () => jumpTo(G.plies.length));

    bindClick('btnSettings', () => AZ.openModal('settingsModal'));
    bindClick('soundToggle', () => {
      G.sound = !G.sound;
      const sc = $('soundCheck'); if (sc) sc.checked = G.sound;
      const st = $('soundToggle'); if (st) st.textContent = G.sound ? '🔊' : '🔇';
      localStorage.setItem('azchess_sound', G.sound ? '1' : '0');
      if (G.sound) AZ.AudioFX.play('select');
    });

    const soundCheck = $('soundCheck');
    if (soundCheck) {
      soundCheck.addEventListener('change', e => {
        G.sound = e.target.checked;
        const st = $('soundToggle'); if (st) st.textContent = G.sound ? '🔊' : '🔇';
        localStorage.setItem('azchess_sound', G.sound ? '1' : '0');
      });
    }

    const themeSelect = $('themeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', e => {
        document.body.dataset.theme = e.target.value;
        localStorage.setItem('azchess_theme', e.target.value);
      });
    }

    const diffSelect = $('difficultySelect');
    if (diffSelect) {
      diffSelect.addEventListener('change', e => {
        G.level = +e.target.value;
        localStorage.setItem('azchess_level', G.level);
      });
    }

    const setLang = l => applyLang(l);
    const langSelect = $('langSelect');
    if (langSelect) langSelect.addEventListener('change', e => setLang(e.target.value));
    const langSelect2 = $('langSelect2');
    if (langSelect2) langSelect2.addEventListener('change', e => setLang(e.target.value));

    window.addEventListener('beforeunload', () => { if (AZ.Net) AZ.Net.leave(); });
  }

  function applyLang(l) {
    G.lang = AZ.I18N[l] ? l : 'az';
    localStorage.setItem('azchess_lang', G.lang);
    document.documentElement.lang = G.lang;
    const ls1 = $('langSelect'); if (ls1) ls1.value = G.lang;
    const ls2 = $('langSelect2'); if (ls2) ls2.value = G.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (AZ.I18N[G.lang][k]) el.textContent = AZ.I18N[G.lang][k];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const k = el.dataset.i18nPh;
      if (AZ.I18N[G.lang][k]) el.placeholder = AZ.I18N[G.lang][k];
    });
    renderStatus();
  }

  function init() {
    els = {
      board: $('board'), arrowSvg:$('arrowSvg'),
      moveList: $('moveList'), status:$('status'),
      capTop: $('capTop'), capBottom:$('capBottom'),
      evalFill: $('evalFill'), evalScore:$('evalScore'),
      navFirst: $('navFirst'), navPrev:$('navPrev'),
      navNext: $('navNext'), navLast:$('navLast'),
      btnResign: $('btnResign')
    };

    const savedTheme = localStorage.getItem('azchess_theme');
    if (savedTheme) {
      document.body.dataset.theme = savedTheme;
      const ts = $('themeSelect'); if (ts) ts.value = savedTheme;
    }

    const savedLevel = localStorage.getItem('azchess_level');
    if (savedLevel) {
      G.level = +savedLevel;
      const ds = $('difficultySelect'); if (ds) ds.value = String(G.level);
    }

    const savedSound = localStorage.getItem('azchess_sound');
    if (savedSound !== null) {
      G.sound = savedSound === '1';
      const sc = $('soundCheck'); if (sc) sc.checked = G.sound;
      const st = $('soundToggle'); if (st) st.textContent = G.sound ? '🔊' : '🔇';
    }

    bindModals();
    bindBoard();
    bindUI();
    applyLang(localStorage.getItem('azchess_lang') || 'az');

    startGame('ai');
    AZ.openModal('menuModal');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    get lang() { return G.lang; },
    get sound() { return G.sound; },
    get over() { return G.over; },
    G,
    startGame, startOnline, applyOpponentMove,
    opponentResigned, opponentLeft, rematchReceived,
    applyLang, jumpTo
  };
})();
