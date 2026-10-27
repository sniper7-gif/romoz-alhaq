"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import Modal, { btnCls, inputCls } from "@/components/ui/modal";
import { SEED_REPORTS, SEVERITIES, SEVERITY_COLOR, nowHHMM, uid, type Report, type Severity } from "@/lib/data";
import type { Key } from "@/lib/i18n";
import { usePersisted } from "@/lib/store";

type Filter = "all" | Report["type"];

function ReportModal({ codename, onClose }: { codename: string; onClose: () => void }) {
  const { t } = useT();
  const [, setReports] = usePersisted<Report[]>("reports", SEED_REPORTS);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<Report["type"]>("anomaly");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [touched, setTouched] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!title.trim() || !body.trim()) return;
    setReports((p) => [{ id: uid(), title: title.trim(), body: body.trim(), type, severity, author: codename, time: nowHHMM() }, ...p]);
    onClose();
  }

  return (
    <Modal title={t("newReport")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block text-xs text-dim">
          {t("reportTitle")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${inputCls} mt-1`} />
          {touched && !title.trim() && <span className="text-danger">{t("required")}</span>}
        </label>
        <label className="block text-xs text-dim">
          {t("reportBody")}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} className={`${inputCls} mt-1 resize-none`} />
          {touched && !body.trim() && <span className="text-danger">{t("required")}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-dim">
            {t("reportType")}
            <select value={type} onChange={(e) => setType(e.target.value as Report["type"])} className={`${inputCls} mt-1`}>
              <option value="anomaly">{t("anomaly")}</option>
              <option value="news">{t("news")}</option>
            </select>
          </label>
          <label className="block text-xs text-dim">
            {t("reportSeverity")}
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={`${inputCls} mt-1`}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-dim hover:text-fg">
            {t("cancel")}
          </button>
          <button type="submit" className={btnCls}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function IntelModule({ codename, isOfficer }: { codename: string; isOfficer: boolean }) {
  const { t } = useT();
  const [reports, setReports] = usePersisted<Report[]>("reports", SEED_REPORTS);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const shown = reports.filter((r) => filter === "all" || r.type === filter);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="glow me-auto text-sm tracking-widest">{t("tabIntel")} · {t("intelTitle")}</h2>
        {(["all", "anomaly", "news"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`border px-3 py-1 text-xs ${filter === f ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            {t(f as Key)}
          </button>
        ))}
        <button type="button" onClick={() => setOpen(true)} className={btnCls}>
          + {t("newReport")}
        </button>
      </div>

      {shown.length === 0 && <p className="border border-line bg-panel p-6 text-center text-sm text-dim">{t("noReports")}</p>}

      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="fade-in border border-line bg-panel p-4" style={{ borderInlineStartColor: SEVERITY_COLOR[r.severity], borderInlineStartWidth: 3 }}>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] tracking-widest">
              <span className="border border-danger/60 px-1.5 text-danger">{t("topSecret")}</span>
              <span className="text-dim">{t(r.type)}</span>
              <span style={{ color: SEVERITY_COLOR[r.severity] }}>{t(r.severity).toUpperCase()}</span>
              <span className="ms-auto text-dim" dir="ltr">
                {r.author} · {r.time}
              </span>
            </div>
            <h3 className="text-sm font-bold">{r.title}</h3>
            <p className="mt-1 text-sm text-fg/80">{r.body}</p>
            {(isOfficer || r.author === codename) && (
              <button type="button" onClick={() => setReports((p) => p.filter((x) => x.id !== r.id))} className="mt-2 text-xs text-danger/80 hover:text-danger">
                {t("delete")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {open && <ReportModal codename={codename} onClose={() => setOpen(false)} />}
    </section>
  );
}
