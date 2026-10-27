"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import { GHOST_NODES } from "@/lib/data";

type State = "idle" | "connecting" | "active";
interface Hop {
  node: string;
  ms: number;
}

const randomChain = (): Hop[] => {
  const pool = [...GHOST_NODES].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map((node) => ({ node, ms: 20 + Math.floor(Math.random() * 120) }));
};

/** Officer-only simulated relay chain: shows the ghost hops a session would be routed through. */
export default function GhostGatewayModule() {
  const { t } = useT();
  const [state, setState] = useState<State>("idle");
  const [chain, setChain] = useState<Hop[]>([]);
  const [shown, setShown] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function engage() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const next = randomChain();
    setChain(next);
    setShown(0);
    setState("connecting");
    next.forEach((_, i) => timers.current.push(setTimeout(() => setShown(i + 1), 500 * (i + 1))));
    timers.current.push(setTimeout(() => setState("active"), 500 * next.length + 400));
  }

  function disengage() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState("idle");
    setChain([]);
    setShown(0);
  }

  const total = chain.slice(0, shown).reduce((a, h) => a + h.ms, 0);

  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabGhost")} · {t("ghostTitle")}</h2>
      <p className="border border-line bg-panel p-4 text-sm text-dim">{t("ghostIntro")}</p>

      <div className="space-y-4 border border-accent/40 bg-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-xs tracking-widest ${state === "active" ? "text-accent" : state === "connecting" ? "text-warn" : "text-dim"}`}>
            ● {state === "active" ? t("ghostActive") : state === "connecting" ? t("ghostConnecting") : t("ghostIdle")}
          </span>
          <div className="ms-auto flex gap-2">
            {state !== "idle" && (
              <button type="button" onClick={engage} disabled={state === "connecting"} className={btnCls}>
                {t("rotate")}
              </button>
            )}
            {state === "idle" ? (
              <button type="button" onClick={engage} className={btnCls}>
                {t("ghostEngage")}
              </button>
            ) : (
              <button type="button" onClick={disengage} className={`${btnCls} border-danger text-danger hover:bg-danger/10`}>
                {t("ghostDisengage")}
              </button>
            )}
          </div>
        </div>

        <ol className="flex flex-wrap items-center gap-2" dir="ltr">
          <li className="border border-line px-3 py-2 text-xs text-dim">YOU</li>
          {chain.slice(0, shown).map((h, i) => (
            <li key={`${h.node}-${i}`} className="fade-in flex items-center gap-2">
              <span aria-hidden className="text-accent">→</span>
              <span className="border border-accent/60 bg-accent/10 px-3 py-2 text-xs">
                <span className="block text-[9px] text-dim">{t("hop")} {i + 1}</span>
                {h.node} · {h.ms}ms
              </span>
            </li>
          ))}
          {state === "active" && (
            <li className="fade-in flex items-center gap-2">
              <span aria-hidden className="text-accent">→</span>
              <span className="border border-line px-3 py-2 text-xs text-dim">NET</span>
            </li>
          )}
        </ol>
        {shown > 0 && (
          <p className="text-xs text-dim">
            {t("latency")}: <span className="text-accent">{total}ms</span>
          </p>
        )}
      </div>
    </section>
  );
}
