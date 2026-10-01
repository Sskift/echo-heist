import type { GameEvent, Status } from './engine.ts';
import type { Level } from './levels.ts';
import { SOUNDTRACK, type TrackId } from './soundtrack.ts';

const AUDIO_KEY = 'echo-heist-audio-v1';
type AudioSettings = { enabled: boolean; music: number; effects: number; adaptive: boolean };
const defaults: AudioSettings = { enabled: false, music: 0.5, effects: 0.75, adaptive: true };
const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export class Sound {
  context: AudioContext | null = null;
  settings: AudioSettings = { ...defaults };
  onChange = () => {};
  error = '';
  private master!: GainNode;
  private musicBus!: GainNode;
  private effectBus!: GainNode;
  private filter!: BiquadFilterNode;
  private tension!: GainNode;
  private focused = true;
  private desired: TrackId = 'espionage';
  private loading: TrackId | null = null;
  private sequence = 0;
  private mixKey = '';
  private scene = { status: 'ready' as Status, alarm: 0, preview: false, ending: false };
  private buffers = new Map<TrackId, Promise<AudioBuffer>>();
  private current: { id: TrackId; source: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor() {
    try {
      const data = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? 'null');
      if (data && typeof data === 'object') this.settings = { enabled: data.enabled === true, music: volume(data.music, defaults.music), effects: volume(data.effects, defaults.effects), adaptive: data.adaptive !== false };
    } catch { /* Settings are optional; a blocked store must not stop play. */ }
  }
  get enabled() { return this.settings.enabled; }
  set enabled(value: boolean) { this.configure({ enabled: value }); }
  get description() {
    if (!this.enabled) return '声音已关闭';
    if (!this.context || this.context.state !== 'running') return '点击开启声音或开始行动';
    if (!this.focused) return '后台静音';
    if (this.settings.music === 0) return '音乐已静音';
    if (this.error) return this.error;
    if (this.loading) return '正在准备配乐…';
    const track = SOUNDTRACK[this.current?.id ?? this.desired];
    return `${track.title} · ${track.artist}`;
  }
  configure(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch, music: volume(patch.music, this.settings.music), effects: volume(patch.effects, this.settings.effects) };
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(this.settings)); } catch { /* In-memory controls still work. */ }
    this.mixKey = ''; this.mix(); this.onChange();
    if (this.enabled) void this.ensureTrack();
  }
  unlock() {
    if (!this.enabled) return;
    this.focused = !document.hidden;
    try {
      if (!this.context) {
        const ctx = new AudioContext(); this.context = ctx;
        this.master = ctx.createGain(); this.master.gain.value = 0;
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -9; limiter.knee.value = 6; limiter.ratio.value = 8;
        this.master.connect(limiter); limiter.connect(ctx.destination);
        this.effectBus = ctx.createGain(); this.effectBus.connect(this.master);
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
        this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 0.5; this.filter.connect(this.musicBus);
        // A quiet bass pulse follows suspicion in wall-clock time. Music never
        // restarts on rewind or runs at 3x during fast-forward.
        const bass = ctx.createOscillator(); bass.type = 'sine'; bass.frequency.value = 55;
        const breath = ctx.createGain(); breath.gain.value = 0.5;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 2.4;
        const depth = ctx.createGain(); depth.gain.value = 0.5;
        lfo.connect(depth); depth.connect(breath.gain);
        this.tension = ctx.createGain(); this.tension.gain.value = 0;
        bass.connect(breath); breath.connect(this.tension); this.tension.connect(this.musicBus);
        bass.start(); lfo.start();
      }
      this.mixKey = ''; this.mix();
      if (this.context.state === 'suspended') void this.context.resume().then(() => { this.onChange(); void this.ensureTrack(); }).catch(() => { this.error = '浏览器暂停了声音，请再次点击开启'; this.onChange(); });
      else void this.ensureTrack();
    } catch { this.error = '此浏览器暂时无法播放声音'; this.onChange(); }
  }
  focus(value: boolean) { this.focused = value && !document.hidden; this.mixKey = ''; this.mix(); this.onChange(); }
  updateScene(theme: Level['theme'], status: Status, alarm: number, preview: boolean, ending: boolean) {
    const id: TrackId = ending ? 'harbor' : theme === 'industrial' || theme === 'audit' ? 'experiments' : 'espionage';
    this.scene = { status, alarm: Math.round(Math.max(0, Math.min(1, alarm)) * 20) / 20, preview, ending };
    if (id !== this.desired) { this.desired = id; this.loading = null; this.sequence++; this.error = ''; void this.ensureTrack(); this.onChange(); }
    this.mix();
  }
  private mix() {
    const ctx = this.context; if (!ctx) return;
    const { status, alarm, preview, ending } = this.scene;
    const key = `${status}:${alarm}:${preview}:${ending}:${this.focused}:${this.enabled}:${this.settings.music}:${this.settings.effects}:${this.settings.adaptive}`;
    if (key === this.mixKey) return;
    this.mixKey = key;
    const now = ctx.currentTime, active = status === 'running' && !preview && !ending;
    const smooth = (param: AudioParam, target: number, seconds = 0.22) => { param.cancelScheduledValues(now); param.setTargetAtTime(target, now, seconds); };
    // Leaving the tab and muting silence even already queued SFX immediately.
    this.master.gain.cancelScheduledValues(now);
    if (!this.enabled || !this.focused) this.master.gain.setValueAtTime(0, now);
    else this.master.gain.setTargetAtTime(0.85, now, 0.1);
    smooth(this.effectBus.gain, this.settings.effects, 0.03);
    smooth(this.musicBus.gain, this.settings.music * (ending ? 0.9 : active ? 0.8 : status === 'caught' ? 0.18 : 0.45));
    smooth(this.filter.frequency, !this.settings.adaptive ? 12000 : active ? 7000 + alarm * 7000 : 3800, 0.5);
    smooth(this.tension.gain, this.settings.adaptive && active ? Math.max(0, alarm - 0.15) * 0.09 : 0);
  }
  private async ensureTrack() {
    const ctx = this.context, id = this.desired;
    if (!ctx || ctx.state !== 'running' || !this.enabled || this.settings.music === 0 || this.current?.id === id || this.loading === id) return;
    this.loading = id; const sequence = ++this.sequence; this.onChange();
    try {
      if (!this.buffers.has(id)) {
        const binary = atob(SOUNDTRACK[id].url.split(',')[1]);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        this.buffers.set(id, ctx.decodeAudioData(bytes.buffer));
        // Pending decodes can finish after a rapid selection or mute. Bound
        // retained promises at insertion as well as after a successful switch.
        for (const cached of this.buffers.keys()) if (this.buffers.size > 2 && cached !== id && cached !== this.current?.id) this.buffers.delete(cached);
      }
      const buffer = await this.buffers.get(id)!;
      if (sequence !== this.sequence || id !== this.desired) return;
      this.loading = null;
      if (!this.enabled || this.settings.music === 0) { this.onChange(); return; }
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0; source.connect(gain); gain.connect(this.filter);
      const now = ctx.currentTime, fade = 2;
      source.start(now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + fade);
      const old = this.current;
      if (old) {
        old.gain.gain.cancelAndHoldAtTime(now); old.gain.gain.linearRampToValueAtTime(0, now + fade);
        old.source.stop(now + fade + 0.05);
        old.source.onended = () => { old.source.disconnect(); old.gain.disconnect(); };
      }
      this.current = { id, source, gain }; this.error = '';
      // Keep at most two decoded songs rather than retaining every chapter mix.
      for (const cached of this.buffers.keys()) if (cached !== id && cached !== old?.id) this.buffers.delete(cached);
      this.onChange();
    } catch {
      if (sequence === this.sequence) { this.loading = null; this.buffers.delete(id); this.error = '配乐未能加载，可关闭再开启声音重试'; this.onChange(); }
    }
  }
  tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.04, delay = 0, endFreq?: number) {
    if (!this.context || !this.enabled || !this.focused || this.context.state !== 'running') return;
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, start);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(this.effectBus);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  play(event: GameEvent) {
    if (event === 'rewind') this.tone(700, 0.28, 'sine', 0.07, 0, 100);
    if (event === 'door') { this.tone(220, 0.1, 'triangle'); this.tone(330, 0.1, 'triangle', 0.035, 0.07); }
    if (event === 'loot' || event === 'deposit' || event === 'receipt') { this.tone(660, 0.22); this.tone(990, 0.3, 'sine', 0.05, 0.1); }
    if (event === 'lure') this.tone(950, 0.14, 'triangle', 0.04, 0, 350);
    if (event === 'tick') this.tone(440, 0.06, 'sine', 0.025);
    if (event === 'caught' || event === 'full') this.tone(160, 0.3, 'triangle', 0.06, 0, 65);
    if (event === 'start') this.tone(350, 0.18, 'sine', 0.045, 0, 600);
    if (event === 'won') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.055, i * 0.13));
  }
}
