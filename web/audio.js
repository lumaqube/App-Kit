// Music and sound effects made by code (Web Audio): no audio files, nothing to license.
//   import { Sound } from '/kit/audio.js';
//   const sound = new Sound();  sound.init({ bgmVolume: 60, sfxVolume: 80 });   (0-100)
//   sound.startBgm() / stopBgm() / duck(true|false)    the background loop; duck = quieter under an effect
//   sound.tick() whoosh() pop() count() go() fanfare() error()   effects
//   new Sound({ song: { bpm, chords, bass, melody } })   your own loop (same shapes as DEFAULT_SONG below)
// Browsers start audio only after a tap; the desktop shell allows it from the start. Call
// sound.resume() in a pointerdown handler to be safe in a browser.
// Default BGM: a cheerful 8-bar loop in C major (C G Am F): kick, clap, hats, bouncy bass, arpeggio,
// pad, bell melody, 118 BPM.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// The loop: 16 steps a bar, 8 bars. Chords per bar, melody per bar (midi, or 0 = rest).
const DEFAULT_CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
const DEFAULT_BASS = [36, 31, 33, 29, 36, 31, 33, 29];
const _ = 0;
const DEFAULT_MELODY = [
  [72, _, _, 76, _, _, 79, _, 76, _, 74, _, 72, _, _, _],
  [74, _, _, 79, _, _, 83, _, 81, _, 79, _, 74, _, _, _],
  [76, _, _, 72, _, _, 76, _, 79, _, 81, _, 79, _, _, _],
  [77, _, 76, _, 74, _, 72, _, 74, _, _, _, 67, _, 69, _],
  [72, _, 74, 76, _, 79, _, 84, _, 81, _, 79, _, 76, _, _],
  [74, _, 76, 79, _, 83, _, 86, _, 83, _, 79, _, 74, _, _],
  [81, _, 79, 76, _, 72, _, 76, _, 79, _, 81, _, 84, _, _],
  [83, _, 81, 79, _, 77, _, 76, _, 74, _, 72, _, _, _, _],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
export const DEFAULT_SONG = { bpm: 118, chords: DEFAULT_CHORDS, bass: DEFAULT_BASS, melody: DEFAULT_MELODY };

export class Sound {
  // song: { bpm, chords: [[midi x3] per bar], bass: [midi per bar], melody: [[16 steps: midi or 0] per bar] }
  constructor({ song } = {}) { this.ctx = null; this.timer = null; this.playing = false; this.song = { ...DEFAULT_SONG, ...song }; }

  setVolumes({ bgmVolume, sfxVolume }) {
    if (!this.ctx) return;
    if (bgmVolume != null) { this.bgmLevel = 0.42 * bgmVolume / 100; if (this.playing) this.bgm.gain.setTargetAtTime(this.bgmLevel, this.ctx.currentTime, 0.1); }
    if (sfxVolume != null) this.sfx.gain.value = 0.9 * sfxVolume / 100;
  }

  init({ bgmVolume = 60, sfxVolume = 80 } = {}) {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
    this.bgm = ctx.createGain(); this.bgm.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.bgmLevel = 0.42 * bgmVolume / 100;
    this.bgm.gain.value = this.bgmLevel;
    this.sfx.gain.value = 0.9 * sfxVolume / 100;
    // white noise, for drums, whoosh and sparkle
    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  // ---- building blocks ----
  tone(dest, { type = 'sine', freq, t, dur, vol = 0.3, attack = 0.005, release = null, cutoff = 0, slideTo = 0, detune = 0 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
    let last = o;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); last = f; }
    last.connect(g); g.connect(dest);
    o.start(t); o.stop(t + (release ?? dur) + 0.05);
  }

  noise(dest, { t, dur, vol = 0.3, type = 'highpass', freq = 6000, q = 0.7, sweepTo = 0 }) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---- BGM ----
  startBgm() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.1;
    this.bgm.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgm.gain.setTargetAtTime(this.bgmLevel, this.ctx.currentTime, 0.3);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopBgm() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.bgm.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
  }

  // lower the music under the spin, back up after
  duck(on) {
    if (!this.ctx) return;
    this.bgm.gain.setTargetAtTime(on ? this.bgmLevel * 0.35 : this.bgmLevel, this.ctx.currentTime, 0.25);
  }

  schedule() {
    const sixteenth = 60 / this.song.bpm / 4, bars = this.song.chords.length;
    while (this.next < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.next, sixteenth);
      this.next += sixteenth;
      this.step = (this.step + 1) % (16 * bars);
    }
  }

  playStep(step, t, len) {
    const bar = Math.floor(step / 16), s = step % 16, out = this.bgm;
    // drums
    if (s === 0 || s === 8 || (bar % 4 === 3 && s === 10)) this.kick(out, t);
    if (s === 4 || s === 12) { this.noise(out, { t, dur: 0.14, vol: 0.32, type: 'bandpass', freq: 1700, q: 0.8 }); this.tone(out, { type: 'triangle', freq: 200, t, dur: 0.06, vol: 0.12 }); }
    if (s % 2 === 0) this.noise(out, { t, dur: s % 4 === 2 ? 0.09 : 0.03, vol: s % 4 === 2 ? 0.1 : 0.06, freq: 8000 });
    // bass: root, root, octave, root, fifth, octave
    const { chords: CHORDS, bass: BASS, melody: MELODY } = this.song;
    const root = BASS[bar % BASS.length];
    const bassNote = { 0: root, 3: root, 6: root + 12, 8: root, 11: root + 7, 14: root + 12 }[s];
    if (bassNote) this.tone(out, { type: 'triangle', freq: mtof(bassNote), t, dur: len * 1.6, vol: 0.34 });
    // arpeggio on the chord, an octave up
    if (s % 2 === 0) {
      const ch = CHORDS[bar], k = ARP[(s / 2) % 8];
      const note = (k === 3 ? ch[0] + 12 : ch[k]) + 12;
      this.tone(out, { type: 'square', freq: mtof(note), t, dur: len * 1.2, vol: 0.05, cutoff: 2400 });
    }
    // soft chord pad on each bar
    if (s === 0) for (const m of CHORDS[bar]) this.tone(out, { type: 'sawtooth', freq: mtof(m + 12), t, dur: len * 16, attack: 0.08, vol: 0.022, cutoff: 1200 });
    // melody: a bell (sine + a quiet octave)
    const m = MELODY[bar % MELODY.length]?.[s];
    if (m) {
      this.tone(out, { type: 'triangle', freq: mtof(m), t, dur: len * 2.6, vol: 0.13 });
      this.tone(out, { type: 'sine', freq: mtof(m + 12), t, dur: len * 1.4, vol: 0.04 });
    }
  }

  kick(dest, t) {
    this.tone(dest, { type: 'sine', freq: 150, slideTo: 42, t, dur: 0.22, vol: 0.7, attack: 0.002 });
  }

  // ---- SFX ----
  get now() { return this.ctx.currentTime; }

  tick(speed = 1) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(this.sfx, { type: 'square', freq: 1400 + Math.random() * 300, t, dur: 0.035, vol: 0.18, cutoff: 5000 });
    this.noise(this.sfx, { t, dur: 0.02, vol: 0.25 * Math.min(1, speed), freq: 4000 });
  }

  whoosh() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(this.sfx, { t, dur: 0.9, vol: 0.5, type: 'bandpass', freq: 300, sweepTo: 2600, q: 1.2 });
    this.tone(this.sfx, { type: 'sine', freq: 220, slideTo: 660, t, dur: 0.45, vol: 0.12 });
  }

  pop() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(this.sfx, { type: 'sine', freq: 420, slideTo: 980, t, dur: 0.09, vol: 0.35 });
  }

  count(last = false) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(this.sfx, { type: 'triangle', freq: last ? 1320 : 880, t, dur: last ? 0.35 : 0.12, vol: 0.3 });
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.now, out = this.sfx;
    [72, 76, 79, 84].forEach((m, i) => {
      this.tone(out, { type: 'square', freq: mtof(m), t: t + i * 0.09, dur: 0.12, vol: 0.12, cutoff: 3500 });
      this.tone(out, { type: 'triangle', freq: mtof(m), t: t + i * 0.09, dur: 0.16, vol: 0.2 });
    });
    const tc = t + 0.4;
    for (const m of [72, 76, 79, 84]) {
      this.tone(out, { type: 'sawtooth', freq: mtof(m), t: tc, dur: 1.2, attack: 0.02, vol: 0.05, cutoff: 2800, detune: 6 });
      this.tone(out, { type: 'triangle', freq: mtof(m), t: tc, dur: 1.3, attack: 0.02, vol: 0.12 });
    }
    this.kick(out, tc);
    this.noise(out, { t: tc, dur: 1.4, vol: 0.18, freq: 6000 }); // cymbal
    for (let i = 0; i < 10; i++) this.tone(out, { type: 'sine', freq: mtof(96 + [0, 4, 7, 12][i % 4]), t: tc + 0.1 + i * 0.07, dur: 0.12, vol: 0.06 }); // sparkle
  }

  go() {
    if (!this.ctx) return;
    const t = this.now;
    [79, 84, 88].forEach((m, i) => this.tone(this.sfx, { type: 'triangle', freq: mtof(m), t: t + i * 0.07, dur: 0.25, vol: 0.22 }));
    this.noise(this.sfx, { t, dur: 0.5, vol: 0.2, type: 'bandpass', freq: 800, sweepTo: 5000, q: 1 });
  }

  error() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(this.sfx, { type: 'square', freq: 330, t, dur: 0.14, vol: 0.12, cutoff: 1500 });
    this.tone(this.sfx, { type: 'square', freq: 247, t: t + 0.15, dur: 0.22, vol: 0.12, cutoff: 1500 });
  }
}
