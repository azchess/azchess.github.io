import { pieceSVG } from './pieces.js';

const FILES = 'abcdefgh';
const div = cls => { const e = document.createElement('div'); e.className = cls; return e; };

/**
 * Lövhə UI-ı. Şahmat məntiqini bilmir: handler `h` vasitəsilə soruşur.
 * h: { moves(sq), piece(sq), turn(), canMove(), move(from,to,promo), name(type) }
 * Pointer Events: klik və sürüşdürmə eyni yolla işləyir (mouse + touch).
 */
export class Board {
  constructor(root, h) {
    Object.assign(this, { root, h, flip: false, set: 'classic', legal: true, anim: true,
      sel: null, last: [], chk: null, drag: null, lock: false, top: null });
    this.targets = new Map();
    this.pcs = new Map();
    this.sqs = new Map();

    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + r, e = div('sq');
        e.dataset.k = (f + r) % 2 ? 'd' : 'l';
        this.sqs.set(sq, e);
        this.place(e, sq);
        root.append(e);
      }
    }
    this.layer = div('pcs');
    root.append(this.layer);

    root.addEventListener('pointerdown', e => this.down(e));
    root.addEventListener('pointermove', e => this.move(e));
    root.addEventListener('pointerup', e => this.up(e, false));
    root.addEventListener('pointercancel', e => this.up(e, true));
  }

  cr(sq) {
    const f = FILES.indexOf(sq[0]), r = +sq[1];
    return this.flip ? [7 - f, r - 1] : [f, 8 - r];
  }

  place(e, sq) {
    const [c, r] = this.cr(sq);
    e.style.setProperty('--c', c);
    e.style.setProperty('--r', r);
    if (!e.classList.contains('sq')) return;
    if (r === 7) e.dataset.f = sq[0]; else delete e.dataset.f;
    if (c === 0) e.dataset.r = sq[1]; else delete e.dataset.r;
  }

  at(e) {
    const b = this.root.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / b.width * 8);
    const r = Math.floor((e.clientY - b.top) / b.height * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    return this.flip ? FILES[7 - c] + (r + 1) : FILES[c] + (8 - r);
  }

  down(e) {
    if (this.lock || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const sq = this.at(e);
    if (!sq) return;
    if (this.sel && this.targets.has(sq)) { this.attempt(this.sel, sq); return; }
    const p = this.h.piece(sq);
    if (p && p.color === this.h.turn() && this.h.canMove()) {
      const was = this.sel === sq;
      this.select(sq);
      this.drag = { sq, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, was, el: null, rect: this.root.getBoundingClientRect() };
      this.root.setPointerCapture(e.pointerId);
    } else {
      this.clear();
    }
  }

  move(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.on) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (dx * dx + dy * dy < 36) return;
      d.el = this.pcs.get(d.sq);
      if (!d.el) { this.drag = null; return; }
      d.on = true;
      d.el.classList.add('drag');
    }
    const b = d.rect, s = b.width / 8;
    const x = e.clientX - b.left - s / 2, y = e.clientY - b.top - s / 2;
    d.el.style.setProperty('--drag-x', `${x}px`); d.el.style.setProperty('--drag-y', `${y}px`);
  }

  up(e, cancel) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    if (this.root.hasPointerCapture(e.pointerId)) this.root.releasePointerCapture(e.pointerId);
    if (!d.on) { if (d.was && !cancel) this.clear(); return; }
    d.el.classList.remove('drag');
    d.el.style.removeProperty('--drag-x'); d.el.style.removeProperty('--drag-y');
    const to = cancel ? null : this.at(e);
    if (to && this.targets.has(to)) this.attempt(d.sq, to);
  }

  attempt(from, to) {
    const ms = this.targets.get(to);
    if (!ms) return;
    if (ms.length > 1) this.promo(from, to, ms[0].color);
    else this.h.move(from, to);
  }

  promo(from, to, color) {
    this.lock = true;
    const o = div('promo');
    const done = p => {
      o.remove();
      this.lock = false;
      if (p) this.h.move(from, to, p); else this.clear();
    };
    o.onclick = e => { if (e.target === o) done(); };
    for (const p of 'qrbn') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pb';
      b.setAttribute('aria-label', this.h.name(p));
      b.innerHTML = pieceSVG(this.set, color, p);
      b.onclick = () => done(p);
      o.append(b);
    }
    this.root.append(o);
    o.firstChild.focus();
  }

  select(sq) {
    this.sel = sq;
    this.targets = new Map();
    for (const m of this.h.moves(sq)) {
      const a = this.targets.get(m.to) || [];
      a.push(m);
      this.targets.set(m.to, a);
    }
    this.paint();
  }

  clear() {
    this.sel = null;
    this.targets = new Map();
    this.paint();
  }

  paint() {
    for (const [sq, e] of this.sqs) {
      const t = this.targets.get(sq);
      e.className = 'sq ' + e.dataset.k
        + (sq === this.sel ? ' sel' : this.last.includes(sq) ? ' last' : '')
        + (sq === this.chk ? ' chk' : '')
        + (t && this.legal ? (t[0].captured ? ' hint cap' : ' hint') : '');
    }
  }

  setMarks(last, chk) { this.last = last; this.chk = chk; this.paint(); }

  add(sq, k) {
    const e = div('pc');
    e.dataset.k = k;
    e.innerHTML = pieceSVG(this.set, k[0], k[1]);
    this.place(e, sq);
    this.layer.append(e);
    this.pcs.set(sq, e);
  }

  out(e) {
    if (!this.anim) { e.remove(); return; }
    e.classList.add('out');
    setTimeout(() => e.remove(), 200);
  }

  /** DOM-u oyun vəziyyətinə uyğunlaşdırır (chess.board() nəticəsi). */
  sync(bd) {
    const want = new Map();
    bd.forEach((row, r) => row.forEach((p, c) => { if (p) want.set(FILES[c] + (8 - r), p.color + p.type); }));
    for (const [sq, e] of [...this.pcs]) {
      if (e.dataset.k !== want.get(sq)) { this.pcs.delete(sq); this.out(e); }
    }
    for (const [sq, k] of want) if (!this.pcs.has(sq)) this.add(sq, k);
  }

  /** Gedişi animasiya ilə göstərir: adi, tutma, en passant, rokirovka, promosiya. */
  applyMove(m) {
    const mv = (a, b) => {
      const e = this.pcs.get(a);
      if (!e) return;
      this.pcs.delete(a);
      const v = this.pcs.get(b);
      if (v) this.out(v);
      this.pcs.set(b, e);
      this.place(e, b);
      if (this.top) this.top.style.zIndex = '';
      e.style.zIndex = 2;
      this.top = e;
    };
    if (m.flags.includes('e')) {
      const key = m.to[0] + m.from[1], v = this.pcs.get(key);
      if (v) { this.pcs.delete(key); this.out(v); }
    }
    mv(m.from, m.to);
    const rank = m.from[1];
    if (m.flags.includes('k')) mv('h' + rank, 'f' + rank);
    if (m.flags.includes('q')) mv('a' + rank, 'd' + rank);
    if (m.promotion) {
      const e = this.pcs.get(m.to);
      if (e) { e.dataset.k = m.color + m.promotion; e.innerHTML = pieceSVG(this.set, m.color, m.promotion); }
    }
  }

  setPieces(set) {
    if (set === this.set) return;
    this.set = set;
    for (const e of this.pcs.values()) e.innerHTML = pieceSVG(set, e.dataset.k[0], e.dataset.k[1]);
  }

  setFlip(flip) {
    this.flip = flip;
    for (const [sq, e] of this.sqs) this.place(e, sq);
    for (const [sq, e] of this.pcs) this.place(e, sq);
  }

  setOpts({ legal, coords, anim }) {
    this.legal = legal;
    this.anim = anim;
    this.root.classList.toggle('nocoords', !coords);
    this.paint();
  }
}
