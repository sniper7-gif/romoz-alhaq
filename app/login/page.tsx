"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { keyStore } from "@/lib/crypto";

export default function LoginPage() {
  const router = useRouter();
  const [codename, setCodename] = useState("");
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codename, passcode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "ACCESS DENIED");
      setBusy(false);
      return;
    }
    // Shared E2EE key is always derived from the member passcode, for both roles.
    keyStore.set("3337");
    router.replace("/");
    router.refresh();
  }

  const field =
    "w-full bg-black/60 border border-line px-3 py-2 text-accent tracking-widest outline-none focus:border-accent placeholder:text-dim/60";

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="relative w-full max-w-sm border border-line bg-panel/90 p-6 space-y-4">
        <span className="hud-corner tl" /><span className="hud-corner tr" />
        <span className="hud-corner bl" /><span className="hud-corner br" />
        <div className="text-center space-y-1">
          <h1 className="text-2xl text-accent" dir="auto">رموز الحق</h1>
          <p className="text-xs text-dim tracking-[0.3em]">SYMBOLS OF TRUTH</p>
          <p className="text-[10px] text-dim">E2EE SECURE CHANNEL // AES-256-GCM</p>
        </div>
        <label className="block text-xs text-dim">CODENAME
          <input className={field} value={codename} onChange={(e) => setCodename(e.target.value)}
            maxLength={24} autoComplete="off" required placeholder="EAGLE-1" />
        </label>
        <label className="block text-xs text-dim">PASSCODE
          <input className={field} type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)}
            autoComplete="off" required placeholder="••••" />
        </label>
        {err && <p className="text-danger text-xs tracking-widest">⚠ {err}</p>}
        <button disabled={busy} className="w-full border border-accent text-accent py-2 tracking-[0.3em] hover:bg-accent hover:text-black disabled:opacity-40">
          {busy ? "VERIFYING…" : "AUTHENTICATE"}
        </button>
      </form>
    </main>
  );
}
