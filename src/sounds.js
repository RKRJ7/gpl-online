// ============================================================
//  GPL Online — Sound System (Web Audio API)
// ============================================================

const SCREAMS = [
  'HAI MERI MAA! 😭',
  'BACHAO! 🙏',
  'NAHI NAHI NAHI!',
  'AAAAAAAAH! 😱',
  'CHHODO MUJHE! 🥺',
  'YE KYA HO RAHA HAI!',
  'DARD HO RAHA HAI!',
  'MAAFI CHAHIYE! 🙏',
  'BAS KAR BAS KAR!',
  'OUCH OUCH OUCH!',
  'PLEEEEASE! 😭',
  'TERI MUMMY KI KASAM!',
];

export class SoundSystem {
  constructor() {
    this.ctx         = null;
    this.enabled     = true;
    this.initialized = false;
    this.masterGain  = null;
  }

  /** Must be called from a user gesture (click) */
  init() {
    if (this.initialized) return;
    try {
      this.ctx        = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.enabled ? 0.8 : 0, this.ctx.currentTime, 0.05,
      );
    }
    return this.enabled;
  }

  // ─── Private helpers ─────────────────────────────────────

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _createNoise(duration, amplitude = 1) {
    const sr  = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * duration, sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * amplitude;
    }
    return buf;
  }

  _playBuffer(buffer, { filterType, filterFreq, gainStart, duration, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    this._resume();
    const t = this.ctx.currentTime + delay;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainStart, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    if (filterType) {
      const f = this.ctx.createBiquadFilter();
      f.type            = filterType;
      f.frequency.value = filterFreq;
      source.connect(f);
      f.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(this.masterGain);
    source.start(t);
    source.stop(t + duration);
  }

  _playOsc({ type = 'sine', freqStart, freqEnd, gainStart, duration, delay = 0, detune = 0 }) {
    if (!this.ctx || !this.enabled) return;
    this._resume();
    const t = this.ctx.currentTime + delay;

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type    = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    }

    gain.gain.setValueAtTime(gainStart, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // ─── Weapon Sounds ─────────────────────────────────────────

  playChapaat() {
    if (!this.ctx) return;
    // Sharp skin slap — low-passed noise
    const buf = this._createNoise(0.18, 1.2);
    this._playBuffer(buf, { filterType: 'lowpass', filterFreq: 900, gainStart: 2, duration: 0.18 });
    // High crack layered on top
    this._playOsc({ type: 'square', freqStart: 2400, freqEnd: 800, gainStart: 0.3, duration: 0.06 });
  }

  playChappal() {
    if (!this.ctx) return;
    // Whoosh approach
    const whoosh = this._createNoise(0.07, 0.6);
    this._playBuffer(whoosh, { filterType: 'bandpass', filterFreq: 2000, gainStart: 0.8, duration: 0.07 });
    // Rubbery thwack
    const thwack = this._createNoise(0.2, 1.5);
    this._playBuffer(thwack, { filterType: 'lowpass', filterFreq: 700, gainStart: 2.5, duration: 0.2, delay: 0.06 });
    // Slight pitch drop osc
    this._playOsc({ type: 'sawtooth', freqStart: 400, freqEnd: 150, gainStart: 0.4, duration: 0.15, delay: 0.06 });
  }

  playBelt() {
    if (!this.ctx) return;
    // Whoosh (belt swing through air)
    const whoosh = this._createNoise(0.1, 0.8);
    this._playBuffer(whoosh, { filterType: 'highpass', filterFreq: 3000, gainStart: 1, duration: 0.1 });
    // Sharp CRACK
    this._playOsc({ type: 'sawtooth', freqStart: 1800, freqEnd: 300, gainStart: 1.2, duration: 0.08, delay: 0.08 });
    const crack = this._createNoise(0.06, 2);
    this._playBuffer(crack, { gainStart: 3, duration: 0.06, delay: 0.08 });
  }

  playHammer() {
    if (!this.ctx) return;
    // Heavy low THUD
    this._playOsc({ type: 'sine', freqStart: 120, freqEnd: 40, gainStart: 3, duration: 0.35 });
    // Impact transient (noise)
    const thud = this._createNoise(0.05, 2.5);
    this._playBuffer(thud, { filterType: 'lowpass', filterFreq: 400, gainStart: 4, duration: 0.05 });
    // Spring BOING after
    this._playOsc({ type: 'sine', freqStart: 180, freqEnd: 600, gainStart: 0.8, duration: 0.4, delay: 0.15 });
    this._playOsc({ type: 'sine', freqStart: 600, freqEnd: 180, gainStart: 0.5, duration: 0.4, delay: 0.3 });
  }

  playBat() {
    if (!this.ctx) return;
    // Wooden crack
    const crack = this._createNoise(0.25, 2);
    this._playBuffer(crack, { filterType: 'bandpass', filterFreq: 1400, gainStart: 3, duration: 0.25 });
    // Low wood resonance
    this._playOsc({ type: 'triangle', freqStart: 280, freqEnd: 200, gainStart: 0.8, duration: 0.3 });
    // High impact pop
    this._playOsc({ type: 'square', freqStart: 3000, freqEnd: 800, gainStart: 0.4, duration: 0.05 });
  }

  playBoot() {
    if (!this.ctx) return;
    // Kick thud
    this._playOsc({ type: 'sine', freqStart: 180, freqEnd: 35, gainStart: 3.5, duration: 0.25 });
    const thud = this._createNoise(0.05, 3);
    this._playBuffer(thud, { filterType: 'lowpass', filterFreq: 300, gainStart: 5, duration: 0.05 });
    // Air swoosh
    const swoosh = this._createNoise(0.12, 0.6);
    this._playBuffer(swoosh, { filterType: 'bandpass', filterFreq: 1200, gainStart: 0.8, duration: 0.12, delay: -0.05 });
  }

  // ─── Play by weapon name ──────────────────────────────────

  play(weaponId) {
    if (!this.initialized) return;
    switch (weaponId) {
      case 'chapaat': this.playChapaat(); break;
      case 'chappal': this.playChappal(); break;
      case 'belt':    this.playBelt();    break;
      case 'hammer':  this.playHammer();  break;
      case 'bat':     this.playBat();     break;
      case 'boot':    this.playBoot();    break;
    }
  }

  // ─── Scream (Speech Synthesis) ───────────────────────────

  playScream() {
    if (!this.enabled) return null;
    const text = SCREAMS[Math.floor(Math.random() * SCREAMS.length)];

    // Text only (speech synthesis is unreliable cross-browser for Hindi)
    // We show animated text bubble instead
    return text;
  }

  // ─── Celebration sound ───────────────────────────────────

  playCelebration() {
    if (!this.ctx || !this.enabled) return;
    this._resume();

    // Happy ascending notes
    const notes = [261, 329, 392, 523, 659, 784];
    notes.forEach((freq, i) => {
      this._playOsc({
        type:      'sine',
        freqStart: freq,
        freqEnd:   freq * 1.02,
        gainStart: 0.4,
        duration:  0.3,
        delay:     i * 0.08,
      });
    });
  }

  // ─── Combo sound ─────────────────────────────────────────

  playCombo(tier) {
    if (!this.ctx || !this.enabled) return;
    this._resume();

    const baseFreq = 300 + tier * 150;
    this._playOsc({ type: 'sine', freqStart: baseFreq, freqEnd: baseFreq * 1.5, gainStart: 0.8, duration: 0.2 });
    this._playOsc({ type: 'square', freqStart: baseFreq * 2, freqEnd: baseFreq * 3, gainStart: 0.3, duration: 0.15, delay: 0.1 });
  }
}
