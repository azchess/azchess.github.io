// Vaxt Date.now() ilə hesablanır: tab dəyişəndə və ya interval yavaşlayanda səhv toplanmır.
export class Clock {
  constructor(onTick, onFlag) {
    this.onTick = onTick;
    this.onFlag = onFlag;
    this.ms = { w: 0, b: 0 };
    this.inc = 0;
    this.active = null;
    this.t0 = 0;
    this.iv = 0;
  }

  read() {
    const r = { ...this.ms };
    if (this.active) r[this.active] = Math.max(0, r[this.active] - (Date.now() - this.t0));
    return r;
  }

  emit() { this.onTick(this.read(), this.active); }

  /** ms və inc millisaniyə ilə verilir. */
  reset(ms, inc) {
    this.stop();
    this.ms = { w: ms, b: ms };
    this.inc = inc;
    this.emit();
  }

  start(color) {
    clearInterval(this.iv);
    this.active = color;
    this.t0 = Date.now();
    this.iv = setInterval(() => this.tick(), 100);
    this.emit();
  }

  stop() {
    this.ms = this.read();
    clearInterval(this.iv);
    this.active = null;
    this.emit();
  }

  /** Gedişi edən tərəfin saatını dayandırır, artım əlavə edir, rəqibinkini işə salır. */
  press(mover) {
    if (this.active) {
      this.ms = this.read();
      this.ms[mover] += this.inc;
    }
    this.start(mover === 'w' ? 'b' : 'w');
  }

  tick() {
    const a = this.active;
    if (!a) return;
    const r = this.read();
    this.emit();
    if (r[a] <= 0) { this.stop(); this.onFlag(a); }
  }
}
