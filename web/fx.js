// Confetti bursts and slow floating sparkles on a full-screen canvas.
const COLORS = ['#ff4d6d', '#ffb703', '#06d6a0', '#3a86ff', '#9b5de5', '#ff7b00', '#ffffff', '#f15bb5'];

export class Fx {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.parts = [];
    this.sparkles = [];
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    const n = Math.round((this.w * this.h) / 26000);
    this.sparkles = Array.from({ length: n }, () => this.sparkle(true));
  }

  sparkle(anywhere) {
    return { x: Math.random() * this.w, y: anywhere ? Math.random() * this.h : this.h + 10, r: 1 + Math.random() * 3,
      vy: -(8 + Math.random() * 22), tw: Math.random() * Math.PI * 2, c: Math.random() < 0.5 ? '#fff6c9' : '#ffd1f0' };
  }

  // a burst of confetti from (x, y) in CSS pixels
  burst(x, y, count = 160, power = 1) {
    const u = Math.min(this.w, this.h);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.25 + Math.random() * 0.9) * u * 1.4 * power;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - u * 0.6 * power,
        w: u * (0.008 + Math.random() * 0.012), h: u * (0.004 + Math.random() * 0.008),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 3 + Math.random() * 2, round: Math.random() < 0.3,
      });
    }
  }

  // confetti raining from the top edge
  rain(count = 120) {
    const u = Math.min(this.w, this.h);
    for (let i = 0; i < count; i++) {
      this.parts.push({
        x: Math.random() * this.w, y: -20 - Math.random() * this.h * 0.4, vx: (Math.random() - 0.5) * u * 0.2, vy: u * (0.1 + Math.random() * 0.25),
        w: u * (0.008 + Math.random() * 0.01), h: u * (0.004 + Math.random() * 0.007),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: COLORS[(Math.random() * COLORS.length) | 0], life: 5, round: false,
      });
    }
  }

  step(dt, t) {
    const g = this.g, u = Math.min(this.w, this.h);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    for (const s of this.sparkles) {
      s.y += s.vy * dt; s.x += Math.sin(t * 0.8 + s.tw) * 6 * dt;
      if (s.y < -10) Object.assign(s, this.sparkle(false));
      g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 3 + s.tw);
      g.fillStyle = s.c; g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    const grav = u * 1.6, drag = Math.pow(0.35, dt);
    this.parts = this.parts.filter(p => (p.life -= dt) > 0 && p.y < this.h + 40);
    for (const p of this.parts) {
      p.vx *= drag; p.vy = p.vy * drag + grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      g.save();
      g.globalAlpha = Math.min(1, p.life);
      g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.c;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.h, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.7)) + 1);
      g.restore();
    }
  }
}
