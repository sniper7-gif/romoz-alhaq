"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { btnCls, inputCls } from "@/components/ui/modal";
import { SEED_MISSIONS, uid, type Mission } from "@/lib/data";
import { usePersisted } from "@/lib/store";

const NEXT: Record<Mission["status"], Mission["status"]> = { todo: "doing", doing: "done", done: "todo" };
const COLOR: Record<Mission["status"], string> = { todo: "#ffb020", doing: "#00e5ff", done: "#00ff41" };

export default function MissionsModule({ codename }: { codename: string }) {
  const { t } = useT();
  const [missions, setMissions] = usePersisted<Mission[]>("missions", SEED_MISSIONS);
  const [draft, setDraft] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setMissions((p) => [{ id: uid(), title, status: "todo", owner: codename }, ...p]);
    setDraft("");
  }

  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabMissions")} · {t("missionsTitle")}</h2>

      <form onSubmit={add} className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={140} placeholder={t("missionPlaceholder")} aria-label={t("newMission")} className={inputCls} />
        <button type="submit" disabled={!draft.trim()} className={`${btnCls} shrink-0`}>
          + {t("newMission")}
        </button>
      </form>

      {missions.length === 0 && <p className="border border-line bg-panel p-6 text-center text-sm text-dim">{t("noMissions")}</p>}

      <ul className="space-y-2">
        {missions.map((m) => (
          <li key={m.id} className="fade-in flex items-center gap-3 border border-line bg-panel p-3">
            <button
              type="button"
              onClick={() => setMissions((p) => p.map((x) => (x.id === m.id ? { ...x, status: NEXT[x.status] } : x)))}
              style={{ borderColor: COLOR[m.status], color: COLOR[m.status] }}
              className="w-28 shrink-0 border px-2 py-1 text-[11px] tracking-wider hover:bg-white/5"
            >
              {t(m.status)}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${m.status === "done" ? "text-dim line-through" : ""}`}>{m.title}</p>
              <p className="text-[10px] text-dim" dir="ltr">{m.owner}</p>
            </div>
            <button type="button" aria-label={t("delete")} onClick={() => setMissions((p) => p.filter((x) => x.id !== m.id))} className="px-2 text-danger/70 hover:text-danger">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
