"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GateShell from "@/components/gate/gate-shell";
import Logo from "@/components/logo";
import { useT } from "@/components/providers";
import { wipeSensitiveData } from "@/lib/wipe";

type Phase = "idle" | "busy" | "denied" | "error" | "granted";

/** Gate 1: Eagle logo and the access code only. */
export default function AccessGate() {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || phase === "busy" || phase === "granted") return;
    setPhase("busy");
    try {
      const res = await fetch("/api/auth/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      if (res.status === 401) {
        setPhase("denied");
        setCode("");
        return;
      }
      if (!res.ok) throw new Error();
      const body = (await res.json().catch(() => null)) as { duress?: boolean } | null;
      if (body?.duress) {
        // Hard navigation, so the in-memory store cache is dropped along with localStorage.
        wipeSensitiveData();
        window.location.replace("/news");
        return;
      }
      setPhase("granted");
      setTimeout(() => {
        router.replace("/login/member");
        router.refresh();
      }, 800);
    } catch {
      setPhase("error");
    }
  }

  const message = { denied: t("denied"), error: t("netError"), granted: t("granted"), idle: "", busy: "" }[phase];

  return (
    <GateShell leaving={phase === "granted"}>
      <div className="mb-5 flex justify-center">
        <Logo kind="eagle" size={190} />
      </div>
      <h1 className="glow text-center text-3xl font-bold tracking-[0.35em]" dir="ltr">L.I.S</h1>
      <p className="mt-1 text-center text-sm tracking-widest text-accent/80">{t("gateTitle")}</p>

      <ul className="mt-5 space-y-1 text-xs text-dim" aria-hidden>
        {(["boot1", "boot2", "boot3"] as const).map((k, i) => (
          <li key={k} className="fade-in" style={{ animationDelay: `${i * 450}ms` }}>
            <span className="text-accent">{">"}</span> {t(k)}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <label className="flex items-center border bg-black/70 focus-within:border-accent has-[[aria-invalid=true]]:border-danger border-line" dir="ltr">
          <span className="px-4 text-xl text-accent" aria-hidden>$</span>
          <input
            key={phase === "denied" ? "shake" : "ok"}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 16));
              if (phase !== "busy") setPhase("idle");
            }}
            aria-label={t("accessCode")}
            aria-invalid={phase === "denied"}
            placeholder={t("gateHint")}
            className={`w-full bg-transparent py-3 pe-4 text-lg tracking-[0.3em] text-accent outline-none placeholder:text-xs placeholder:tracking-widest placeholder:text-dim/60 ${phase === "denied" ? "shake" : ""}`}
          />
        </label>
        <button
          type="submit"
          disabled={!code || phase === "busy" || phase === "granted"}
          className="w-full border border-accent bg-accent/10 py-3 text-sm tracking-[0.3em] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "busy" ? t("verifying") : t("enter")}
        </button>
        <p role="status" aria-live="polite" className={`min-h-5 text-center text-xs tracking-widest ${phase === "granted" ? "text-accent" : "text-danger"}`}>
          {message}
        </p>
      </form>
    </GateShell>
  );
}
