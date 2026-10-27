"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls, inputCls } from "@/components/ui/modal";
import { AGENTS, SEED_CHAT, nowHHMM, uid, type ChatMsg } from "@/lib/data";
import { usePersisted } from "@/lib/store";

const REPLIES = ["Copy that.", "Acknowledged. Standing by.", "Message received, over.", "Confirmed. Moving on your signal.", "Roger. Keep channel open."];
const BARS = [6, 14, 9, 18, 11, 20, 8, 16, 12, 19, 7, 15, 10, 17, 9, 13];

function VoiceBubble({ msg, playing, onToggle }: { msg: ChatMsg; playing: boolean; onToggle: () => void }) {
  const { t } = useT();
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
        {BARS.map((h, i) => (
          <span
            key={i}
            style={{ height: h, animationDelay: `${i * 60}ms` }}
            className={`w-0.5 origin-center bg-accent ${playing ? "wave-bar" : "opacity-60"}`}
          />
        ))}
      </div>
      <span className="text-xs text-dim">0:{String(msg.secs ?? 0).padStart(2, "0")}</span>
    </div>
  );
}

export default function CommsModule({ codename }: { codename: string }) {
  const { t } = useT();
  const [msgs, setMsgs] = usePersisted<ChatMsg[]>("chat", SEED_CHAT);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const secsRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  const push = (m: Omit<ChatMsg, "id" | "time">) => setMsgs((p) => [...p, { ...m, id: uid(), time: nowHHMM() }].slice(-200));

  function replyLater() {
    const others = AGENTS.filter((a) => a.status === "active" && a.codename !== codename);
    const from = others[Math.floor(Math.random() * others.length)].codename;
    const text = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    timers.current.push(setTimeout(() => push({ from, mine: false, kind: "text", text }), 1200));
  }

  function sendText(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    push({ from: codename, mine: true, kind: "text", text });
    setDraft("");
    replyLater();
  }

  function startRec() {
    if (recording) return;
    secsRef.current = 0;
    setSecs(0);
    setRecording(true);
    tick.current = setInterval(() => {
      secsRef.current = Math.min(secsRef.current + 1, 60);
      setSecs(secsRef.current);
    }, 1000);
  }

  function stopRec() {
    if (!recording) return;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    setRecording(false);
    if (secsRef.current >= 1) {
      push({ from: codename, mine: true, kind: "voice", secs: secsRef.current });
      replyLater();
    }
  }

  function togglePlay(m: ChatMsg) {
    if (playingId === m.id) return setPlayingId(null);
    setPlayingId(m.id);
    timers.current.push(setTimeout(() => setPlayingId((cur) => (cur === m.id ? null : cur)), Math.max(1, m.secs ?? 1) * 1000));
  }

  return (
    <section className="flex h-[calc(100dvh-9rem)] min-h-96 flex-col border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs">
        <h2 className="glow tracking-widest">{t("tabComms")} · {t("encrypted")}</h2>
        <span className="text-accent">● {t("online")}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] border px-3 py-2 text-sm ${m.mine ? "border-accent/60 bg-accent/10" : "border-line bg-black/50"}`}>
              <div className="mb-1 flex gap-3 text-[10px] text-dim" dir="ltr">
                <span className={m.mine ? "text-accent" : ""}>{m.from}</span>
                <span>{m.time}</span>
              </div>
              {m.kind === "voice" ? <VoiceBubble msg={m} playing={playingId === m.id} onToggle={() => togglePlay(m)} /> : <p className="break-words">{m.text}</p>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={sendText} className="flex items-center gap-2 border-t border-line p-3">
        <button
          type="button"
          onPointerDown={startRec}
          onPointerUp={stopRec}
          onPointerLeave={stopRec}
          onPointerCancel={stopRec}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && (e.preventDefault(), startRec())}
          onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stopRec()}
          onBlur={stopRec}
          aria-label={t("holdToTalk")}
          title={t("holdToTalk")}
          className={`touch-none select-none border px-3 py-2 text-xs tracking-widest ${
            recording ? "flash border-danger text-danger" : "border-accent/60 text-accent hover:bg-accent/10"
          }`}
        >
          {recording ? `● ${secs}s` : "🎙"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={recording ? t("transmitting") : t("typeMessage")}
          disabled={recording}
          maxLength={500}
          className={inputCls}
        />
        <button type="submit" disabled={!draft.trim()} className={btnCls}>
          {t("send")}
        </button>
      </form>
    </section>
  );
}
