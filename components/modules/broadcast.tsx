"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { btnCls, inputCls } from "@/components/ui/modal";
import { SEED_ALERTS, nowHHMM, uid, type Alert } from "@/lib/data";
import { usePersisted } from "@/lib/store";

export default function BroadcastModule({ codename, isOfficer }: { codename: string; isOfficer: boolean }) {
  const { t } = useT();
  const [alerts, setAlerts] = usePersisted<Alert[]>("alerts", SEED_ALERTS);
  const [text, setText] = useState("");

  function transmit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setAlerts((p) => [{ id: uid(), text: v, from: codename, time: nowHHMM() }, ...p].slice(0, 50));
    setText("");
  }

  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabBroadcast")} · {t("broadcastTitle")}</h2>

      {isOfficer ? (
        <form onSubmit={transmit} className="space-y-3 border border-danger/50 bg-panel p-4">
          <label className="block text-xs text-dim" htmlFor="alert-text">
            {t("broadcastCompose")}
          </label>
          <textarea
            id="alert-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder={t("broadcastPlaceholder")}
            className={`${inputCls} resize-none`}
          />
          <button type="submit" disabled={!text.trim()} className={`${btnCls} border-danger text-danger hover:bg-danger/10`}>
            {t("broadcastSend")}
          </button>
        </form>
      ) : (
        <p className="border border-line bg-panel p-4 text-sm text-dim">{t("broadcastOfficerOnly")}</p>
      )}

      <div className="border border-line bg-panel p-4">
        <h3 className="mb-3 text-[11px] tracking-widest text-dim">{t("broadcastHistory")}</h3>
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="fade-in border-s-2 border-danger bg-black/40 px-3 py-2 text-sm">
              <div className="text-[10px] text-dim" dir="ltr">
                {a.from} · {a.time}
              </div>
              {a.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
