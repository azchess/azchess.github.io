// AzChess Main Game Logic & I18n & SVG Pieces
const PIECES_SVG = {
  wP: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M22.5 9c-2.2 0-4 1.8-4 4 0 .9.3 1.7.8 2.3-2.7 1.3-4.6 4-4.6 7.2 0 2.1.8 4 2.1 5.4-2.9.9-5 3.6-5 6.8v2.8h21.4v-2.8c0-3.2-2.1-5.9-5-6.8 1.3-1.4 2.1-3.3 2.1-5.4 0-3.2-1.9-5.9-4.6-7.2.5-.6.8-1.4.8-2.3 0-2.2-1.8-4-4-4z"/></svg>',
  wR: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M9 39h27v-3H9v3zm3-3v-4h3v4h3v-4h3v4h3v-4h3v4h3v-4h3v4h3v-7H12v7z"/></svg>',
  wN: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M22.5 9C18 9 14 12 13 16.5c-2.8.5-5 3-5 6 0 2 1 3.8 2.5 5-1 1.2-1.5 2.6-1.5 4 0 3.3 2.7 6 6 6h14c3.3 0 6-2.7 6-6 0-2.3-1.3-4.3-3.2-5.3 1.9-1.6 3.2-4 3.2-6.7 0-4.1-3.4-7.5-7.5-7.5-1.5 0-2.8.4-4 1.2C22.4 9.1 22.5 9 22.5 9z"/></svg>',
  wB: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M22.5 6c-.8 0-1.5.7-1.5 1.5S21.7 9 22.5 9 24 8.3 24 7.5 23.3 6 22.5 6zM14 36h17v-3H14v3z"/></svg>',
  wQ: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M13 30l-2.5-13 5.5 4 3.5-8.5L22.5 18l2.5-5.5L28.5 21l5.5-4L31.5 30z"/></svg>',
  wK: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M22.5 5v6M19.5 8h6M15 30l-1.5-8 4.5 3.5L22.5 16l4.5 9.5L31.5 22 30 30z"/></svg>',
  bP: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M22.5 9c-2.2 0-4 1.8-4 4 0 .9.3 1.7.8 2.3-2.7 1.3-4.6 4-4.6 7.2 0 2.1.8 4 2.1 5.4-2.9.9-5 3.6-5 6.8v2.8h21.4v-2.8c0-3.2-2.1-5.9-5-6.8 1.3-1.4 2.1-3.3 2.1-5.4 0-3.2-1.9-5.9-4.6-7.2.5-.6.8-1.4.8-2.3 0-2.2-1.8-4-4-4z"/></svg>',
  bR: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M9 39h27v-3H9v3zm3-3v-4h3v4h3v-4h3v4h3v-4h3v4h3v-4h3v4h3v-7H12v7z"/></svg>',
  bN: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M22.5 9C18 9 14 12 13 16.5c-2.8.5-5 3-5 6 0 2 1 3.8 2.5 5-1 1.2-1.5 2.6-1.5 4 0 3.3 2.7 6 6 6h14c3.3 0 6-2.7 6-6 0-2.3-1.3-4.3-3.2-5.3 1.9-1.6 3.2-4 3.2-6.7 0-4.1-3.4-7.5-7.5-7.5-1.5 0-2.8.4-4 1.2C22.4 9.1 22.5 9 22.5 9z"/></svg>',
  bB: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M22.5 6c-.8 0-1.5.7-1.5 1.5S21.7 9 22.5 9 24 8.3 24 7.5 23.3 6 22.5 6zM14 36h17v-3H14v3z"/></svg>',
  bQ: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M13 30l-2.5-13 5.5 4 3.5-8.5L22.5 18l2.5-5.5L28.5 21l5.5-4L31.5 30z"/></svg>',
  bK: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="%23000" stroke="%23fff" stroke-width="1.5" d="M22.5 5v6M19.5 8h6M15 30l-1.5-8 4.5 3.5L22.5 16l4.5 9.5L31.5 22 30 30z"/></svg>'
};

const I18N = {
  az: {
    hero_title: "Müasir Onlayn Şahmat",
    hero_desc: "Dostlarınla onlayn, üz-üzə və ya süni intellektə qarşı pulsuz şahmat oyna.",
    play_online: "Onlayn Oyna",
    play_online_sub: "P2P Otaq / Linklə dəvət",
    play_ai: "Kompüterə Qarşı",
    play_ai_sub: "Stockfish Mühərriki",
    play_local: "Pass & Play",
    play_local_sub: "Eyni cihazda 2 nəfər",
    settings: "Tənzimləmələr",
    online_menu: "Onlayn Oyun",
    create_room: "Otaq Yarat",
    join_room: "Qoşul",
    time_control: "Vaxt Nəzarəti:",
    waiting_opponent: "Rəqib gözlənilir...",
    copy_link: "📋 Linki Kopyala",
    language: "Dil / Language:",
    board_theme: "Lövhə Mövzusu:",
    sound_effects: "Səs Effektləri:"
  },
  ru: {
    hero_title: "Современные Онлайн Шахматы",
    hero_desc: "Играйте с друзьями онлайн, друг против друга или с ИИ бесплатно.",
    play_online: "Играть Онлайн",
    play_online_sub: "P2P Комната / По ссылке",
    play_ai: "Против Компьютера",
    play_ai_sub: "Движок Stockfish",
    play_local: "Pass & Play",
    play_local_sub: "Вдвоем на одном устройстве",
    settings: "Настройки",
    online_menu: "Онлайн Игра",
    create_room: "Создать Комнату",
    join_room: "Присоединиться",
    time_control: "Контроль Времени:",
    waiting_opponent: "Ожидание соперника...",
    copy_link: "📋 Скопировать Ссылку",
    language: "Язык / Language:",
    board_theme: "Тема Доски:",
    sound_effects: "Звуковые Эффекты:"
  },
  en: {
    hero_title: "Modern Online Chess",
    hero_desc: "Play chess online with friends, local or vs AI for free.",
    play_online: "Play Online",
    play_online_sub: "P2P Room / Invite link",
    play_ai: "Play Computer",
    play_ai_sub: "Stockfish Engine",
    play_local: "Pass & Play",
    play_local_sub: "2 Players 1 Device",
    settings: "Settings",
    online_menu: "Online Game",
    create_room: "Create Room",
    join_room: "Join",
    time_control: "Time Control:",
    waiting_opponent: "Waiting for opponent...",
    copy_link: "📋 Copy Link",
    language: "Language / Dil:",
    board_theme: "Board Theme:",
    sound_effects: "Sound Effects:"
  }
};

let currentLang = localStorage.getItem('azchess_lang') || 'az';
let board = null;
let game = new Chess();
let premove = null;

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('azchess_lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });
  document.getElementById('select-lang-head').value = lang;
  document.getElementById('select-lang-modal').value = lang;
}

// Custom Piece Theme Function (Fixes CDN issues)
function pieceTheme(piece) {
  return PIECES_SVG[piece] || '';
}

// Init Board
function initBoard() {
  const config = {
    draggable: true,
    position: 'start',
    pieceTheme: pieceTheme,
    onDragStart: onDragStart,
    onDrop: onDrop
  };
  board = Chessboard('board', config);
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;
  // Allow premove dragging logic if not my turn
}

function onDrop(source, target) {
  let move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if (move === null) {
    // Save as Premove if it's not our turn
    premove = { from: source, to: target };
    return 'snapback';
  }
}

// Modal handling
document.getElementById('btn-close-online').addEventListener('click', () => {
  document.getElementById('modal-online').classList.remove('active');
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.remove('active');
});

document.getElementById('btn-settings-head').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.add('active');
});

document.getElementById('btn-mode-online').addEventListener('click', () => {
  document.getElementById('modal-online').classList.add('active');
});

document.getElementById('btn-brand').addEventListener('click', () => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-home').classList.add('active');
});

document.getElementById('btn-mode-local').addEventListener('click', () => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-game').classList.add('active');
  if (!board) initBoard();
  board.start();
  game.reset();
});

// Lang Change Listeners
document.getElementById('select-lang-head').addEventListener('change', (e) => setLanguage(e.target.value));
document.getElementById('select-lang-modal').addEventListener('change', (e) => setLanguage(e.target.value));

// Set Default Lang on load
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});
