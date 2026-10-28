"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import Walkie from "@/components/modules/walkie";
import TelegramButton from "@/components/telegram";
import { btnCls, inputCls } from "@/components/ui/modal";
import { SEED_CHAT, nowHHMM, uid, type ChatMsg } from "@/lib/data";
import { usePersisted } from "@/lib/store";
import type { Take, VoiceFx } from "@/lib/voice";

const LEGACY_BARS = [6, 14, 9, 18, 11, 20, 8, 16, 12, 19, 7, 15, 10, 17, 9, 13];
const BURN_OPTIONS = [
  { secs: 0, label: "Off" },
  { secs: 10, label: "10s" },
  { secs: 30, label: "30s" },
  { secs: 60, label: "1m" },
] as const;
const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01ﾊﾋﾌﾍﾎ:<>=*+";
const SCRAMBLE_MS = 1400;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Deterministic per-frame glyphs so the text "melts" into Matrix characters. */
function scramble(text: string, frame: number) {
  return Array.from(text, (ch, i) => (ch === " " ? " " : GLYPHS[(i * 7 + frame * 13 + ((i * frame) % 5)) % GLYPHS.length])).join("");
}

function VoiceBubble({ msg, playing, onToggle }: { msg: ChatMsg; playing: boolean; onToggle: () => void }) {
  const { t } = useT();
  const bars = msg.bars ?? LEGACY_BARS;
  const secs = msg.secs ?? 0;
  return (
    <div className="flex items-center gap-3" dir="ltr">
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? t("pause") : t("play")}
        className="grid size-8 place-items-center rounded-full border border-accent text-accent hover:bg-accent/10"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="flex h-6 items-center gap-0.5" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: h, animationDelay: `${i * 60}ms` }}
            className={`w-0.5 origin-center bg-accent ${playing ? "wave-bar" : "opacity-60"}`}
          />
        ))}
      </div>
      <span className="text-xs text-dim">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>
      {msg.fx && msg.fx !== "normal" && <span className="text-[10px] text-warn">{msg.fx === "ghost" ? "GHOST" : "MIL"}</span>}
    </div>
  );
}

export default function CommsModule({ codename }: { codename: string }) {
  const { t } = useT();
  const [msgs, setMsgs] = usePersisted<ChatMsg[]>("chat", SEED_CHAT);
  const [draft, setDraft] = useState("");
  const [walkie, setWalkie] = useState(false);
  const [burn, setBurn] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const burnRef = useRef(burn);
  useEffect(() => {
    burnRef.current = burn;
  }, [burn]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      audio.current?.pause();
    };
  }, []);

  // A burning message starts its countdown the first time it is on screen.
  const hasBurning = msgs.some((m) => m.burn);
  useEffect(() => {
    if (!msgs.some((m) => m.burn && !m.burnAt)) return;
    const at = Date.now();
    setMsgs((p) => p.map((m) => (m.burn && !m.burnAt ? { ...m, burnAt: at } : m)));
  }, [msgs, setMsgs]);

  // One shared clock drives every countdown and deletes messages once their scramble finishes.
  useEffect(() => {
    if (!hasBurning) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setMsgs((p) => (p.some((m) => m.burn && m.burnAt && n >= m.burnAt + m.burn * 1000 + SCRAMBLE_MS) ? p.filter((m) => !(m.burn && m.burnAt && n >= m.burnAt + m.burn * 1000 + SCRAMBLE_MS)) : p));
    }, 150);
    return () => clearInterval(id);
  }, [hasBurning, setMsgs]);

  const push = useCallback(
    (m: Omit<ChatMsg, "id" | "time">) => {
      const b = burnRef.current;
      setMsgs((p) => [...p, { ...m, id: uid(), time: nowHHMM(), ...(b ? { burn: b } : {}) }].slice(-60));
    },
    [setMsgs],
  );

  function sendText(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    push({ from: codename, mine: true, kind: "text", text });
    setDraft("");
  }

  const sendVoice = useCallback(
    (take: Take, fx: VoiceFx) => {
      push({ from: codename, mine: true, kind: "voice", secs: take.secs, audio: take.dataUrl, bars: take.bars, fx });
    },
    [push, codename],
  );

  function stopAudio() {
    audio.current?.pause();
    audio.current = null;
    setPlayingId(null);
  }

  function togglePlay(m: ChatMsg) {
    if (playingId === m.id) return stopAudio();
    stopAudio();
    setPlayingId(m.id);
    if (m.audio) {
      const a = new Audio(m.audio);
      audio.current = a;
      a.onended = () => setPlayingId((cur) => (cur === m.id ? null : cur));
      a.play().catch(() => setPlayingId(null));
    } else {
      timers.current.push(setTimeout(() => setPlayingId((cur) => (cur === m.id ? null : cur)), Math.max(1, m.secs ?? 1) * 1000));
    }
  }

  return (
    <section className="flex h-[calc(100dvh-9rem)] min-h-96 flex-col border border-line bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-xs">
        <h2 className="glow tracking-widest">{t("tabComms")} · {t("encrypted")}</h2>
        <TelegramButton compact />
        <button
          type="button"
          aria-pressed={walkie}
          onClick={() => setWalkie((v) => !v)}
          className={`border px-3 py-1.5 ${walkie ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
        >
          📻 {t("walkieToggle")}
        </button>
      </div>

      {walkie && <Walkie onSend={sendVoice} />}

      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
        {msgs.map((m) => {
          const mine = m.from === codename;
          const left = m.burn && m.burnAt ? m.burnAt + m.burn * 1000 - now : null;
          const burning = left !== null && left <= 0;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] border px-3 py-2 text-sm ${burning ? "border-danger/60 bg-danger/10" : mine ? "border-accent/60 bg-accent/10" : "border-line bg-black/50"}`}>
                <div className="mb-1 flex gap-3 text-[10px] text-dim" dir="ltr">
                  <span className={mine ? "text-accent" : ""}>{m.from}</span>
                  <span>{m.time}</span>
                  {left !== null && !burning && <span className="text-warn">🔥 {mmss(left)}</span>}
                  {burning && <span className="text-danger">00:00</span>}
                </div>
                {burning ? (
                  <p className="break-all font-mono text-accent" dir="ltr" aria-hidden>
                    {scramble(m.kind === "voice" ? "░░░░░░░░░░░░░░░░" : (m.text ?? ""), Math.floor(now / 90))}
                  </p>
                ) : m.kind === "voice" ? (
                  <VoiceBubble msg={m} playing={playingId === m.id} onToggle={() => togglePlay(m)} />
                ) : (
                  <p className="break-words">{m.text}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={sendText} className="flex items-center gap-2 border-t border-line p-3">
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-dim" title={t("burnLabel")}>
          <span aria-hidden>🔥</span>
          <select
            aria-label={t("burnLabel")}
            value={burn}
            onChange={(e) => setBurn(Number(e.target.value))}
            className={`border bg-black/60 px-2 py-2 text-xs outline-none focus:border-accent ${burn ? "border-warn text-warn" : "border-line text-fg"}`}
          >
            {BURN_OPTIONS.map((o) => (
              <option key={o.secs} value={o.secs}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("typeMessage")} maxLength={500} className={inputCls} />
        <button type="submit" disabled={!draft.trim()} className={btnCls}>
          {t("send")}
        </button>
      </form>
    </section>
  );
}
