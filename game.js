/**
 * AzChess — Əsas Oyun Məntiqi və Premove Sistemi
 */

// I18N DİKTİONARY
const I18N = {
  az: {
    tagline: "Dostlarınla onlayn, üz-üzə və ya kompüterə qarşı şahmat oyna.",
    play_online: "🌐 Onlayn oyna",
    play_local: "👥 Pass & Play",
    play_ai: "🤖 Kompüterə qarşı",
    settings: "⚙ Tənzimləmələr",
    footer: "Pulsuz • P2P WebRTC ilə • Stokfish Dəstəyi",
    time_control: "Vaxt nəzarəti",
    create_room: "Otaq yarat",
    join_room: "Otağa qoşul",
    code_placeholder: "6 rəqəmli kod",
    copy_link: "📋 Dəvət linkini kopyala",
    waiting: "Rəqibin qoşulması gözlənilir…",
    close: "Bağla",
    piece_set: "Fiqur dəsti",
    board_colors: "Lövhə mövzusu",
    sound: "🔊 Səs effektləri",
    autoflip: "🔃 Lövhəni avtomatik çevir (Pass & Play)",
    language: "Dil / Language",
    resign: "🏳 Təslim ol",
    draw: "½ Heç-heçə",
    flip: "🔄 Çevir",
    not_connected: "Qoşulmayıb",
    promote: "Fiquru çevir",
    rematch: "🔁 Revanş"
  },
  en: {
    tagline: "Play chess online with friends, pass & play, or against computer.",
    play_online: "🌐 Play Online",
    play_local: "👥 Pass & Play",
    play_ai: "🤖 vs Computer",
    settings: "⚙ Settings",
    footer: "Free • P2P WebRTC • Stockfish Powered",
    time_control: "Time Control",
    create_room: "Create Room",
    join_room: "Join Room",
    code_placeholder: "6-digit code",
    copy_link: "📋 Copy Invite Link",
    waiting: "Waiting for opponent…",
    close: "Close",
    piece_set: "Piece Set",
    board_colors: "Board Theme",
    sound: "🔊 Sound Effects",
    autoflip: "🔃 Auto-flip board (Pass & Play)",
    language: "Language",
    resign: "🏳 Resign",
    draw: "½ Draw",
    flip: "🔄 Flip",
    not_connected: "Not Connected",
    promote: "Promote to",
    rematch: "🔁 Rematch"
  },
  ru: {
    tagline: "Играйте в шахматы онлайн с друзьями, локально или против ИИ.",
    play_online: "🌐 Играть онлайн",
    play_local: "👥 Играть локально",
    play_ai: "🤖 Против компьютера",
    settings: "⚙ Настройки",
    footer: "Бесплатно • P2P WebRTC • Движок Stockfish",
    time_control: "Контроль времени",
    create_room: "Создать комнату",
    join_room: "Присоединиться",
    code_placeholder: "6-значный код",
    copy_link: "📋 Скопировать ссылку",
    waiting: "Ожидание соперника…",
    close: "Закрыть",
    piece_set: "Набор фигур",
    board_colors: "Тема доски",
    sound: "🔊 Звуковые эффекты",
    autoflip: "🔃 Автопереворот доски",
    language: "Язык / Language",
    resign: "🏳 Сдаться",
    draw: "½ Ничья",
    flip: "🔄 Перевернуть",
    not_connected: "Не подключено",
    promote: "Превращение в",
    rematch: "🔁 Реванш"
  }
};

let CURRENT_LANG = localStorage.getItem('azchess_lang') || 'az';

function t(key) {
  return I18N[CURRENT_LANG]?.[key] || I18N['en']?.[key] || key;
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (I18N[CURRENT_LANG][k]) el.textContent = I18N[CURRENT_LANG][k];
  });
  document.documentElement.lang = CURRENT_LANG;
}

// OYUN VƏ PREMOVE VƏZİYYƏTİ
const G = {
  game: null,
  board: null,
  mode: null,
  myColor: 'w',
  premove: null,
  moves: [],
  viewIndex: 0
};

// FIX: MODAL X DÜYMƏSİ VƏ BAGLAMA HƏLLİ
function bindModals() {
  document.querySelectorAll('.modal-close, .modal-backdrop').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.classList.remove('open');
        if (modal.id === 'modal-online' && typeof Network !== 'undefined') {
          Network.cleanup();
        }
      }
    });
  });
}

// PREMOVE FUNKSİONALLIĞI
function setPremove(from, to) {
  G.premove = { from, to };
  renderPremoveGhost(from, to);
}

function clearPremove() {
  G.premove = null;
  document.querySelectorAll('.premove-ghost').forEach(e => e.remove());
  document.querySelectorAll('.highlight-premove').forEach(e => e.classList.remove('highlight-premove'));
}

function renderPremoveGhost(from, to) {
  clearPremove();
  const squareEl = document.querySelector(`#board .square-${to}`);
  if (!squareEl) return;
  
  squareEl.classList.add('highlight-premove');
  const ghost = document.createElement('div');
  ghost.className = 'premove-ghost';
  ghost.textContent = '♟'; // Fiqur kölgəsi
  squareEl.appendChild(ghost);
}

function executePremoveIfAny() {
  if (!G.premove) return;
  const { from, to } = G.premove;
  clearPremove();

  const move = G.game.move({ from, to, promotion: 'q' });
  if (move) {
    G.board.position(G.game.fen());
    if (G.mode === 'online') Network.sendMove(move);
  }
}

// CHESSBOARD.JS INTEGRATION WITH PIECE CUSTOMIZATION
function getPieceUrl(piece) {
  const set = localStorage.getItem('azchess_pieces') || 'cburnett';
  if (set === 'unicode') return ''; 
  return `https://lichess1.org/assets/lida/piece/${set}/${piece}.svg`;
}

function initBoard() {
  G.game = new Chess();
  G.board = Chessboard('board', {
    draggable: true,
    position: 'start',
    pieceTheme: getPieceUrl,
    onDragStart: (source, piece) => {
      // Premove icazəsi: Sizin növbəniz olmasa belə öz fiqurunuzu sürükləyə bilərsiniz
      const isMyPiece = piece.startsWith(G.myColor);
      if (!isMyPiece) return false;
      return true;
    },
    onDrop: (source, target) => {
      const isMyTurn = G.game.turn() === G.myColor;
      
      if (!isMyTurn && G.mode !== 'local') {
        setPremove(source, target);
        return 'snapback';
      }

      const move = G.game.move({ from: source, to: target, promotion: 'q' });
      if (move === null) return 'snapback';

      if (G.mode === 'online') Network.sendMove(move);
      executePremoveIfAny();
    }
  });
}

// BAŞLANĞIC İNİSİALİZASİYA
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  bindModals();
  initBoard();

  // Dil seçimi dəyişikliyi
  document.getElementById('select-lang').value = CURRENT_LANG;
  document.getElementById('select-lang').addEventListener('change', (e) => {
    CURRENT_LANG = e.target.value;
    localStorage.setItem('azchess_lang', CURRENT_LANG);
    applyLanguage();
  });

  // Rejim Düymələri
  document.getElementById('btn-mode-online').addEventListener('click', () => {
    document.getElementById('modal-online').classList.add('open');
  });

  // Ekran Sürüşməsinin Qarşısını Almaq üçün Touch-Blocker
  document.getElementById('board').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
});
