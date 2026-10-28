"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import type { Key } from "@/lib/i18n";
import { startVoiceSession, type Take, type VoiceFx, type VoiceSession } from "@/lib/voice";

const MAX_SECS = 30;
const FILTERS: { id: VoiceFx; label: Key }[] = [
  { id: "normal", label: "fxNormal" },
  { id: "ghost", label: "fxGhost" },
  { id: "military", label: "fxMilitary" },
];

const GREEN = "#00ff41";
const ORANGE = "#ffb020";
const RED = "#ff3b3b";

function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    let raf = 0;
    const draw = (ms: number) => {
      const { width: w, height: h } = c;
      g.clearRect(0, 0, w, h);
      let peak = 0;
      const y = (x: number) => {
        if (analyser && data && active) return ((data[Math.floor((x / w) * data.length)] - 128) / 128) * (h / 2);
        const p = ms / 400;
        return Math.sin(x / 22 + p) * 5 + Math.sin(x / 9 - p * 1.7) * 2;
      };
      if (analyser && data && active) {
        analyser.getByteTimeDomainData(data);
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      }
      g.lineWidth = 2;
      g.strokeStyle = !active ? GREEN : peak > 0.55 ? RED : ORANGE;
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = 8;
      g.beginPath();
      for (let x = 0; x <= w; x += 3) g[x ? "lineTo" : "moveTo"](x, h / 2 + y(x));
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, active]);

  return <canvas ref={canvas} width={600} height={72} aria-hidden className="h-[72px] w-full border border-line bg-black/70" />;
}

export default function Walkie({ onSend }: { onSend: (take: Take, fx: VoiceFx) => void }) {
  const { t } = useT();
  const [fx, setFx] = useState<VoiceFx>("normal");
  const [tx, setTx] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [err, setErr] = useState("");
  const session = useRef<VoiceSession | null>(null);
  const holding = useRef(false);
  const fxRef = useRef(fx);
  const onSendRef = useRef(onSend);
  const errRef = useRef("");
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs keep press/release identity stable, so a re-render mid-hold can't tear down the live recording.
  useEffect(() => {
    fxRef.current = fx;
    onSendRef.current = onSend;
    errRef.current = t("micDenied");
  });

  const release = useCallback(async () => {
    holding.current = false;
    const s = session.current;
    session.current = null;
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
    setTx(false);
    setAnalyser(null);
    if (!s) return;
    const take = await s.stop().catch(() => null);
    if (take) onSendRef.current(take, fxRef.current);
  }, []);

  const press = useCallback(async () => {
    if (holding.current) return;
    holding.current = true;
    setErr("");
    try {
      const s = await startVoiceSession(fxRef.current);
      if (!holding.current) return s.cancel();
      session.current = s;
      setAnalyser(s.analyser);
      setTx(true);
      setElapsed(0);
      const t0 = Date.now();
      clock.current = setInterval(() => {
        const secs = (Date.now() - t0) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SECS) void release();
      }, 200);
    } catch {
      holding.current = false;
      setErr(errRef.current);
    }
  }, [release]);

  // Spacebar = push-to-talk, unless the user is typing.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e)) return;
      e.preventDefault();
      if (!e.repeat) void press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e)) return;
      e.preventDefault();
      void release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      holding.current = false;
      session.current?.cancel();
      session.current = null;
      if (clock.current) clearInterval(clock.current);
    };
  }, [press, release]);

  return (
    <div className="space-y-3 border-b border-line bg-black/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs tracking-widest">
        <span className="text-accent" dir="auto">{t("secureFreq")}</span>
        <span role="status" className={tx ? "flash font-bold text-danger" : "text-accent"} dir="auto">
          {tx ? `${t("txLive")} ${elapsed.toFixed(0)}s` : "STANDBY"}
        </span>
      </div>

      <Waveform analyser={analyser} active={tx} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex" role="group" aria-label={t("scrambler")}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={fx === f.id}
              disabled={tx}
              onClick={() => setFx(f.id)}
              className={`border px-3 py-1.5 text-[11px] ${fx === f.id ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            void press();
          }}
          onPointerUp={() => void release()}
          onPointerCancel={() => void release()}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={t("holdToTalk")}
          title={t("holdToTalk")}
          className={`grid size-20 touch-none select-none place-items-center rounded-full border-2 text-sm font-bold tracking-widest ${
            tx ? "flash border-danger bg-danger/20 text-danger" : "border-accent text-accent hover:bg-accent/10"
          }`}
        >
          🎙 PTT
        </button>
      </div>

      <p className="text-[11px] text-dim">{t("pttHint")}</p>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
    </div>
  );
}
