"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { keyStore } from "@/lib/crypto";

const BOOT = ["INITIALIZING...", "CONNECTING TO MAINFRAME...", "SECURE CHANNEL ESTABLISHED"];

export default function LoginPage() {
  const router = useRouter();
  const [codename, setCodename] = useState("");
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState(0);

  useEffect(() => {
    if (boot >= BOOT.length) return;
    const t = setTimeout(() => setBoot((b) => b + 1), 650);
    return () => clearTimeout(t);
  }, [boot]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codename, passcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "ACCESS DENIED");
        return;
      }
      // Shared E2EE key is always derived from the agent passcode, for both roles.
      keyStore.set("3337");
      router.replace("/");
      router.refresh();
    } catch {
      setErr("LINK FAILURE — RETRY");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "flex-1 min-w-0 bg-transparent text-accent glow tracking-widest outline-none placeholder:text-dim/60 caret-accent";

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <div className="relative w-full max-w-md border border-accent/40 bg-panel p-6 space-y-4 shadow-[0_0_30px_rgba(0,255,65,.15)]">
        <span className="hud-corner tl" /><span className="hud-corner tr" />
        <span className="hud-corner bl" /><span className="hud-corner br" />
        <div className="text-center">
          <h1 className="text-3xl text-accent glow tracking-widest">L.I.S</h1>
          <p className="text-xs text-dim tracking-[0.3em]">SYMBOLS OF TRUTH · <span dir="auto">رموز الحق</span></p>
        </div>
        <div className="text-xs text-accent/80 min-h-[3.6em] space-y-0.5">
          {BOOT.slice(0, boot).map((l) => (
            <p key={l}>&gt; {l}</p>
          ))}
          {boot < BOOT.length && <p className="caret">&gt;</p>}
        </div>
        {boot >= BOOT.length && (
          <form onSubmit={submit} className="space-y-3">
            <label className="flex items-center gap-2 border-b border-accent/40 py-1 text-sm">
              <span className="text-accent glow">$ codename:</span>
              <input className={field} value={codename} onChange={(e) => setCodename(e.target.value)}
                maxLength={24} autoComplete="off" autoFocus required placeholder="EAGLE-1" />
            </label>
            <label className="flex items-center gap-2 border-b border-accent/40 py-1 text-sm">
              <span className="text-accent glow">$ passcode:</span>
              <input className={field} type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)}
                autoComplete="off" required placeholder="••••" />
            </label>
            {err && <p className="text-danger text-xs tracking-widest">⚠ {err}</p>}
            <button disabled={busy} className="w-full border border-accent text-accent glow py-2 tracking-[0.3em] hover:bg-accent hover:text-black disabled:opacity-40">
              {busy ? "VERIFYING…" : "AUTHENTICATE"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
