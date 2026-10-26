// Synthesized walkie-talkie FX via Web Audio. No audio assets.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBurst(c: AudioContext, start: number, dur: number, gain = 0.15) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(start);
}

function beep(c: AudioContext, start: number, dur = 0.12, freq = 1000) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** Static burst + roger beep. Resolves when finished. */
export function radioCue(): Promise<void> {
  const c = unlockAudio();
  const t = c.currentTime;
  noiseBurst(c, t, 0.18);
  beep(c, t + 0.16);
  return new Promise((r) => setTimeout(r, 360));
}

export function staticBurst(): Promise<void> {
  const c = unlockAudio();
  noiseBurst(c, c.currentTime, 0.22);
  return new Promise((r) => setTimeout(r, 240));
}

export function alertSiren() {
  const c = unlockAudio();
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) beep(c, t + i * 0.3, 0.22, i % 2 ? 660 : 880);
}
