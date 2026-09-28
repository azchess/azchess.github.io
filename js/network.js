const PREFIX = 'azchess-';
const TYPES = new Set(['join', 'hello', 'move', 'draw', 'drawAccept', 'drawDecline', 'end', 'rematch', 'chat', 'fx']);
const newCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

/**
 * PeerJS üzərində zərflənmiş mesaj kanalı. Hər mesaj: { v, t, gid, seq, ... }.
 * seq hər bağlantıda 1-dən artır: dublikat və sıradan kənar paketlər atılır.
 */
export class Net {
  constructor(role, h) {
    Object.assign(this, { role, h, peer: null, conn: null, tx: 0, gid: null });
  }

  get open() { return !!this.conn && this.conn.open; }

  /** 6 rəqəmli otaq kodu ilə gözləməyə başlayır. Kod məşğuldursa yenisini seçir. */
  host() {
    return new Promise((resolve, reject) => {
      const attempt = n => {
        const code = newCode(), peer = new window.Peer(PREFIX + code);
        let opened = false;
        peer.on('open', () => { opened = true; this.peer = peer; resolve(code); });
        peer.on('connection', c => this.incoming(c));
        peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
        peer.on('error', e => {
          if (!opened && e.type === 'unavailable-id' && n < 5) { peer.destroy(); attempt(n + 1); }
          else if (!opened) reject(e);
          else this.h.onError(e.type);
        });
      };
      attempt(0);
    });
  }

  incoming(c) {
    c._rx = 0;
    c.on('data', d => this.recv(c, d));
    c.on('close', () => this.closed(c));
    c.on('error', () => this.closed(c));
  }

  join(code, key) {
    const peer = new window.Peer();
    this.peer = peer;
    peer.on('error', e => this.h.onError(e.type));
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      c._rx = 0;
      c.on('open', () => { this.conn = c; this.tx = 0; this.send('join', { key }); });
      c.on('data', d => this.recv(c, d));
      c.on('close', () => this.closed(c));
      c.on('error', () => this.closed(c));
    });
  }

  recv(c, d) {
    if (!d || typeof d !== 'object' || d.v !== 1 || !TYPES.has(d.t)) return;
    if (!Number.isSafeInteger(d.seq) || d.seq !== c._rx + 1) return;
    c._rx = d.seq;
    if (d.t === 'join') {
      const badKey = d.key != null && typeof d.key !== 'string';
      if (this.role !== 'host' || badKey || !this.h.onJoin(d.key)) { c.close(); return; }
      if (this.conn && this.conn !== c) this.conn.close();
      this.conn = c;
      this.tx = 0;
      this.h.onReady();
      return;
    }
    if (c !== this.conn) return;
    if (d.t === 'hello') {
      if (this.role !== 'guest' || typeof d.gid !== 'string') return;
      this.gid = d.gid;
    } else if (d.gid !== this.gid) {
      return;
    }
    this.h.onMsg(d);
  }

  send(t, data = {}) {
    if (this.open) this.conn.send({ ...data, v: 1, t, gid: this.gid, seq: ++this.tx });
  }

  closed(c) {
    if (c !== this.conn) return;
    this.conn = null;
    this.h.onClose();
  }

  leave() {
    try { this.peer?.destroy(); } catch { /* artıq bağlıdır */ }
    this.peer = null;
    this.conn = null;
  }
}
