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

/* ============================ i18n ============================ */

const I18N = (() => {
  const DICT = {
    az: {
      page_title: 'AzChess — Onlayn və Oflayn Şahmat',
      tagline: 'Dostlarınla onlayn, üz-üzə, ya da kompüterə qarşı şahmat oyna.<br/>Hesab yoxdur. Server yoxdur. Sadəcə şahmat.',
      btn_play_online: 'Onlayn Oyna', btn_play_local: 'Növbəli Oyun', btn_play_ai: 'Kompüterə Qarşı',
      btn_settings: 'Ayarlar', footer_text: 'Pulsuz və açıq mənbə • P2P (WebRTC) • Mühərrik: Stockfish',
      title_back: 'Menyuya qayıt', title_settings: 'Ayarlar', title_close: 'Bağla',
      title_go_start: 'Əvvələ get', title_prev_move: 'Əvvəlki gediş', title_next_move: 'Növbəti gediş', title_jump_live: 'Canlıya keç',
      title_resign: 'Təslim ol', title_draw: 'Remis təklif et / qəbul et', title_rematch: 'Revanş istə', title_flip: 'Lövhəni çevir',
      action_resign: ' Təslim', action_draw: ' Remis', action_accept_draw: ' Remisi qəbul et', action_rematch: ' Revanş', action_flip: ' Çevir',
      modal_online_title: '🌐 Onlayn Oyna', time_control: 'Vaxt nəzarəti',
      create_room_heading: 'Otaq yarat', create_room_hint: '6 rəqəmli kodu və ya linki dostunla paylaş.',
      btn_create_room: 'Otaq Yarat', btn_creating: 'Yaradılır…', btn_copy_link: 'Dəvət Linkini Kopyala',
      room_waiting: 'Rəqib qoşulmasını gözləyirik…', room_connected_waiting: 'Qoşuldu — ev sahibini gözləyirik…',
      join_room_heading: 'Otağa qoşul', join_code_placeholder: '6 rəqəmli kod', join_room_hint: 'Kodu və ya tam dəvət linkini yapışdır.',
      btn_join_room: 'Otağa Qoşul', btn_joining: 'Qoşulur…',
      modal_local_title: '👥 Növbəli Oyun', local_hint: 'İki oyunçu, bir cihaz. Lövhə hər hərəkətdən sonra çevrilir (Ayarlarda söndürülə bilər).',
      btn_start_game: 'Oyuna Başla',
      modal_ai_title: '🤖 Kompüterə Qarşı', ai_hint: 'Sən Ağlarla oynayırsan. Stockfish 10 ilə işləyir (oflayn olduqda daxili mühərrikə keçir).',
      diff_easy: 'Asan', diff_medium: 'Orta', diff_hard: 'Çətin',
      promote_to: 'Kimə çevir', piece_queen: 'Vəzir', piece_rook: 'Qala', piece_bishop: 'Fil', piece_knight: 'At',
      btn_cancel: 'Ləğv et',
      modal_settings_title: '⚙ Ayarlar', appearance_label: 'Görünüş', opt_dark: '🌙 Tünd', opt_light: '☀️ Açıq',
      board_colors_label: 'Lövhə rəngləri', custom_colors_label: 'Xüsusi rənglər',
      light_squares: 'Açıq xanalar', dark_squares: 'Tünd xanalar',
      piece_set_label: 'Daş dəsti', opt_classic: 'Klassik (Wikipedia)', opt_alpha: 'Alfa',
      sound_label: 'Səs effektləri', autoflip_label: 'Lövhəni avtomatik çevir (Növbəli Oyun)',
      btn_home: 'Ana səhifə',
      confirm_title: 'Təsdiq', confirm_accept: 'Qəbul et', confirm_decline: 'İmtina et',
      leave_game_title: 'Oyundan çıxılsın?', leave_game_text: 'Cari onlayn oyunda təslim olacaqsan.', leave_game_ok: 'Çıx',
      resign_title: 'Təslim ol?', resign_text: 'Təslim olduğuna əminsən?', resign_ok: 'Təslim ol',
      draw_offer_title: 'Remis təklifi', draw_offer_text: 'Rəqibin remis təklif edir.',
      rematch_title: 'Revanş', rematch_text: 'Rəqibin revanş istəyir — rənglər dəyişəcək.',
      header_default: 'Şahmat', header_online: 'Onlayn • Otaq ', header_vs_computer: 'Kompüterə qarşı • ', header_pass_play: 'Növbəli Oyun',
      name_you: 'Sən', name_opponent: 'Rəqib', name_computer: 'Kompüter', name_white: 'Ağlar', name_black: 'Qaralar',
      status_computer_thinking: '🤖 Kompüter düşünür…',
      toast_not_connected: 'Qoşulma yoxdur', toast_draw_offer_sent: 'Remis təklifi göndərildi',
      toast_opponent_joined: 'Rəqib qoşuldu! Sən Ağlarla oynayırsan.', toast_game_started_black: 'Oyun başladı! Sən Qaralarla oynayırsan.',
      toast_invite_copied: 'Dəvət linki kopyalandı', toast_connected_waiting: 'Qoşuldu! Oyunun başlamasını gözləyirik…',
      toast_connection_lost: 'Bağlantı kəsildi — yenidən qoşulmağa çalışırıq…', toast_opponent_reconnected: 'Rəqib yenidən qoşuldu',
      toast_draw_declined: 'Remis təklifi rədd edildi', toast_rematch_declined: 'Revanş rədd edildi',
      toast_rematch_started: 'Revanş başladı! Sən oynayırsan: ', toast_rematch_sent: 'Revanş istəyi göndərildi — rəqibi gözləyirik…',
      toast_ai_declines_draw: 'Kompüter remis təklifini rədd etdi', toast_state_synced: 'Oyun vəziyyəti sinxronlaşdırıldı',
      net_reconnecting: 'Bağlantı kəsildi — yenidən qoşulur…', net_reconnected_syncing: 'Yenidən qoşuldu — sinxronlaşdırılır…',
      net_room: 'Otaq ', net_synced: ' • sinxron',
      result_draw: 'Bərabərə', result_white_wins: 'Ağlar qazandı', result_black_wins: 'Qaralar qazandı',
      reason_checkmate: 'Mat', reason_stalemate: 'Pat', reason_insufficient: 'Kifayət qədər material yoxdur',
      reason_threefold: 'Üçqat təkrar', reason_fifty: '50-gediş qaydası', reason_resignation: 'Təslim olma',
      reason_draw_agreement: 'Qarşılıqlı razılıqla remis', reason_timeout: 'Vaxt bitdi', reason_timeout_insuff: 'Vaxt bitdi — mat üçün material yoxdur',
      reason_game_over: 'Oyun bitdi',
      net_err_peer_unavailable: 'Otaq tapılmadı. 6 rəqəmli kodu yoxlayın.',
      net_err_unavailable_id: 'Otaq yaradıla bilmədi (ID məşğuldur). Yenidən cəhd edin.',
      net_err_network: 'Şəbəkə xətası. İnternet bağlantınızı yoxlayın.',
      net_err_server: 'Siqnal server xətası. Bir az sonra yenidən cəhd edin.',
      net_err_browser: 'Brauzeriniz WebRTC dəstəkləmir.',
      net_err_default: 'Bağlantı xətası',
      net_err_invalid_code: 'Yanlış kod — 6 rəqəmli otaq kodunu daxil edin (və ya dəvət linkini yapışdırın).',
      net_err_timeout: 'Bağlantı vaxtı bitdi — otaq artıq mövcud olmaya bilər.',
      net_err_no_webrtc: 'Bu brauzerdə WebRTC mövcud deyil.'
    },
    en: {
      page_title: 'AzChess — Play Chess Online & Offline',
      tagline: 'Play chess with friends online, face-to-face, or against a computer.<br/>No account. No server. Just chess.',
      btn_play_online: 'Play Online', btn_play_local: 'Pass &amp; Play', btn_play_ai: 'Play vs Computer',
      btn_settings: 'Settings', footer_text: 'Free &amp; open • P2P via WebRTC • Engine: Stockfish',
      title_back: 'Back to menu', title_settings: 'Settings', title_close: 'Close',
      title_go_start: 'Go to start', title_prev_move: 'Previous move', title_next_move: 'Next move', title_jump_live: 'Jump to live',
      title_resign: 'Resign', title_draw: 'Offer / accept draw', title_rematch: 'Request rematch', title_flip: 'Flip board',
      action_resign: ' Resign', action_draw: ' Draw', action_accept_draw: ' Accept draw', action_rematch: ' Rematch', action_flip: ' Flip',
      modal_online_title: '🌐 Play Online', time_control: 'Time control',
      create_room_heading: 'Create a room', create_room_hint: 'Share a 6-digit code or link with a friend.',
      btn_create_room: 'Create Room', btn_creating: 'Creating…', btn_copy_link: 'Copy Invite Link',
      room_waiting: 'Waiting for opponent to join…', room_connected_waiting: 'Connected — waiting for host…',
      join_room_heading: 'Join a room', join_code_placeholder: '6-digit code', join_room_hint: 'Paste a code or a full invite link.',
      btn_join_room: 'Join Room', btn_joining: 'Joining…',
      modal_local_title: '👥 Pass &amp; Play', local_hint: 'Two players, one device. The board flips after every move (optional in Settings).',
      btn_start_game: 'Start Game',
      modal_ai_title: '🤖 Play vs Computer', ai_hint: 'You play White. Powered by Stockfish 10 (falls back to a built-in engine offline).',
      diff_easy: 'Easy', diff_medium: 'Medium', diff_hard: 'Hard',
      promote_to: 'Promote to', piece_queen: 'Queen', piece_rook: 'Rook', piece_bishop: 'Bishop', piece_knight: 'Knight',
      btn_cancel: 'Cancel',
      modal_settings_title: '⚙ Settings', appearance_label: 'Appearance', opt_dark: '🌙 Dark', opt_light: '☀️ Light',
      board_colors_label: 'Board colors', custom_colors_label: 'Custom colors',
      light_squares: 'Light squares', dark_squares: 'Dark squares',
      piece_set_label: 'Piece set', opt_classic: 'Classic (Wikipedia)', opt_alpha: 'Alpha',
      sound_label: 'Sound effects', autoflip_label: 'Auto-rotate board (Pass &amp; Play)',
      btn_home: 'Home',
      confirm_title: 'Confirm', confirm_accept: 'Accept', confirm_decline: 'Decline',
      leave_game_title: 'Leave game?', leave_game_text: 'You will resign the current online game.', leave_game_ok: 'Leave',
      resign_title: 'Resign?', resign_text: 'Are you sure you want to resign this game?', resign_ok: 'Resign',
      draw_offer_title: 'Draw offer', draw_offer_text: 'Your opponent offers a draw.',
      rematch_title: 'Rematch', rematch_text: 'Your opponent wants a rematch — colors will swap.',
      header_default: 'Chess', header_online: 'Online • Room ', header_vs_computer: 'vs Computer • ', header_pass_play: 'Pass & Play',
      name_you: 'You', name_opponent: 'Opponent', name_computer: 'Computer', name_white: 'White', name_black: 'Black',
      status_computer_thinking: '🤖 Computer is thinking…',
      toast_not_connected: 'Not connected', toast_draw_offer_sent: 'Draw offer sent',
      toast_opponent_joined: 'Opponent joined! You play White.', toast_game_started_black: 'Game started! You play Black.',
      toast_invite_copied: 'Invite link copied to clipboard', toast_connected_waiting: 'Connected! Waiting for the game to start…',
      toast_connection_lost: 'Connection lost — trying to reconnect…', toast_opponent_reconnected: 'Opponent reconnected',
      toast_draw_declined: 'Draw offer declined', toast_rematch_declined: 'Rematch declined',
      toast_rematch_started: 'Rematch started! You play ', toast_rematch_sent: 'Rematch request sent — waiting for opponent…',
      toast_ai_declines_draw: 'Computer declines the draw offer', toast_state_synced: 'Game state synced',
      net_reconnecting: 'Connection lost — reconnecting…', net_reconnected_syncing: 'Reconnected — syncing…',
      net_room: 'Room ', net_synced: ' • synced',
      result_draw: 'Draw', result_white_wins: 'White wins', result_black_wins: 'Black wins',
      reason_checkmate: 'Checkmate', reason_stalemate: 'Stalemate', reason_insufficient: 'Insufficient material',
      reason_threefold: 'Threefold repetition', reason_fifty: 'Fifty-move rule', reason_resignation: 'Resignation',
      reason_draw_agreement: 'Draw by agreement', reason_timeout: 'Time out', reason_timeout_insuff: 'Time out — insufficient mating material',
      reason_game_over: 'Game over',
      net_err_peer_unavailable: 'Room not found. Double-check the 6-digit code.',
      net_err_unavailable_id: 'Could not create the room (ID busy). Please try again.',
      net_err_network: 'Network error. Check your internet connection.',
      net_err_server: 'Signalling server error. Please try again in a moment.',
      net_err_browser: 'Your browser does not support WebRTC.',
      net_err_default: 'Connection error',
      net_err_invalid_code: 'Invalid code — enter the 6-digit room code (or paste the invite link).',
      net_err_timeout: 'Connection timed out — the room may no longer exist.',
      net_err_no_webrtc: 'WebRTC is not available in this browser.'
    }
  };

  let lang = 'az';
  try { lang = localStorage.getItem('chessweb-lang') || (navigator.language || '').slice(0, 2); } catch (e) {}
  if (lang !== 'az' && lang !== 'en') lang = 'az';

  function t(key) { return (DICT[lang] && DICT[lang][key]) || DICT.az[key] || key; }

  function setLang(l) {
    if (l !== 'az' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem('chessweb-lang', l); } catch (e) {}
    apply();
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('page_title');
    $$('[data-i18n]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    $$('.lang-btn').forEach(b => b.classList.toggle('selected', b.dataset.lang === lang));
    if (typeof Network !== 'undefined' && Network.setMessages) {
      Network.setMessages({
        peerUnavailable: t('net_err_peer_unavailable'),
        unavailableId: t('net_err_unavailable_id'),
        network: t('net_err_network'),
        serverError: t('net_err_server'),
        browserIncompatible: t('net_err_browser'),
        defaultError: t('net_err_default'),
        invalidCode: t('net_err_invalid_code'),
        timeout: t('net_err_timeout'),
        noWebrtc: t('net_err_no_webrtc')
      });
    }
    // dynamic bits that don't have static markup hooks
    if (typeof buildTimeSelects === 'function') buildTimeSelects();
    if (typeof updateHeader === 'function' && G && G.mode) updateHeader();
    if (typeof updateBars === 'function' && G && G.game) updateBars();
    if (typeof updateDrawButton === 'function' && G && G.game) updateDrawButton();
  }

  return { t, setLang, get: () => lang, apply };
})();

const t = I18N.t;

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

// NOTE: the cdnjs/unpkg "chessboard-js" package only ships the minified js/css —
// it does NOT include the img/chesspieces/ folder, so pieceTheme URLs pointing
// at that CDN always 404 (this was the "pieces don't show" bug). jsDelivr's
// GitHub-file CDN can serve straight from the source repo instead, which does
// contain those images, so we use that as a reliable primary source with a
// same-repo fallback host in case jsDelivr has an outage.
const PIECE_SETS = {
  wikipedia: 'https://cdn.jsdelivr.net/gh/oakmac/chessboardjs@master/website/img/chesspieces/wikipedia/',
  alpha: 'https://cdn.jsdelivr.net/gh/oakmac/chessboardjs@master/website/img/chesspieces/alpha/'
};
const PIECE_SETS_FALLBACK = {
  wikipedia: 'https://raw.githack.com/oakmac/chessboardjs/master/website/img/chesspieces/wikipedia/',
  alpha: 'https://raw.githack.com/oakmac/chessboardjs/master/website/img/chesspieces/alpha/'
};

const TIME_WORDS = {
  az: { bullet: 'Gülləvi', blitz: 'Sürətli', rapid: 'Sürətli', classical: 'Klassik', noclock: '∞ Saatsız' },
  en: { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', noclock: '∞ No clock' }
};
function tw(key) { return (TIME_WORDS[I18N.get()] || TIME_WORDS.az)[key]; }
const TIME_PRESETS = [
  { base: 60,   inc: 0,  labelKey: () => '1 ' + minLabel() + ' • ' + tw('bullet') },
  { base: 180,  inc: 0,  labelKey: () => '3 ' + minLabel() + ' • ' + tw('blitz') },
  { base: 180,  inc: 2,  labelKey: () => '3+2 • ' + tw('blitz') },
  { base: 300,  inc: 0,  labelKey: () => '5 ' + minLabel() + ' • ' + tw('blitz') },
  { base: 600,  inc: 0,  labelKey: () => '10 ' + minLabel() + ' • ' + tw('rapid') },
  { base: 900,  inc: 10, labelKey: () => '15+10 • ' + tw('rapid') },
  { base: 1800, inc: 0,  labelKey: () => '30 ' + minLabel() + ' • ' + tw('classical') },
  { base: 0,    inc: 0,  labelKey: () => tw('noclock') }
];
function minLabel() { return I18N.get() === 'az' ? 'dəq' : 'min'; }

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

// If the primary jsDelivr piece image 404s/errors for any reason, silently
// swap it for the same file on the raw.githack.com mirror instead of leaving
// a broken image behind on the board.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'IMG' || !el.src) return;
  Object.keys(PIECE_SETS).forEach((key) => {
    const primary = PIECE_SETS[key];
    if (el.src.indexOf(primary) === 0 && !el.dataset.fallbackTried) {
      el.dataset.fallbackTried = '1';
      el.src = PIECE_SETS_FALLBACK[key] + el.src.slice(primary.length);
    }
  });
}, true);

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
  if (g.in_checkmate())      { finalize(g.turn() === 'w' ? '0-1' : '1-0', t('reason_checkmate')); return true; }
  if (g.in_stalemate())      { finalize('1/2-1/2', t('reason_stalemate')); return true; }
  if (g.insufficient_material()) { finalize('1/2-1/2', t('reason_insufficient')); return true; }
  if (g.in_threefold_repetition()) { finalize('1/2-1/2', t('reason_threefold')); return true; }
  if (g.in_draw())           { finalize('1/2-1/2', t('reason_fifty')); return true; }
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
  let result = '1/2-1/2', reason = t('reason_timeout_insuff');
  if (hasMatingMaterial(G.game, winner)) {
    result = winner === 'w' ? '1-0' : '0-1';
    reason = t('reason_timeout');
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
  if (G.mode === 'online') return color === G.myColor ? t('name_you') : t('name_opponent');
  if (G.mode === 'ai') return color === 'w' ? t('name_you') : t('name_computer');
  return color === 'w' ? t('name_white') : t('name_black');
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
  let title = t('header_default');
  const diffLabel = { easy: t('diff_easy'), medium: t('diff_medium'), hard: t('diff_hard') }[selectedAiLevel] || selectedAiLevel;
  if (G.mode === 'online') title = t('header_online') + (Network.code() || '—');
  else if (G.mode === 'ai') title = t('header_vs_computer') + diffLabel;
  else if (G.mode === 'local') title = t('header_pass_play');
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
    label.innerHTML = '½<span>' + t('action_accept_draw') + '</span>';
  } else {
    label.innerHTML = '½<span>' + t('action_draw') + '</span>';
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
  setStatus(t('status_computer_thinking'));
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
  if (aiBetter) { toast(t('toast_ai_declines_draw')); G.drawOfferedBy = null; updateDrawButton(); }
  else finalize('1/2-1/2', t('reason_draw_agreement'));
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
  $('#btn-confirm-ok').textContent = okLabel || t('confirm_accept');
  $('#btn-confirm-cancel').textContent = t('confirm_decline');
  confirmCallback = cb;
  openModal('modal-confirm');
}

function showGameOver(result, reason) {
  $('#go-icon').textContent = result === '1/2-1/2' ? '⚖️' : '🏆';
  $('#go-title').textContent = result === '1/2-1/2' ? t('result_draw') : (result === '1-0' ? t('result_white_wins') : t('result_black_wins'));
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
    btn.textContent = t('btn_creating');
    Network.createRoom().then((code) => {
      btn.disabled = false;
      btn.textContent = t('btn_create_room');
      $('#room-info').classList.remove('hidden');
      $('#room-code').textContent = code;
      $('#room-waiting').textContent = t('room_waiting');
      updateHeader();
    }).catch((msg) => {
      btn.disabled = false;
      btn.textContent = t('btn_create_room');
      err.textContent = msg || t('net_err_default');
    });
  });

  $('#btn-copy-link').addEventListener('click', () => {
    const code = Network.code();
    if (!code) return;
    const link = inviteLink(code);
    const done = () => toast(t('toast_invite_copied'));
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
    btn.textContent = t('btn_joining');
    Network.joinRoom(raw).then(() => {
      btn.disabled = false;
      btn.textContent = t('btn_join_room');
      $('#room-waiting') && ($('#room-waiting').textContent = t('room_connected_waiting'));
      toast(t('toast_connected_waiting'));
      closeModal('modal-online');
    }).catch((msg) => {
      btn.disabled = false;
      btn.textContent = t('btn_join_room');
      err.textContent = msg;
    });
  });

  // closing the online modal (backdrop click or the X button) cancels the
  // room if we were hosting one, then actually closes the modal.
  $('#modal-online').addEventListener('click', (e) => {
    if (e.target === $('#modal-online')) cancelRoomIfHosting();
  });
  $$('#modal-online .modal-close').forEach(b => b.addEventListener('click', cancelRoomIfHosting));
}

function cancelRoomIfHosting() {
  if (Network.isHost() && !G.mode) Network.cleanup();
  if (G.mode !== 'online') { $('#room-info').classList.add('hidden'); $('#online-error').textContent = ''; }
  closeModal('modal-online'); // BUGFIX: this call was missing, so the ✕ button did nothing
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
    toast(t('toast_opponent_joined'));
  });

  Network.on('start', (d) => {                // joiner side: game begins
    SoundFX.play('notify');
    setupGame('online', { myColor: 'b', base: d.base, inc: d.inc });
    toast(t('toast_game_started_black'));
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
    setNetStatus(t('net_reconnecting'), 'bad');
    toast(t('toast_connection_lost'), true);
  });

  Network.on('reconnected', () => {
    hideToast();
    if (Network.isHost() && G.mode === 'online') {
      sendState();
      setNetStatus(t('toast_opponent_reconnected'), 'good');
      toast(t('toast_opponent_reconnected'));
    } else {
      setNetStatus(t('net_reconnected_syncing'), 'good');
    }
  });

  Network.on('relistening', () => {
    if (G.mode === 'online') setNetStatus(t('net_reconnecting'), 'bad');
  });

  Network.on('latency', (ms) => {
    if (G.mode === 'online' && Network.isOpen()) setNetStatus(t('net_room') + Network.code() + ' • ' + ms + 'ms', 'good');
  });

  Network.on('fatal', (d) => {
    if (G.mode === 'online') { toast(d.msg || t('net_err_default'), true); setNetStatus(d.msg || t('net_err_default'), 'bad'); }
    else { $('#online-error').textContent = d.msg || t('net_err_default') + '.'; }
  });

  Network.on('resign', () => {
    const winner = G.myColor === 'w' ? '1-0' : '0-1';
    finalize(winner, t('reason_resignation'));
  });

  Network.on('drawOffer', (d) => {
    G.drawOfferedBy = d.by;
    updateDrawButton();
    SoundFX.play('notify');
    askConfirm(t('draw_offer_title'), t('draw_offer_text'), t('confirm_accept'), (ok) => {
      if (ok) { Network.send({ type: 'drawAnswer', accept: true }); G.drawOfferedBy = null; finalize('1/2-1/2', t('reason_draw_agreement')); }
      else { Network.send({ type: 'drawAnswer', accept: false }); G.drawOfferedBy = null; updateDrawButton(); }
    });
  });

  Network.on('drawAnswer', (d) => {
    if (d.accept) { G.drawOfferedBy = null; finalize('1/2-1/2', t('reason_draw_agreement')); }
    else { G.drawOfferedBy = null; updateDrawButton(); toast(t('toast_draw_declined')); }
  });

  Network.on('timeout', (d) => { if (!G.over) finalize(d.result, d.reason); });

  Network.on('rematch', () => {
    SoundFX.play('notify');
    askConfirm(t('rematch_title'), t('rematch_text'), t('confirm_accept'), (ok) => {
      if (ok) { Network.send({ type: 'rematchAccept' }); beginRematch(); }
      else Network.send({ type: 'rematchDecline' });
    });
  });

  Network.on('rematchAccept', () => beginRematch());
  Network.on('rematchDecline', () => toast(t('toast_rematch_declined')));
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
    if (!G.over) finalize(d.result, d.reason || t('reason_game_over'));
  } else {
    startClocks();
    setNetStatus(t('net_room') + Network.code() + t('net_synced'), 'good');
    toast(t('toast_state_synced'));
  }
}

function beginRematch() {
  closeModal('modal-gameover');
  G.myColor = G.myColor === 'w' ? 'b' : 'w';
  setupGame('online', { myColor: G.myColor, base: G.base, inc: G.clocks.inc });
  toast(t('toast_rematch_started') + (G.myColor === 'w' ? t('name_white') : t('name_black')) + '.');
}

/* ============================ action buttons ============================ */

function bindActions() {
  $('#btn-home').addEventListener('click', () => {
    if (G.mode === 'online' && !G.over) {
      askConfirm(t('leave_game_title'), t('leave_game_text'), t('leave_game_ok'), (ok) => {
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
    askConfirm(t('resign_title'), t('resign_text'), t('resign_ok'), (ok) => {
      if (!ok) return;
      if (G.mode === 'online' && Network.isOpen()) Network.send({ type: 'resign' });
      const loser = G.mode === 'online' ? G.myColor : G.game.turn();
      finalize(loser === 'w' ? '0-1' : '1-0', t('reason_resignation'));
    });
  });

  $('#btn-draw').addEventListener('click', () => {
    if (G.over) return;
    if (G.mode === 'ai') { handleAiDrawOffer(); return; }
    if (G.mode === 'local') { finalize('1/2-1/2', t('reason_draw_agreement')); return; }
    if (!Network.isOpen()) { toast(t('toast_not_connected')); return; }
    if (G.drawOfferedBy && G.drawOfferedBy !== mySideColor()) {
      Network.send({ type: 'drawAnswer', accept: true });
      G.drawOfferedBy = null;
      finalize('1/2-1/2', t('reason_draw_agreement'));
    } else if (!G.drawOfferedBy) {
      G.drawOfferedBy = mySideColor();
      Network.send({ type: 'drawOffer', by: G.myColor });
      updateDrawButton();
      toast(t('toast_draw_offer_sent'));
    }
  });

  const requestRematch = () => {
    if (G.mode === 'online') {
      if (!Network.isOpen()) { toast(t('toast_not_connected')); return; }
      Network.send({ type: 'rematch' });
      G.rematchSent = true;
      toast(t('toast_rematch_sent'));
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
    const prevValue = sel.value; // preserve the user's choice across a language switch
    sel.innerHTML = TIME_PRESETS.map(p =>
      '<option value="' + p.base + '|' + p.inc + '">' + p.labelKey() + '</option>'
    ).join('');
    sel.value = prevValue || (300 + '|' + 0);
    if (sel.selectedIndex === -1) sel.value = '300|0';
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
