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
  const showWait = on => { $('onlineHome').hidden = on; $('onlineWait').hidden = !on; };

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
    $('roomCode').textContent = Net.room;
    $('inviteLink').value = inviteURL(Net.room);
    status(AZ.t('creating'));

    Net.peer = new Peer(PREFIX + Net.room);
    Net.peer.on('open', () => { status(AZ.t('waiting')); Net.busy = false; });
    Net.peer.on('connection', c => {
      if (Net.conn) { c.close(); return; } // artıq dolu
      bindConn(c);
      c.on('open', () => {
        Net.room && $('onlineWait') && ($('onlineWait').hidden = true);
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
    $('roomCode').textContent = code;
    $('inviteLink').value = inviteURL(code);
    status(AZ.t('connecting'));

    Net.peer = new Peer();
    Net.peer.on('open', () => {
      const c = Net.peer.connect(PREFIX + code, { reliable: true });
      bindConn(c);
      c.on('open', () => {
        $('onlineWait').hidden = true;
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
    if ($('onlineWait')) { $('onlineWait').hidden = true; }
    if ($('onlineHome')) { $('onlineHome').hidden = false; }
  };

  /* ---------- Dəvət linki: ?room=XXXXXX ---------- */
  window.addEventListener('load', () => {
    const m = location.search.match(/[?&]room=(\d{6})/);
    if (m && $('joinCode')) {
      $('joinCode').value = m[1];
      AZ.openModal('onlineModal');
      setTimeout(() => Net.join(m[1]), 600);
    }
  });

  /* ---------- UI bağlantıları ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    $('btnCreateRoom').addEventListener('click', () => Net.create());
    $('btnJoinRoom').addEventListener('click', () => Net.join($('joinCode').value));
    $('joinCode').addEventListener('keydown', e => {
      if (e.key === 'Enter') Net.join($('joinCode').value);
    });
    $('btnCancelOnline').addEventListener('click', () => {
      Net.leave();
      AZ.closeModal('onlineModal');
    });
    $('btnCopyLink').addEventListener('click', () => {
      const link = $('inviteLink').value;
      const done = () => {
        const b = $('btnCopyLink');
        const old = b.textContent;
        b.textContent = AZ.t('copied');
        setTimeout(() => { b.textContent = old; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(done);
      } else {
        $('inviteLink').select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        done();
      }
    });
  });

  AZ.Net = Net;
})();