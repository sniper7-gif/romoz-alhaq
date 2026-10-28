"use client";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { type DisguiseId, iconUrl, manifestUrl, PROFILES, svgIconUrl } from "@/lib/disguise";
import { usePersisted } from "@/lib/store";

const EXIT_CODE = "3337=";
const RADIO_TAPS = 5;
const HOME_TITLE = "رموز الحق | Symbols of Truth";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallResult = "accepted" | "dismissed" | "ios" | "installed" | "manual";

interface Stealth {
  disguise: DisguiseId;
  setDisguise: (d: DisguiseId) => void;
  decoy: boolean;
  setDecoy: (v: boolean) => void;
  install: () => Promise<InstallResult>;
}

const Ctx = createContext<Stealth | null>(null);

export const useStealth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStealth must be used inside StealthProvider");
  return v;
};

/** Reuse the tag Next rendered when there is one so nothing duplicates; otherwise create it. */
function setTag(tag: "link" | "meta", selector: string, attrs: Record<string, string>) {
  const found = document.head.querySelectorAll<HTMLElement>(selector);
  const els = found.length ? Array.from(found) : [document.head.appendChild(document.createElement(tag))];
  for (const el of els) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function applyDisguise(id: DisguiseId, lang: "ar" | "en") {
  document.title = id === "default" ? HOME_TITLE : PROFILES[id].name[lang];
  setTag("link", 'link[rel~="icon"]', { rel: "icon", href: svgIconUrl(id), type: id === "default" ? "image/png" : "image/svg+xml" });
  setTag("link", 'link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: iconUrl(id, 180) });
  setTag("link", 'link[rel="manifest"]', { rel: "manifest", href: manifestUrl(id, lang) });
  setTag("meta", 'meta[name="theme-color"]', { name: "theme-color", content: PROFILES[id].theme });
}

export function StealthProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useT();
  const pathname = usePathname();
  const [disguise, setDisguise] = usePersisted<DisguiseId>("disguise", "default");
  const [decoy, setDecoy] = useState(false);
  const prompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Re-apply on route change too: Next rewrites <title> when navigating.
  useEffect(() => {
    // The duress decoy page must look like a plain weather/news site, whatever disguise is chosen.
    const shown = pathname === "/news" ? "weather" : disguise;
    applyDisguise(shown, lang);
    const raf = requestAnimationFrame(() => applyDisguise(shown, lang));
    return () => cancelAnimationFrame(raf);
  }, [disguise, lang, pathname]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      prompt.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => (prompt.current = null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Panic key: Esc twice within 500 ms. Leaving the decoy needs the secret code.
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - last < 500) setDecoy(true);
      last = now;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const install = useCallback(async (): Promise<InstallResult> => {
    const p = prompt.current;
    if (p) {
      prompt.current = null;
      await p.prompt();
      return (await p.userChoice).outcome;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return "installed";
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "ios" : "manual";
  }, []);

  const value = useMemo(() => ({ disguise, setDisguise, decoy, setDecoy, install }), [disguise, setDisguise, decoy, install]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {decoy && <Decoy kind={disguise === "radio" ? "radio" : "calculator"} onExit={() => setDecoy(false)} />}
    </Ctx.Provider>
  );
}

const OPS = ["÷", "×", "−", "+"];
const KEYS = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];

function calc(a: number, op: string, b: number) {
  return op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;
}

function CalculatorDecoy({ onExit }: { onExit: () => void }) {
  const [shown, setShown] = useState("0");
  const acc = useRef<{ a: number | null; op: string | null; fresh: boolean }>({ a: null, op: null, fresh: true });
  const seq = useRef("");
  const fmt = (n: number) => (Number.isFinite(n) ? String(+n.toPrecision(12)) : "Error");

  function press(k: string) {
    seq.current = (seq.current + k).slice(-EXIT_CODE.length);
    if (k === "=" && seq.current === EXIT_CODE) return onExit();
    const s = acc.current;
    if (/\d/.test(k) || k === ".") {
      const base = s.fresh || shown === "Error" ? "0" : shown;
      if (k === "." && base.includes(".")) return;
      setShown(base === "0" && k !== "." ? k : (base + k).slice(0, 12));
      s.fresh = false;
    } else if (k === "C") {
      acc.current = { a: null, op: null, fresh: true };
      setShown("0");
    } else if (k === "±") setShown(fmt(-Number(shown)));
    else if (k === "%") setShown(fmt(Number(shown) / 100));
    else {
      const cur = Number(shown);
      const result = s.a !== null && s.op && !s.fresh ? calc(s.a, s.op, cur) : cur;
      setShown(fmt(result));
      acc.current = { a: result, op: k === "=" ? null : k, fresh: true };
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-end gap-3 p-4" dir="ltr">
      <output className="truncate px-2 text-end text-6xl font-light text-white">{shown}</output>
      <div className="grid grid-cols-4 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`h-16 rounded-full text-2xl ${k === "0" ? "col-span-2 ps-7 text-start" : ""} ${
              OPS.includes(k) || k === "=" ? "bg-orange-500 text-white" : "C±%".includes(k) ? "bg-neutral-400 text-black" : "bg-neutral-700 text-white"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

const PRESETS = [88.2, 91.5, 95.0, 98.7, 102.4, 105.9];

function RadioDecoy({ onExit }: { onExit: () => void }) {
  const [freq, setFreq] = useState(95.0);
  const [on, setOn] = useState(false);
  const taps = useRef({ n: 0, at: 0 });
  const step = (d: number) => setFreq((f) => Math.min(108, Math.max(87.5, Math.round((f + d) * 10) / 10)));

  function tapLogo() {
    const now = Date.now();
    const t = taps.current;
    t.n = now - t.at < 1500 ? t.n + 1 : 1;
    t.at = now;
    if (t.n >= RADIO_TAPS) onExit();
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-6 p-6" dir="ltr">
      <button type="button" onClick={tapLogo} className="text-2xl font-bold tracking-widest text-amber-400">
        FM RADIO
      </button>
      <div className="w-full rounded-lg bg-amber-100 p-4 text-center text-5xl tabular-nums text-amber-950">
        {freq.toFixed(1)} <span className="text-lg">MHz</span>
      </div>
      <input type="range" min={87.5} max={108} step={0.1} value={freq} onChange={(e) => setFreq(Number(e.target.value))} aria-label="Tuner" className="w-full accent-amber-400" />
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => step(-0.1)} aria-label="Tune down" className="size-14 rounded-full bg-neutral-700 text-2xl text-white">◀</button>
        <button type="button" onClick={() => setOn((v) => !v)} className="size-20 rounded-full bg-amber-500 text-3xl text-black">{on ? "❚❚" : "▶"}</button>
        <button type="button" onClick={() => step(0.1)} aria-label="Tune up" className="size-14 rounded-full bg-neutral-700 text-2xl text-white">▶</button>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setFreq(p)} className="rounded bg-neutral-800 py-2 text-sm text-amber-200">
            {p.toFixed(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Decoy({ kind, onExit }: { kind: "calculator" | "radio"; onExit: () => void }) {
  const { lang } = useT();
  return (
    <div role="application" aria-label={PROFILES[kind].name[lang]} className="fixed inset-0 z-[9999] bg-black text-white">
      {kind === "radio" ? <RadioDecoy onExit={onExit} /> : <CalculatorDecoy onExit={onExit} />}
    </div>
  );
}
