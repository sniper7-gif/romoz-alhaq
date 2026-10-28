export type VoiceFx = "normal" | "ghost" | "military";
export interface Take {
  dataUrl: string;
  secs: number;
  bars: number[];
}
export interface VoiceSession {
  analyser: AnalyserNode;
  stop: () => Promise<Take | null>;
  cancel: () => void;
}

const GHOST_RATIO = 0.68;
const BAR_COUNT = 16;
const MIN_SECS = 0.5;
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];

// Two-tap delay-line pitch shifter: each tap's read head drifts at `ratio` of real time and is crossfaded with a Hann window.
const PITCH_WORKLET = `
class PitchShift extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.ratio = o.processorOptions.ratio;
    this.W = 2048;
    this.N = 8192;
    this.buf = new Float32Array(this.N);
    this.w = 0;
    this.d = 0;
  }
  tap(d) {
    let p = this.w - d;
    if (p < 0) p += this.N;
    const i = Math.floor(p), f = p - i;
    return this.buf[i % this.N] * (1 - f) + this.buf[(i + 1) % this.N] * f;
  }
  process(inputs, outputs) {
    const inp = inputs[0][0], out = outputs[0][0];
    if (!out) return true;
    for (let i = 0; i < out.length; i++) {
      this.buf[this.w] = inp ? inp[i] : 0;
      const d1 = this.d, d2 = (this.d + this.W / 2) % this.W;
      const g1 = 0.5 - 0.5 * Math.cos((2 * Math.PI * d1) / this.W);
      const g2 = 0.5 - 0.5 * Math.cos((2 * Math.PI * d2) / this.W);
      out[i] = this.tap(d1) * g1 + this.tap(d2) * g2;
      this.w = (this.w + 1) % this.N;
      this.d = (this.d + (1 - this.ratio)) % this.W;
    }
    return true;
  }
}
registerProcessor("pitch-shift", PitchShift);
`;

function softClip(amount: number) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Mic -> Web Audio effect chain -> MediaRecorder, so the stored clip is already scrambled. */
export async function startVoiceSession(fx: VoiceFx): Promise<VoiceSession> {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  void ctx.resume();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: fx !== "military" } });
  } catch (e) {
    void ctx.close();
    throw e;
  }
  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  try {
    const src = ctx.createMediaStreamSource(stream);
    const mix = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const dest = ctx.createMediaStreamDestination();
    mix.connect(analyser);
    analyser.connect(dest);

    const dark = ctx.createBiquadFilter();
    dark.type = "lowpass";
    dark.frequency.value = 2600;
    let shifted = false;
    if (fx === "ghost" && ctx.audioWorklet) {
      try {
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PITCH_WORKLET], { type: "text/javascript" })));
        const shift = new AudioWorkletNode(ctx, "pitch-shift", { processorOptions: { ratio: GHOST_RATIO } });
        src.connect(shift).connect(dark).connect(mix);
        shifted = true;
      } catch {
        /* no worklet support: fall back to a dark, low-passed voice */
      }
    }
    if (fx === "ghost" && !shifted) {
      const deep = ctx.createBiquadFilter();
      deep.type = "lowshelf";
      deep.frequency.value = 300;
      deep.gain.value = 12;
      src.connect(deep).connect(dark).connect(mix);
    } else if (fx === "ghost") {
      /* wired above */
    } else if (fx === "military") {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 400;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2800;
      const grit = ctx.createWaveShaper();
      grit.curve = softClip(6);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      src.connect(hp).connect(lp).connect(grit).connect(gain).connect(mix);

      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1800;
      const hiss = ctx.createGain();
      hiss.gain.value = 0.05;
      noise.connect(band).connect(hiss).connect(mix);
      noise.start();
    } else {
      src.connect(mix);
    }

    const beep = (at: number) => {
      if (fx !== "military") return;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.value = 1400;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
      osc.connect(env);
      env.connect(dest);
      env.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.12);
    };

    const mime = MIME.find((m) => MediaRecorder.isTypeSupported?.(m));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(dest.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    } catch {
      rec = new MediaRecorder(dest.stream);
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const levels: number[] = [];
    const probe = new Float32Array(analyser.fftSize);
    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(probe);
      let sum = 0;
      for (const v of probe) sum += v * v;
      levels.push(Math.sqrt(sum / probe.length));
    }, 80);

    const started = performance.now();
    rec.start(250);
    beep(ctx.currentTime + 0.02);
    let done = false;

    return {
      analyser,
      cancel() {
        if (done) return;
        done = true;
        clearInterval(meter);
        rec.ondataavailable = null;
        if (rec.state !== "inactive") rec.stop();
        release();
      },
      async stop() {
        if (done) return null;
        done = true;
        const secs = (performance.now() - started) / 1000;
        beep(ctx.currentTime + 0.02);
        await new Promise((r) => setTimeout(r, fx === "military" ? 220 : 80));
        clearInterval(meter);
        const finished = new Promise<void>((r) => (rec.onstop = () => r()));
        if (rec.state === "recording") rec.requestData();
        rec.stop();
        await finished;
        release();
        if (secs < MIN_SECS || !chunks.length) return null;

        const peak = Math.max(...levels, 0.001);
        const per = Math.max(1, Math.ceil(levels.length / BAR_COUNT));
        const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const slice = levels.slice(i * per, (i + 1) * per);
          const v = slice.length ? Math.max(...slice) / peak : 0.2;
          return Math.round(4 + v * 18);
        });
        return { dataUrl: await readAsDataUrl(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" })), secs: Math.max(1, Math.round(secs)), bars };
      },
    };
  } catch (e) {
    release();
    throw e;
  }
}
