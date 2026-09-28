import { Net } from './network.js';
import { t } from './i18n.js';

const SQ = /^[a-h][1-8]$/;
const RESULTS = new Set(['resigned', 'timeout', 'agreed', 'checkmate', 'stalemate', 'insufficient', 'repetition', 'fifty']);
const other = c => (c === 'w' ? 'b' : 'w');
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');

/**
 * Onlayn sessiya: protokol, doğrulama və UI. Şahmat məntiqi x (main.js) vasitəsilə işləyir.
 * Şəbəkədən gələn heç nə etibar olunmur: hər gediş chess.js ilə yoxlanır.
 */
export function createOnline(x) {
  const { $ } = x;
  const dlg = $('dlg-online');
  const o = { active: false, color: 'w', canMove: () => o.active && !!net?.open && x.game.turn() === o.color };
  let net = null, role = null, guestKey = null, myKey = null, lastCode = null;
  const SKEY = 'azchess:session';
  const saveSes = () => { try { sessionStorage.setItem(SKEY, JSON.stringify({ code: lastCode, key: myKey })); } catch { /* yaddaş yoxdur */ } };
  const clearSes = () => { try { sessionStorage.removeItem(SKEY); } catch { /* yaddaş yoxdur */ } };
  let tc = { min: 5, inc: 0 }, mineR = false, theirR = false, offerPly = -1, first = true;

  const view = id => { for (const v of ['on-menu', 'on-live']) $(v).hidden = v !== id; };
  const showCode = code => { $('on-code').textContent = code || ''; $('on-room').hidden = !code; };
  const setDot = s => {
    for (const c of 'wb') x.bars[c].dot.removeAttribute('data-s');
    if (s && o.active) x.bars[other(o.color)].dot.dataset.s = s;
  };
  const status = (key, dot) => { $('on-status').textContent = t(key); setDot(dot); };
  const mode = on => { o.active = on; x.mode(on); };

  function startRematch() {
    mineR = theirR = false;
    o.color = other(o.color);
    x.setFlip(o.color === 'b');
    x.newGame(tc);
    setDot('ok');
  }

  // Yalnız görünüş effektləri: oyunun nəticəsinə, gedişlərə və saata təsir etmir.
  const FX = new Set(['flip', 'disco', 'boo']);
  let fxBusy = false;
  function runFx(name) {
    if (typeof name !== 'string' || !FX.has(name)) return;
    if (name === 'boo') { x.toast('👻 BOO!'); return; }
    if (fxBusy) return;
    fxBusy = true;
    const root = document.documentElement;
    const finish = (ms, fn) => setTimeout(() => { fn(); fxBusy = false; }, ms);
    if (name === 'flip') {
      const base = o.color === 'b';
      x.setFlip(!base);
      finish(5000, () => x.setFlip(base));
    } else if (name === 'disco') {
      const themes = ['green', 'brown', 'blue', 'dark', 'neon', 'classic'];
      let i = 0;
      const iv = setInterval(() => { root.dataset.theme = themes[i++ % themes.length]; }, 400);
      finish(5000, () => { clearInterval(iv); root.dataset.theme = x.S.get().theme; });
    }
  }

  function onMsg(d) {
    const over = x.isOver();
    switch (d.t) {
      case 'hello': {
        const ok = (d.color === 'w' || d.color === 'b') && typeof d.key === 'string'
          && Number.isInteger(d.min) && d.min >= 1 && d.min <= 180
          && Number.isInteger(d.inc) && d.inc >= 0 && d.inc <= 60
          && Array.isArray(d.moves) && d.moves.length <= 1000
          && d.moves.every(s => typeof s === 'string' && s.length < 12)
          && d.ms && [d.ms.w, d.ms.b].every(v => Number.isFinite(v) && v >= 0)
          && (d.res == null || (RESULTS.has(d.res.reason) && [null, 'w', 'b'].includes(d.res.winner)));
        if (!ok) return;
        myKey = d.key;
        saveSes();
        tc = { min: d.min, inc: d.inc };
        o.color = d.color;
        mode(true);
        if (!x.loadState(d.moves, d.ms, d.inc * 1000)) { x.toast(t('netError')); return; }
        if (d.res && !x.isOver()) x.end(d.res.reason, d.res.winner, true);
        x.setFlip(o.color === 'b');
        view('on-live');
        status('connected', 'ok');
        dlg.close();
        return;
      }
      case 'move': {
        if (over || x.game.turn() === o.color) return; // yanlış sıra
        if (!SQ.test(d.from) || !SQ.test(d.to) || (d.promo !== undefined && !/^[qrbn]$/.test(d.promo))) return;
        if (d.ply !== x.game.history().length + 1) return; // köhnə/gələcək vəziyyət
        const m = x.play(d.from, d.to, d.promo);
        if (!m) return; // qeyri-qanuni gediş
        const cap = tc.min * 60000 + d.ply * tc.inc * 1000;
        if (Number.isFinite(d.ms)) x.clock.ms[m.color] = Math.min(cap, Math.max(0, d.ms));
        $('dlg-draw').close();
        return;
      }
      case 'draw':
        if (!over && !$('dlg-draw').open) $('dlg-draw').showModal();
        return;
      case 'drawAccept':
        if (!over && offerPly === x.game.history().length) x.end('agreed', null, true);
        return;
      case 'drawDecline':
        if (!over) x.toast(t('drawDeclined'));
        return;
      case 'end':
        if (!over && (d.reason === 'resigned' || d.reason === 'timeout')) x.end(d.reason, o.color, true);
        return;
      case 'rematch':
        if (!over) return;
        theirR = true;
        if (mineR) startRematch(); else x.toast(t('rematchAsk'));
        return;
      case 'fx':
        runFx(d.name);
        return;
      case 'chat':
        if (typeof d.text !== 'string' || !d.text.trim() || d.text.length > 300) return;
        addChat(d.text.trim(), false);
        return;
      default:
    }
  }

  const handlers = {
    onJoin: key => {
      if (!guestKey) { guestKey = rid(); first = true; return true; }
      if (key !== guestKey) return false;
      first = false;
      return true;
    },
    onReady: () => {
      mode(true);
      if (first) { x.newGame(tc); x.setFlip(o.color === 'b'); }
      net.send('hello', { key: guestKey, color: other(o.color), min: tc.min, inc: tc.inc,
        moves: x.game.history(), ms: x.clock.read(), res: x.result() });
      view('on-live');
      status('connected', 'ok');
      dlg.close();
    },
    onClose: () => {
      status('oppLeft', 'off');
      x.toast(t('oppLeft'));
      $('on-rejoin').hidden = role !== 'guest';
    },
    onError: type => { if (type === 'peer-unavailable') clearSes(); x.toast(t(type === 'peer-unavailable' ? 'notFound' : 'netError')); },
    onMsg
  };

  function teardown() {
    net?.leave();
    net = null; role = null; guestKey = null; myKey = null;
    mineR = theirR = false; offerPly = -1;
    mode(false);
    setDot(null);
    showCode('');
  }

  const mk = r => { role = r; net = new Net(r, handlers); return net; };

  function join(code) {
    if (!/^\d{6}$/.test(code)) { x.toast(t('badCode')); return; }
    const key = code === lastCode ? myKey : null; // eyni kodla qayıdış: sessiya açarı ilə
    teardown();
    myKey = key;
    lastCode = code;
    saveSes();
    mk('guest').join(code, key);
    status('connecting', null);
    showCode(code);
    $('on-rejoin').hidden = false;
    view('on-live');
  }

  $('on-create').addEventListener('click', async () => {
    teardown();
    clearSes();
    const n = mk('host');
    n.gid = rid();
    o.color = Math.random() < 0.5 ? 'w' : 'b';
    tc = { min: x.S.get().min, inc: x.S.get().inc };
    status('waiting', null);
    try {
      const code = await n.host();
      if (net !== n) return;
      showCode(code);
      $('on-rejoin').hidden = true;
      view('on-live');
    } catch {
      if (net === n) { x.toast(t('netError')); teardown(); }
    }
  });
  $('on-join').addEventListener('click', () => join($('on-input').value));
  $('on-rejoin').addEventListener('click', () => join(lastCode));
  $('on-input').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
  $('on-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); join(e.target.value); } });
  $('on-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText($('on-code').textContent).then(() => x.toast(t('copied')), () => {});
  });
  function addChat(text, mine) {
    const el = $('chat-list');
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (mine ? 'mine' : 'theirs');
    row.textContent = text;
    el.append(row);
    el.scrollTop = el.scrollHeight;
  }
  function sendChat() {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) { x.toast(t('messageEmpty')); return; }
    if (!net?.open) return;
    net.send('chat', { text: text.slice(0, 300) });
    addChat(text.slice(0, 300), true);
    input.value = '';
    input.focus();
  }
  $('chat-send').addEventListener('click', sendChat);
  $('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
  $('on-leave').addEventListener('click', () => {
    teardown();
    lastCode = null;
    clearSes();
    x.setFlip(false);
    x.newGame();
    $('on-status').textContent = '';
    view('on-menu');
  });
  $('d-yes').addEventListener('click', () => {
    if (x.isOver() || !net?.open) return;
    net.send('drawAccept');
    x.end('agreed', null, true);
  });
  $('d-no').addEventListener('click', () => net?.send('drawDecline'));

  o.sendMove = m => net?.send('move', { from: m.from, to: m.to, promo: m.promotion,
    ply: x.game.history().length, ms: Math.round(x.clock.ms[m.color]) });
  o.sendEnd = reason => net?.send('end', { reason });
  o.fx = name => { if (net?.open && FX.has(name)) net.send('fx', { name }); };
  o.offerDraw = () => {
    const ply = x.game.history().length;
    if (!net?.open || x.isOver() || offerPly === ply) return;
    offerPly = ply;
    net.send('draw');
    x.toast(t('drawSent'));
  };
  o.rematch = () => {
    if (!net?.open) return;
    mineR = true;
    net.send('rematch');
    if (theirR) startRematch(); else x.toast(t('waitRematch'));
  };
  try {
    const s = JSON.parse(sessionStorage.getItem(SKEY) || 'null');
    if (s && /^\d{6}$/.test(s.code)) { lastCode = s.code; myKey = typeof s.key === 'string' ? s.key : null; join(s.code); }
  } catch { /* yaddaş yoxdur */ }
  return o;
}
