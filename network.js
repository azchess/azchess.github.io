/* ============================================================
   AzChess — network.js
   PeerJS ilə P2P: 6 rəqəmli otaq kodu + dəvət linki
   ============================================================ */
'use strict';
(function () {
  const PREFIX = 'azchess-v1-';
  const $ = id => document.getElementById(id);

  const Net = {
    peer: null,
    conn: null,
    isHost: false,
    room: null,
    busy: false
  };

  const status = t => { const el = $('onlineStatus'); if (el) el.textContent = t; };
  const showWait = on => {
    const home = $('onlineHome');
    const wait = $('onlineWait');
    if (home) home.hidden = on;
    if (wait) wait.hidden = !on;
  };

  function inviteURL(code) {
    return `${location.origin}${location.pathname}?room=${code}`;
  }

  function errText(type) {
    if (type === 'peer-unavailable') return AZ.t('roomNotFound');
    return AZ.t('netError');
  }

  function cleanup() {
    if (Net.conn) { try { Net.conn.close(); } catch (e) { /* ignore */ } }
    if (Net.peer) { try { Net.peer.destroy(); } catch (e) { /* ignore */ } }
    Net.conn = null;
    Net.peer = null;
    Net.busy = false;
  }

  function bindConn(c) {
    Net.conn = c;
    c.on('data', d => {
      if (!d || !d.t) return;
      if (d.t === 'move') AZ.Game.applyOpponentMove(d.from, d.to, d.promotion);
      else if (d.t === 'resign') AZ.Game.opponentResigned();
      else if (d.t === 'rematch') AZ.Game.rematchReceived();
    });
    c.on('close', () => {
      AZ.Game.opponentLeft();
      cleanup();
    });
    c.on('error', () => { /* ignore */ });
  }

  /* ---------- Otaq yarat (host) ---------- */
  Net.create = function () {
    if (Net.busy) return;
    cleanup();
    Net.busy = true;
    Net.isHost = true;
    Net.room = String(Math.floor(100000 + Math.random() * 900000));

    AZ.openModal('onlineModal');
    showWait(true);
    
    const rc = $('roomCode'); if (rc) rc.textContent = Net.room;
    const il = $('inviteLink'); if (il) il.value = inviteURL(Net.room);
    
    status(AZ.t('creating'));

    Net.peer = new Peer(PREFIX + Net.room);
    Net.peer.on('open', () => { status(AZ.t('waiting')); Net.busy = false; });
    Net.peer.on('connection', c => {
      if (Net.conn) { c.close(); return; }
      bindConn(c);
      c.on('open', () => {
        const waitEl = $('onlineWait');
        if (Net.room && waitEl) waitEl.hidden = true;
        AZ.Game.startOnline('w'); // host ağla oynayır
      });
    });
    Net.peer.on('error', e => {
      status(errText(e.type));
      Net.busy = false;
    });
  };

  /* ---------- Otağa qoşul (guest) ---------- */
  Net.join = function (code) {
    code = String(code || '').trim();
    if (!/^\d{6}$/.test(code)) { status(AZ.t('codePlaceholder')); return; }
    if (Net.busy) return;
    cleanup();
    Net.busy = true;
    Net.isHost = false;
    Net.room = code;

    AZ.openModal('onlineModal');
    showWait(true);
    
    const rc = $('roomCode'); if (rc) rc.textContent = code;
    const il = $('inviteLink'); if (il) il.value = inviteURL(code);
    
    status(AZ.t('connecting'));

    Net.peer = new Peer();
    Net.peer.on('open', () => {
      const c = Net.peer.connect(PREFIX + code, { reliable: true });
      bindConn(c);
      c.on('open', () => {
        const waitEl = $('onlineWait');
        if (waitEl) waitEl.hidden = true;
        AZ.Game.startOnline('b'); // qonaq qarayla oynayır
      });
    });
    Net.peer.on('error', e => {
      status(errText(e.type));
      Net.busy = false;
    });
  };

  Net.send = function (o) {
    if (Net.conn && Net.conn.open) Net.conn.send(o);
  };

  Net.leave = function () {
    cleanup();
    const waitEl = $('onlineWait');
    const homeEl = $('onlineHome');
    if (waitEl) waitEl.hidden = true;
    if (homeEl) homeEl.hidden = false;
  };

  /* ---------- Dəvət linki: ?room=XXXXXX ---------- */
  window.addEventListener('load', () => {
    const m = location.search.match(/[?&]room=(\d{6})/);
    const joinCodeInput = $('joinCode');
    if (m && joinCodeInput) {
      joinCodeInput.value = m[1];
      AZ.openModal('onlineModal');
      setTimeout(() => Net.join(m[1]), 600);
    }
  });

  /* ---------- UI bağlantıları ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const bindClick = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

    bindClick('btnCreateRoom', () => Net.create());
    bindClick('btnJoinRoom', () => {
      const jc = $('joinCode');
      if (jc) Net.join(jc.value);
    });

    const joinCodeInput = $('joinCode');
    if (joinCodeInput) {
      joinCodeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') Net.join(joinCodeInput.value);
      });
    }

    bindClick('btnCancelOnline', () => {
      Net.leave();
      AZ.closeModal('onlineModal');
    });

    bindClick('btnCopyLink', () => {
      const il = $('inviteLink');
      if (!il) return;
      const link = il.value;
      const done = () => {
        const b = $('btnCopyLink');
        if (!b) return;
        const old = b.textContent;
        b.textContent = AZ.t('copied');
        setTimeout(() => { b.textContent = old; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(done);
      } else {
        il.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        done();
      }
    });
  });

  AZ.Net = Net;
})();
