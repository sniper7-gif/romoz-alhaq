"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GateShell from "@/components/gate/gate-shell";
import Logo from "@/components/logo";
import { useT } from "@/components/providers";
import { hasAccount, register, verify } from "@/lib/accounts";
import type { Key } from "@/lib/i18n";

type Mode = "login" | "register";

/** Gate 2: hacker logo, then codename + password (sign in or register). */
export default function MemberGate() {
  const { t } = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [codename, setCodename] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Key | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || leaving) return;
    const name = codename.trim().toUpperCase();
    if (!/^[A-Z0-9_\- ]{2,24}$/.test(name)) return setError("badCodename");
    if (password.length < 6) return setError("shortPassword");
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        if (hasAccount(name)) return setError("codenameTaken");
        await register(name, password);
      } else if (!(await verify(name, password))) {
        return setError("badCredentials");
      }
      const res = await fetch("/api/auth/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codename: name }),
      });
      if (res.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error();
      setLeaving(true);
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 800);
    } catch {
      setError("netError");
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <GateShell leaving={leaving}>
      <div className="mb-5 flex justify-center">
        <Logo kind="hood" size={150} />
      </div>
      <h1 className="glow text-center text-xl tracking-[0.2em]">{t("appName")}</h1>
      <p className="mt-1 text-center text-[11px] tracking-widest text-dim">{t("memberGate")}</p>

      <div className="mt-5 grid grid-cols-2 border border-line" role="tablist">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`py-2 text-xs tracking-widest ${mode === m ? "bg-accent/15 text-accent" : "text-dim hover:text-fg"}`}
          >
            {t(m === "login" ? "signIn" : "register")}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <label className="block text-[11px] tracking-widest text-dim">
          {t("codename")}
          <input
            value={codename}
            onChange={(e) => setCodename(e.target.value)}
            autoComplete="username"
            autoFocus
            dir="ltr"
            maxLength={24}
            className="mt-1 w-full border border-line bg-black/70 px-3 py-2.5 text-base uppercase text-accent outline-none focus:border-accent"
          />
        </label>
        <label className="block text-[11px] tracking-widest text-dim">
          {t("password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            dir="ltr"
            className="mt-1 w-full border border-line bg-black/70 px-3 py-2.5 text-base text-accent outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={busy || leaving}
          className="w-full border border-accent bg-accent/10 py-3 text-sm tracking-[0.3em] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? t("verifying") : t(mode === "login" ? "signIn" : "register")}
        </button>
        <p role="alert" className="min-h-5 text-center text-xs tracking-widest text-danger">
          {error && t(error)}
        </p>
      </form>

      <button type="button" onClick={back} className="mx-auto mt-2 block text-[11px] tracking-widest text-dim hover:text-accent">
        ← {t("backToGate")}
      </button>
    </GateShell>
  );
}
