/* =========================================================
 * network.js — Online multiplayer over PeerJS (WebRTC).
 *
 * - Rooms are 6-digit codes; the host claims PeerJS id
 *   "chessweb-room-v1-<code>" on the public PeerJS cloud
 *   (no dedicated server needed -> GitHub Pages friendly).
 * - Joiner dials the host directly; all game traffic is P2P.
 * - A reconnect loop on both sides re-establishes the room /
 *   connection after brief internet drops, and the host
 *   re-syncs full game state after a reconnection.
 * ========================================================= */
'use strict';

const Network = (() => {

  const PREFIX = 'chessweb-room-v1-';
  const RECONNECT_MS = 4000;
  const CONNECT_TIMEOUT_MS = 15000;
  const PING_MS = 3000;

  let peer = null;
  let conn = null;
  let isHost = false;
  let roomCode = null;
  let intentionalClose = true;
  let hostHadConnection = false;
  let joinHadConnection = false;
  let reconnectTimer = null;
  let pingTimer = null;
  let latencyMs = 0;
  const handlers = {};

  /* ---------------- events ---------------- */

  function on(evt, fn) { handlers[evt] = fn; }
  function emit(evt, data) {
    try { if (handlers[evt]) handlers[evt](data || {}); } catch (e) { /* handler errors must not break the channel */ }
  }

  /* ---------------- helpers ---------------- */

  function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function isOpen() { return !!(conn && conn.open); }
  function getCode() { return roomCode; }
  function getLatency() { return latencyMs; }

  function friendlyError(err) {
    const type = err && err.type;
    switch (type) {
      case 'peer-unavailable': return 'Room not found. Double-check the 6-digit code.';
      case 'unavailable-id':   return 'Could not create the room (ID busy). Please try again.';
      case 'network':          return 'Network error. Check your internet connection.';
      case 'server-error':     return 'Signalling server error. Please try again in a moment.';
      case 'browser-incompatible': return 'Your browser does not support WebRTC.';
      default: return 'Connection error (' + (type || 'unknown') + ').';
    }
  }

  function send(obj) {
    if (isOpen()) { try { conn.send(obj); return true; } catch (e) { return false; } }
    return false;
  }

  /* ---------------- connection plumbing ---------------- */

  function wirePeer(p) {
    p.on('error', (err) => {
      if (!err) return;
      if (err.type === 'peer-unavailable' || err.type === 'unavailable-id' || err.type === 'browser-incompatible' || err.type === 'server-error') {
        emit('fatal', { msg: friendlyError(err) });
      }
      // 'network' / ICE errors are transient; the reconnect loop handles them.
    });
    p.on('disconnected', () => { try { p.reconnect(); } catch (e) {} });
  }

  function attachConn(c, onOpen) {
    conn = c;
    c.on('data', handleData);
    c.on('close', () => {
      if (conn === c) conn = null;
      stopPing();
      if (!intentionalClose) emit('disconnected');
    });
    c.on('error', () => {});
    if (onOpen) {
      c.on('open', onOpen);
      if (c.open) setTimeout(onOpen, 0); // connection may already be open when we attach
    }
  }

  function connectToHost() {
    if (!peer || peer.destroyed) return;
    const c = peer.connect(PREFIX + roomCode, { reliable: true, serialization: 'json' });
    attachConn(c, () => {
      if (joinHadConnection) emit('reconnected');
      else { joinHadConnection = true; emit('connected'); }
      startPing();
    });
  }

  function swapPeer(p) {
    if (peer && peer !== p) { try { peer.destroy(); } catch (e) {} }
    peer = p;
    wirePeer(p);
    emit('relistening');
  }

  /* ---------------- host / join ---------------- */

  function createRoom() {
    cleanup(false);
    intentionalClose = false;
    isHost = true;
    hostHadConnection = false;
    roomCode = genCode();
    return new Promise((resolve, reject) => {
      let settled = false;
      let p;
      try { p = new Peer(PREFIX + roomCode, { debug: 0 }); }
      catch (e) { reject('WebRTC is not available in this browser.'); return; }
      p.on('open', () => {
        if (settled) return;
        settled = true;
        swapPeer(p);
        startReconnectTimer();
        resolve(roomCode);
      });
      p.on('error', (err) => {
        if (!settled) { settled = true; reject(friendlyError(err)); }
        else emit('fatal', { msg: friendlyError(err) });
      });
      p.on('connection', (c) => {
        if (conn && conn.open) { try { c.close(); } catch (e) {} return; } // one opponent per room
        attachConn(c, () => {
          startPing();
          if (hostHadConnection) emit('reconnected');
          else { hostHadConnection = true; emit('playerJoined'); }
        });
      });
    });
  }

  function joinRoom(codeOrLink) {
    const m = String(codeOrLink || '').replace(/[^0-9]/g, '').match(/(\d{6})/);
    if (!m) return Promise.reject('Invalid code — enter the 6-digit room code (or paste the invite link).');
    const code = m[1];
    cleanup(false);
    intentionalClose = false;
    isHost = false;
    joinHadConnection = false;
    roomCode = code;
    return new Promise((resolve, reject) => {
      let settled = false;
      let p;
      try { p = new Peer({ debug: 0 }); }
      catch (e) { reject('WebRTC is not available in this browser.'); return; }
      const fail = (msg) => { if (!settled) { settled = true; try { p.destroy(); } catch (e) {} reject(msg); } };
      p.on('error', (err) => {
        if (!settled) {
          if (err && err.type === 'peer-unavailable') fail('Room not found. Double-check the 6-digit code.');
          else fail(friendlyError(err));
        } else if (err && (err.type === 'peer-unavailable' || err.type === 'unavailable-id')) {
          emit('fatal', { msg: friendlyError(err) });
        }
      });
      p.on('open', () => {
        swapPeer(p);
        startReconnectTimer();
        const to = setTimeout(() => fail('Connection timed out — the room may no longer exist.'), CONNECT_TIMEOUT_MS);
        const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        attachConn(c, () => {
          clearTimeout(to);
          if (settled) return;
          settled = true;
          joinHadConnection = true;
          emit('connected');
          startPing();
          resolve();
        });
      });
    });
  }

  /* ---------------- reconnect loop ---------------- */

  function startReconnectTimer() {
    stopReconnectTimer();
    reconnectTimer = setInterval(attemptReconnect, RECONNECT_MS);
  }
  function stopReconnectTimer() {
    if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
  }

  function attemptReconnect() {
    if (intentionalClose || !roomCode) return;
    if (conn && conn.open) return;
    try {
      if (isHost) {
        if (peer && !peer.destroyed && peer.open) return; // signalling alive; waiting for the opponent to dial back
        const p = new Peer(PREFIX + roomCode, { debug: 0 });
        p.on('open', () => swapPeer(p));
        p.on('error', () => { try { p.destroy(); } catch (e) {} });
        p.on('connection', (c) => {
          if (conn && conn.open) { try { c.close(); } catch (e) {} return; }
          attachConn(c, () => {
            startPing();
            emit('reconnected'); // hostHadConnection is true here by definition
          });
        });
      } else {
        if (peer && !peer.destroyed && peer.open) { connectToHost(); return; }
        const p = new Peer({ debug: 0 });
        p.on('open', () => { swapPeer(p); connectToHost(); });
        p.on('error', () => { try { p.destroy(); } catch (e) {} });
      }
    } catch (e) { /* try again next tick */ }
  }

  /* ---------------- heartbeat ---------------- */

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      if (isOpen()) send({ type: 'ping', t: Date.now() });
    }, PING_MS);
  }
  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    latencyMs = 0;
  }

  function handleData(d) {
    if (!d || typeof d !== 'object') return;
    if (d.type === 'ping') { send({ type: 'pong', t: d.t }); return; }
    if (d.type === 'pong') {
      latencyMs = Math.max(0, Date.now() - (d.t || Date.now()));
      emit('latency', latencyMs);
      return;
    }
    emit(d.type, d);
  }

  /* ---------------- teardown ---------------- */

  function cleanup(silent) {
    intentionalClose = true;
    stopReconnectTimer();
    stopPing();
    if (conn) { try { conn.close(); } catch (e) {} conn = null; }
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    roomCode = null;
    hostHadConnection = false;
    joinHadConnection = false;
    if (!silent) emit('closed');
  }

  return {
    on: on,
    createRoom: createRoom,
    joinRoom: joinRoom,
    send: send,
    isOpen: isOpen,
    isHost: () => isHost,
    code: getCode,
    latency: getLatency,
    cleanup: cleanup
  };
})();
