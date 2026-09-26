'use strict';

(function() {
  let peer = null;
  let conn = null;

  function initPeer() {
    if (peer) return;
    peer = new Peer();

    peer.on('open', (id) => {
      console.log('Peer ID:', id);
    });

    peer.on('connection', (c) => {
      conn = c;
      setupConnListeners();
    });
  }

  function createRoom() {
    initPeer();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('display-room-code').textContent = code;
    document.getElementById('room-status').classList.remove('hidden');

    const customPeer = new Peer('azchess-' + code);
    customPeer.on('connection', (c) => {
      conn = c;
      setupConnListeners();
      alert('Rəqib qoşuldu!');
      closeModal();
    });
  }

  function joinRoom() {
    const code = document.getElementById('input-room-code').value.trim();
    if (code.length !== 6) {
      alert('6 rəqəmli kodu daxil edin!');
      return;
    }
    initPeer();
    conn = peer.connect('azchess-' + code);
    setupConnListeners();
  }

  function setupConnListeners() {
    conn.on('open', () => {
      alert('Şahmat şəbəkəsinə qoşulma uğurludur!');
      closeModal();
    });

    conn.on('data', (data) => {
      if (data.type === 'move') {
        window.executeMove(data.move);
      }
    });
  }

  function sendMove(move) {
    if (conn && conn.open) {
      conn.send({ type: 'move', move });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-create-room').onclick = createRoom;
    document.getElementById('btn-join-room').onclick = joinRoom;
  });

  window.AzNet = { sendMove };
})();