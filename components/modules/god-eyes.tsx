"use client";
import { useState } from "react";
import Globe from "@/components/globe";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import { SEED_THREATS, SEVERITIES, SEVERITY_COLOR, uid, type Severity, type Threat } from "@/lib/data";
import type { Key } from "@/lib/i18n";
import { usePersisted } from "@/lib/store";

const SITES = [
  { region: "Dubai", lat: 25.2, lng: 55.3 },
  { region: "Cairo", lat: 30, lng: 31.2 },
  { region: "Tokyo", lat: 35.7, lng: 139.7 },
  { region: "Sydney", lat: -33.9, lng: 151.2 },
  { region: "Berlin", lat: 52.5, lng: 13.4 },
  { region: "Mexico City", lat: 19.4, lng: -99.1 },
  { region: "Mumbai", lat: 19.1, lng: 72.9 },
  { region: "Nairobi", lat: -1.3, lng: 36.8 },
];
const VECTORS = ["Zero-day exploit", "Supply-chain implant", "DDoS flood", "Spear phishing", "Data exfiltration", "Rogue access point"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function GodEyesModule() {
  const { t } = useT();
  const [threats, setThreats] = usePersisted<Threat[]>("threats-v2", SEED_THREATS);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [selId, setSelId] = useState<string | null>(null);

  const shown = threats.filter((x) => filter === "all" || x.severity === filter);
  const selected = threats.find((x) => x.id === selId) ?? null;

  function scan() {
    const site = pick(SITES);
    const n: Threat = { id: uid(), lat: site.lat, lng: site.lng, region: site.region, severity: pick(SEVERITIES), vector: pick(VECTORS) };
    setThreats((p) => [...p, n].slice(-14));
    setSelId(n.id);
  }

  return (
    <section className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <h2 className="glow tracking-widest">{t("tabEyes")} · {t("cyberMap")}</h2>
        <span className="text-accent">● {t("attacksLive")}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", ...SEVERITIES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`border px-3 py-1 text-xs ${filter === s ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            {t(s as Key)}
          </button>
        ))}
        <button type="button" onClick={scan} className={`${btnCls} ms-auto py-1`}>
          {t("scanNow")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="border border-line bg-black py-2">
          <Globe threats={shown} selectedId={selId} onSelect={setSelId} />
          <p className="text-center text-[10px] text-dim">{t("dragToRotate")}</p>
        </div>

        <aside className="border border-line bg-black/50 p-3 text-sm">
          <h3 className="mb-2 text-[11px] tracking-widest text-dim">
            {t("threats")} ({shown.length})
          </h3>
          {selected ? (
            <dl className="fade-in mb-3 space-y-2 border-b border-line pb-3" key={selected.id}>
              <div>
                <dt className="text-[10px] text-dim">{t("region")}</dt>
                <dd>{selected.region}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-dim">{t("vector")}</dt>
                <dd>{selected.vector}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-dim">{t("severity")}</dt>
                <dd style={{ color: SEVERITY_COLOR[selected.severity] }}>{t(selected.severity).toUpperCase()}</dd>
              </div>
            </dl>
          ) : (
            <p className="mb-3 text-xs text-dim">{t("noSelection")}</p>
          )}
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {shown.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setSelId(x.id)}
                  className={`flex w-full items-center gap-2 px-2 py-1 text-start text-xs hover:bg-accent/10 ${selId === x.id ? "bg-accent/10" : ""}`}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[x.severity] }} aria-hidden />
                  <span className="truncate">{x.region}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
