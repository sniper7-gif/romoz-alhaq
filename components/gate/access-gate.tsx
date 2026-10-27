"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GateShell from "@/components/gate/gate-shell";
import Logo from "@/components/logo";
import { useT } from "@/components/providers";

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
        <Logo kind="eagle" size={150} />
      </div>
      <h1 className="glow text-center text-xl tracking-[0.2em]">{t("appName")}</h1>
      <p className="mt-1 text-center text-[11px] tracking-widest text-dim">{t("gateTitle")}</p>

      <div className="mt-5 space-y-0.5 text-[11px] text-dim" dir="ltr" aria-hidden>
        <p>{t("boot1")}</p>
        <p>{t("boot2")}</p>
        <p className="caret text-accent">{t("boot3")}</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <label className="block">
          <span className="mb-1 block text-[11px] tracking-widest text-dim">{t("gateHint")}</span>
          <input
            key={phase === "denied" ? "shake" : "ok"}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            dir="ltr"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 16));
              if (phase !== "busy") setPhase("idle");
            }}
            aria-label={t("accessCode")}
            aria-invalid={phase === "denied"}
            placeholder="••••"
            className={`w-full border bg-black/70 px-4 py-3 text-center text-2xl tracking-[0.5em] text-accent outline-none focus:border-accent ${
              phase === "denied" ? "shake border-danger" : "border-line"
            }`}
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
