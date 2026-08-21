/* Procedural WebAudio SFX — no assets, everything synthesized. */

export type ShotKind = "pistol" | "smg" | "shotgun" | "lmg" | "sniper" | "revolver";

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // shared noise buffer
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private get ok() {
    return !!(this.ctx && this.master);
  }

  private noise(dur: number, vol: number, fType: BiquadFilterType, f0: number, f1: number, tOff = 0) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + tOff;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = fType;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    tOff = 0,
    curve: "exp" | "lin" = "exp"
  ) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + tOff;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (curve === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    else o.frequency.linearRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot(kind: ShotKind) {
    if (kind === "pistol") {
      this.noise(0.13, 0.5, "lowpass", 3400, 320);
      this.tone("square", 190, 55, 0.09, 0.28);
      this.noise(0.03, 0.22, "highpass", 3000, 5000);
    } else if (kind === "smg") {
      this.noise(0.08, 0.4, "lowpass", 3000, 420);
      this.tone("square", 240, 80, 0.06, 0.22);
    } else if (kind === "shotgun") {
      this.noise(0.3, 0.62, "lowpass", 2200, 120);
      this.tone("sawtooth", 120, 38, 0.24, 0.4);
      this.noise(0.06, 0.3, "highpass", 2400, 4000);
    } else if (kind === "lmg") {
      this.noise(0.22, 0.55, "lowpass", 2600, 180);
      this.tone("square", 150, 48, 0.16, 0.36);
      this.noise(0.04, 0.26, "highpass", 2800, 4600);
    } else if (kind === "sniper") {
      this.noise(0.4, 0.7, "lowpass", 1900, 90);
      this.tone("sawtooth", 95, 26, 0.34, 0.5);
      this.noise(0.1, 0.34, "highpass", 2100, 3600);
      // bolt-action follow-through crack
      this.tone("square", 1600, 900, 0.05, 0.1, 0.28);
      this.noise(0.05, 0.18, "bandpass", 2600, 1800, 0.4);
    } else {
      // revolver: big-bore bark with cylinder click
      this.noise(0.18, 0.5, "lowpass", 2400, 150);
      this.tone("square", 130, 40, 0.2, 0.4);
      this.noise(0.05, 0.28, "highpass", 2600, 4200);
      this.tone("square", 2400, 1500, 0.03, 0.08, 0.16);
    }
  }

  dry() {
    this.tone("square", 1100, 700, 0.035, 0.12);
    this.tone("square", 500, 300, 0.03, 0.1, 0.05);
  }

  reload(stage: 0 | 1) {
    if (stage === 0) {
      this.noise(0.05, 0.2, "bandpass", 1800, 1400);
      this.tone("square", 320, 180, 0.05, 0.14, 0.03);
    } else {
      this.noise(0.06, 0.26, "bandpass", 2200, 1600);
      this.tone("square", 520, 260, 0.06, 0.18, 0.02);
      this.tone("square", 840, 420, 0.05, 0.1, 0.1);
    }
  }

  hit(head: boolean) {
    if (head) {
      this.tone("triangle", 1500, 2200, 0.07, 0.3);
      this.tone("triangle", 2200, 2800, 0.09, 0.22, 0.05);
    } else {
      this.tone("square", 1300, 900, 0.045, 0.18);
    }
  }

  hurt() {
    this.tone("sawtooth", 160, 55, 0.22, 0.4);
    this.noise(0.16, 0.24, "lowpass", 900, 200);
  }

  die() {
    this.tone("sawtooth", 300, 60, 0.3, 0.22);
    this.noise(0.25, 0.2, "lowpass", 1200, 160, 0.04);
  }

  tick() {
    this.tone("square", 1650, 1250, 0.02, 0.045);
  }

  lineDone() {
    this.tone("square", 520, 780, 0.06, 0.07);
  }

  slam() {
    this.tone("sawtooth", 130, 26, 0.55, 0.4);
    this.noise(0.4, 0.3, "lowpass", 1600, 90, 0.01);
    this.tone("square", 900, 2400, 0.12, 0.08, 0.02, "lin");
  }

  thump() {
    this.tone("sine", 110, 36, 0.14, 0.5);
    this.noise(0.08, 0.22, "lowpass", 480, 110, 0.01);
  }

  slide() {
    this.noise(0.34, 0.2, "bandpass", 500, 1600);
  }

  jump() {
    this.tone("sine", 200, 330, 0.1, 0.1);
  }

  land() {
    this.noise(0.09, 0.2, "lowpass", 700, 160);
  }

  step() {
    this.noise(0.05, 0.07, "lowpass", 600, 180);
  }

  wave() {
    this.tone("sawtooth", 90, 90, 0.5, 0.3);
    this.tone("sawtooth", 135, 135, 0.5, 0.22, 0.02);
    this.tone("sawtooth", 90, 70, 0.7, 0.3, 0.55);
    this.noise(0.8, 0.12, "lowpass", 400, 90, 0.05);
  }

  waveClear() {
    this.tone("triangle", 440, 440, 0.12, 0.22);
    this.tone("triangle", 587, 587, 0.12, 0.22, 0.11);
    this.tone("triangle", 880, 880, 0.24, 0.22, 0.22);
  }

  perk() {
    this.tone("square", 520, 520, 0.06, 0.16);
    this.tone("square", 780, 780, 0.06, 0.16, 0.06);
    this.tone("square", 1040, 1040, 0.12, 0.16, 0.12);
    this.tone("triangle", 1560, 1560, 0.2, 0.1, 0.18);
  }

  pickup() {
    this.tone("square", 700, 1050, 0.06, 0.14);
    this.tone("square", 1050, 1500, 0.09, 0.12, 0.06);
  }

  focus(on: boolean) {
    if (on) {
      this.tone("sine", 900, 220, 0.35, 0.16, 0, "lin");
      this.noise(0.4, 0.1, "lowpass", 2400, 240);
    } else {
      this.tone("sine", 240, 760, 0.25, 0.12, 0, "lin");
    }
  }

  over() {
    this.tone("sawtooth", 220, 55, 1.1, 0.3, 0, "lin");
    this.tone("sawtooth", 165, 41, 1.3, 0.24, 0.08, "lin");
    this.noise(1.2, 0.2, "lowpass", 800, 60);
  }

  /** 0..1 — scales the wind/sea bed. */
  setWind(v: number) {
    if (!this.ok || !this.windGain || !this.ctx) return;
    this.windGain.gain.setTargetAtTime(0.06 + v * 0.22, this.ctx.currentTime, 0.8);
  }

  /** 0..1 — rain intensity. */
  setRain(v: number) {
    if (!this.ok || !this.rainGain || !this.ctx) return;
    this.rainGain.gain.setTargetAtTime(v * v * 0.24, this.ctx.currentTime, 0.6);
  }

  /** Distant thunder rumble. vol 0..1 */
  thunder(vol: number, delay = 0) {
    if (!this.ok) return;
    const v = Math.max(0.05, vol);
    this.tone("sine", 70, 28, 1.6 * v + 0.6, 0.5 * v, delay, "exp");
    this.tone("sine", 110, 36, 1.2, 0.3 * v, delay + 0.12, "exp");
    this.noise(1.4 * v + 0.5, 0.28 * v, "lowpass", 260, 40, delay);
    this.noise(0.9, 0.12 * v, "lowpass", 900, 120, delay + 0.35);
  }

  ambientStart() {
    if (!this.ok || this.ambientGain) return;
    const c = this.ctx!;
    this.ambientGain = c.createGain();
    this.ambientGain.gain.value = 0.5;
    this.ambientGain.connect(this.master!);
    // wind / sea hiss
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.1;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.06;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambientGain);
    src.start();
    lfo.start();
    this.windGain = g;
    // rain bed (silent until weather calls setRain)
    const rsrc = c.createBufferSource();
    rsrc.buffer = this.noiseBuf;
    rsrc.loop = true;
    const rf = c.createBiquadFilter();
    rf.type = "bandpass";
    rf.frequency.value = 2400;
    rf.Q.value = 0.5;
    const rg = c.createGain();
    rg.gain.value = 0;
    rsrc.connect(rf).connect(rg).connect(this.ambientGain);
    rsrc.start();
    this.rainGain = rg;
    this.ambientNodes.push(rsrc);
    // rig hum
    const hum = c.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 46;
    const hf = c.createBiquadFilter();
    hf.type = "lowpass";
    hf.frequency.value = 140;
    const hg = c.createGain();
    hg.gain.value = 0.035;
    hum.connect(hf).connect(hg).connect(this.ambientGain);
    hum.start();
    this.ambientNodes.push(src, lfo, hum);
  }

  boom() {
    this.tone("sine", 120, 26, 0.9, 0.85);
    this.tone("square", 70, 22, 0.5, 0.3);
    this.noise(1.15, 0.7, "lowpass", 900, 55);
    this.noise(0.22, 0.35, "highpass", 2600, 500);
  }

  private heliNodes: AudioNode[] = [];
  private heliGain: GainNode | null = null;

  heliStart() {
    if (!this.ok || this.heliGain) return;
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 1.6);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 320;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 52;
    const o2 = c.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = 55.5;
    // rotor throb
    const lfo = c.createOscillator();
    lfo.frequency.value = 13.5;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.master!);
    o1.start();
    o2.start();
    lfo.start();
    this.heliNodes = [o1, o2, lfo];
    this.heliGain = g;
  }

  heliStop() {
    if (!this.ok || !this.heliGain) return;
    const c = this.ctx!;
    this.heliGain.gain.cancelScheduledValues(c.currentTime);
    this.heliGain.gain.setValueAtTime(Math.max(0.0002, this.heliGain.gain.value), c.currentTime);
    this.heliGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.4);
    const nodes = this.heliNodes;
    setTimeout(() => nodes.forEach((n) => (n as OscillatorNode).stop?.()), 1600);
    this.heliNodes = [];
    this.heliGain = null;
  }

  dispose() {
    this.heliStop();
    this.ambientNodes.forEach((n) => {
      try {
        (n as any).stop?.();
      } catch {}
    });
    this.ambientNodes = [];
    this.ambientGain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
    }
  }
}
