"use client";
import { useMemo, useState } from "react";
import { useT } from "@/components/providers";
import { inputCls } from "@/components/ui/modal";
import type { Session } from "@/lib/auth";
import { AGENTS, isImageAvatar, type Agent } from "@/lib/data";
import { useProfile } from "@/lib/profile";

const STATUS_COLOR = { active: "#00ff41", standby: "#ffb020", offline: "#4f8a62" } as const;

export default function AgentsModule({ session, codename }: { session: Session; codename: string }) {
  const { t } = useT();
  const [profile] = useProfile(codename);
  const [q, setQ] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);

  const list = useMemo<(Agent & { me?: boolean })[]>(() => {
    const me: Agent & { me: boolean } = {
      codename,
      role: session.role,
      status: "active",
      deployment: session.role === "OFFICER" ? "Command Center" : "Field Unit",
      lastSeen: "now",
      me: true,
    };
    return [me, ...AGENTS.filter((a) => a.codename !== codename)];
  }, [codename, session.role]);

  const shown = list.filter((a) => a.codename.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="glow me-auto text-sm tracking-widest">{t("tabAgents")} · {t("agentsTitle")}</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={`${inputCls} max-w-56`} />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => {
          const open = openName === a.codename;
          return (
            <li key={a.codename} className="border border-line bg-panel">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenName(open ? null : a.codename)}
                className="flex w-full items-center gap-3 p-4 text-start hover:bg-accent/5"
              >
                <span className="grid size-10 place-items-center border border-accent/40 bg-black text-xl" aria-hidden>
                  {a.me ? (isImageAvatar(profile.avatar) ? <img alt="" src={profile.avatar} className="size-full object-cover" /> : profile.avatar) : a.role === "OFFICER" ? "🦅" : "🕶️"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-accent" dir="ltr">
                    {a.codename} {a.me && <em className="text-[10px] not-italic text-dim">({t("you")})</em>}
                  </span>
                  <span className="text-[10px] tracking-widest text-dim">{t(a.role === "OFFICER" ? "officer" : "soldier")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-widest" style={{ color: STATUS_COLOR[a.status] }}>
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[a.status] }} aria-hidden />
                  {t(a.status)}
                </span>
              </button>
              {open && (
                <dl className="fade-in space-y-1 border-t border-line px-4 py-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-dim">{t("deployment")}</dt>
                    <dd>{a.deployment}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-dim">{t("lastSeen")}</dt>
                    <dd dir="ltr">{a.lastSeen}</dd>
                  </div>
                  {a.me && profile.bio && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-dim">{t("bio")}</dt>
                      <dd>{profile.bio}</dd>
                    </div>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
