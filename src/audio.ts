import type { GameEvent } from './engine.ts';

export class Sound {
  context: AudioContext | null = null;
  enabled = false;
  unlock() {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }
  tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.04, delay = 0, endFreq?: number) {
    if (!this.context || !this.enabled) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
  }
  play(event: GameEvent) {
    if (event === 'rewind') this.tone(700, 0.28, 'sine', 0.07, 0, 100);
    if (event === 'door') { this.tone(220, 0.1, 'triangle'); this.tone(330, 0.1, 'triangle', 0.035, 0.07); }
    if (event === 'loot' || event === 'deposit' || event === 'receipt') { this.tone(660, 0.22); this.tone(990, 0.3, 'sine', 0.05, 0.1); }
    if (event === 'lure') this.tone(950, 0.14, 'triangle', 0.04, 0, 350);
    if (event === 'tick') this.tone(440, 0.06, 'sine', 0.025);
    if (event === 'caught' || event === 'full') this.tone(160, 0.3, 'sawtooth', 0.025, 0, 65);
    if (event === 'start') this.tone(350, 0.18, 'sine', 0.045, 0, 600);
    if (event === 'won') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.055, i * 0.13));
  }
}
