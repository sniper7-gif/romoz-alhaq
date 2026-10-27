"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/logo";
import { useT } from "@/components/providers";
import AgentsModule from "@/components/modules/agents";
import BroadcastModule from "@/components/modules/broadcast";
import CommsModule from "@/components/modules/comms";
import GhostGatewayModule from "@/components/modules/ghost-gateway";
import GodEyesModule from "@/components/modules/god-eyes";
import IntelModule from "@/components/modules/intel";
import MissionsModule from "@/components/modules/missions";
import SettingsModule from "@/components/modules/settings";
import type { Session } from "@/lib/auth";
import { SEED_ALERTS, type Alert } from "@/lib/data";
import type { Key } from "@/lib/i18n";
import { usePersisted } from "@/lib/store";

const TABS = [
  { id: "comms", label: "tabComms", icon: "◉" },
  { id: "missions", label: "tabMissions", icon: "✔" },
  { id: "intel", label: "tabIntel", icon: "▤" },
  { id: "broadcast", label: "tabBroadcast", icon: "◈" },
  { id: "agents", label: "tabAgents", icon: "☰" },
  { id: "eyes", label: "tabEyes", icon: "◎" },
  { id: "ghost", label: "tabGhost", icon: "☠", officerOnly: true },
  { id: "settings", label: "tabSettings", icon: "⚙" },
] as const satisfies readonly { id: string; label: Key; icon: string; officerOnly?: boolean }[];
type TabId = (typeof TABS)[number]["id"];

const INITIAL_ACK = "";

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<TabId>("comms");
  const [drawer, setDrawer] = useState(false);
  const [alerts] = usePersisted<Alert[]>("alerts", SEED_ALERTS);
  const [ack, setAck] = usePersisted("ack", INITIAL_ACK);

  const codename = session.codename;
  const isOfficer = session.role === "OFFICER";
  const roleLabel = t(isOfficer ? "officer" : "soldier");
  const latest = alerts[0];
  const showAlert = latest && latest.id !== ack;
  const current = TABS.find((x) => x.id === tab)!;
  const tabs = TABS.filter((x) => !("officerOnly" in x) || isOfficer);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const nav = (
    <div className="flex h-full flex-col">
    <nav className="flex flex-col gap-1" aria-label={t("menu")}>
      {tabs.map((x) => (
        <button
          key={x.id}
          type="button"
          aria-current={tab === x.id ? "page" : undefined}
          onClick={() => {
            setTab(x.id);
            setDrawer(false);
          }}
          className={`flex items-center gap-3 border px-4 py-3 text-start text-sm tracking-wider transition-colors ${
            tab === x.id ? "border-accent bg-accent/10 text-accent" : "border-transparent text-dim hover:border-line hover:text-fg"
          }`}
        >
          <span aria-hidden className="w-5 text-center">{x.icon}</span>
          {t(x.label)}
        </button>
      ))}
    </nav>
    <div className="mt-auto space-y-2 border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="flex w-full items-center justify-between border border-line px-4 py-2 text-xs text-dim hover:border-accent hover:text-accent"
      >
        <span>{t("language")}</span>
        <span className="text-accent">{lang === "ar" ? "EN" : "عربي"}</span>
      </button>
      <button
        type="button"
        onClick={logout}
        disabled={leaving}
        className="w-full border border-danger/60 px-4 py-2 text-xs tracking-widest text-danger hover:bg-danger/10 disabled:opacity-40"
      >
        {leaving ? t("logoutBusy") : t("logout")}
      </button>
    </div>
    </div>
  );

  return (
    <div className={`flex min-h-dvh flex-col ${leaving ? "warp-out" : "fade-in"}`}>
      <header className="flex items-center gap-3 border-b border-accent/30 bg-panel px-3 py-2 sm:px-5">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label={t("menu")}
          className="border border-line px-3 py-2 text-accent md:hidden"
        >
          ☰
        </button>
        <div className="flex items-center gap-3" dir="ltr">
          <Logo kind="hood" size={36} />
          <Logo kind="eagle" size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="glow truncate text-sm tracking-[0.2em] sm:text-base">{t("appName")}</h1>
          <p className="hidden truncate text-[10px] tracking-widest text-dim sm:block">{t("appSub")}</p>
        </div>
        <div className="flex items-center gap-2 border border-accent/40 bg-black/50 px-3 py-1.5 text-xs" dir="ltr">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
          <span className="text-accent">{codename}</span>
          <span className="text-dim">[{roleLabel}]</span>
        </div>
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

      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-0 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-e border-line bg-panel p-3 md:block">{nav}</aside>

        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
            <div className="absolute inset-0 bg-black/70" aria-hidden />
            <aside className="fade-in absolute inset-y-0 start-0 flex w-64 flex-col border-e border-accent/40 bg-black p-3">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="glow text-sm tracking-widest">{t("menu")}</span>
                <button type="button" onClick={() => setDrawer(false)} aria-label={t("close")} className="px-2 text-dim hover:text-accent">
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1">{nav}</div>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-3 sm:p-5" key={current.id}>
          <div className="fade-in mx-auto max-w-5xl">
            {tab === "comms" && <CommsModule codename={codename} />}
            {tab === "missions" && <MissionsModule codename={codename} />}
            {tab === "eyes" && <GodEyesModule />}
            {tab === "ghost" && isOfficer && <GhostGatewayModule />}
            {tab === "intel" && <IntelModule codename={codename} isOfficer={isOfficer} />}
            {tab === "broadcast" && <BroadcastModule codename={codename} isOfficer={isOfficer} />}
            {tab === "agents" && <AgentsModule session={session} codename={codename} />}
            {tab === "settings" && <SettingsModule session={session} codename={codename} />}
          </div>
        </main>
      </div>
    </div>
  );
}
