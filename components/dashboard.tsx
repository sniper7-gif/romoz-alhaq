"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/logo";
import { useT } from "@/components/providers";
import AgentsModule from "@/components/modules/agents";
import BroadcastModule from "@/components/modules/broadcast";
import CommandCenterModule from "@/components/modules/command-center";
import CommsModule from "@/components/modules/comms";
import GodEyesModule from "@/components/modules/god-eyes";
import IntelModule from "@/components/modules/intel";
import MissionsModule from "@/components/modules/missions";
import SettingsModule from "@/components/modules/settings";
import type { Session } from "@/lib/auth";
import { SEED_ALERTS, type Alert } from "@/lib/data";
import type { Key } from "@/lib/i18n";
import { usePersisted } from "@/lib/store";

interface Tab {
  id: "comms" | "command" | "missions" | "intel" | "broadcast" | "agents" | "eyes" | "settings";
  label: Key;
  icon: string;
  only?: "OFFICER" | "SOLDIER";
}

const TABS: Tab[] = [
  { id: "comms", label: "tabComms", icon: "◉" },
  { id: "command", label: "tabCommand", icon: "◈", only: "OFFICER" },
  { id: "missions", label: "tabMissions", icon: "✔" },
  { id: "intel", label: "tabIntel", icon: "▤" },
  { id: "broadcast", label: "tabBroadcast", icon: "⚠" },
  { id: "agents", label: "tabAgents", icon: "☰" },
  { id: "eyes", label: "tabEyes", icon: "◎", only: "SOLDIER" },
  { id: "settings", label: "tabSettings", icon: "⚙" },
];

const NO_ACK = "";

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<Tab["id"]>("comms");
  const [drawer, setDrawer] = useState(false);
  const [alerts] = usePersisted<Alert[]>("alerts", SEED_ALERTS);
  const [ack, setAck] = usePersisted("ack", NO_ACK);

  const codename = session.codename;
  const isOfficer = session.role === "OFFICER";
  const latest = alerts[0];
  const showAlert = latest && latest.id !== ack;
  const tabs = TABS.filter((x) => !x.only || x.only === session.role);
  const active = tabs.find((x) => x.id === tab) ?? tabs[0];

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col items-center gap-2 border-b border-line pb-4">
        <Logo kind="eagle" size={84} />
        <span className="glow text-lg font-bold tracking-[0.3em]" dir="ltr">L.I.S</span>
        <div className="flex w-full items-center justify-between border border-accent/40 bg-black/60 px-3 py-1.5 text-xs" dir="ltr">
          <span className="truncate text-accent">{codename.replace(/ /g, "_")}</span>
          <span className="flex items-center gap-1.5 text-accent">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            ONLINE
          </span>
        </div>
        <span className="text-[10px] tracking-widest text-dim">{t(isOfficer ? "officer" : "soldier")}</span>
      </div>

      <nav className="flex flex-col gap-1" aria-label={t("menu")}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-current={active.id === x.id ? "page" : undefined}
            onClick={() => {
              setTab(x.id);
              setDrawer(false);
            }}
            className={`flex items-center gap-3 border px-4 py-2.5 text-start text-sm transition-colors ${
              active.id === x.id ? "border-accent bg-accent/10 text-accent" : "border-transparent text-dim hover:border-line hover:text-fg"
            }`}
          >
            <span aria-hidden className="w-5 text-center">{x.icon}</span>
            {t(x.label)}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-line pt-3">
        <div className="grid grid-cols-2 gap-1" role="group" aria-label={t("language")}>
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`border py-1.5 text-xs ${lang === l ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
            >
              {l === "en" ? "English (EN)" : "العربية"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          className="w-full border border-danger bg-danger/20 py-2.5 text-xs tracking-widest text-danger hover:bg-danger/30 disabled:opacity-40"
        >
          {leaving ? t("logoutBusy") : t("logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex min-h-dvh ${leaving ? "warp-out" : "fade-in"}`}>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-accent/30 bg-panel p-4 md:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="absolute inset-0 bg-black/70" aria-hidden />
          <aside className="fade-in absolute inset-y-0 start-0 w-72 overflow-y-auto border-e border-accent/40 bg-black p-4">
            <button type="button" onClick={() => setDrawer(false)} aria-label={t("close")} className="mb-2 px-2 text-dim hover:text-accent">
              ✕
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-accent/30 bg-panel px-3 py-2 md:hidden">
          <button type="button" onClick={() => setDrawer(true)} aria-label={t("menu")} className="border border-line px-3 py-2 text-accent">
            ☰
          </button>
          <h1 className="glow min-w-0 flex-1 truncate text-sm tracking-[0.2em]">{t(active.label)}</h1>
          <span className="text-xs text-accent" dir="ltr">{codename}</span>
        </header>

        {showAlert && (
          <div role="alert" className="flash flex items-center gap-3 border-b border-danger bg-danger/20 px-4 py-2 text-sm">
            <strong className="tracking-widest text-danger">{t("alertBanner")}</strong>
            <span className="min-w-0 flex-1 truncate">{latest.text}</span>
            <button type="button" onClick={() => setAck(latest.id)} className="border border-danger px-3 py-1 text-xs hover:bg-danger/20">
              {t("ack")}
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 p-3 sm:p-5" key={active.id}>
          <div className="fade-in mx-auto max-w-5xl">
            {active.id === "comms" && <CommsModule codename={codename} />}
            {active.id === "command" && <CommandCenterModule />}
            {active.id === "missions" && <MissionsModule codename={codename} />}
            {active.id === "intel" && <IntelModule codename={codename} isOfficer={isOfficer} />}
            {active.id === "broadcast" && <BroadcastModule codename={codename} isOfficer={isOfficer} />}
            {active.id === "agents" && <AgentsModule session={session} codename={codename} />}
            {active.id === "eyes" && <GodEyesModule />}
            {active.id === "settings" && <SettingsModule session={session} codename={codename} />}
          </div>
        </main>
      </div>
    </div>
  );
}
