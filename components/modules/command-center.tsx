"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import { SEED_REPORTS, SEED_THREATS, SEVERITIES, SEVERITY_COLOR, type Report, type Threat } from "@/lib/data";
import { usePersisted } from "@/lib/store";

const KASPERSKY = "https://cybermap.kaspersky.com/en/widget/dynamic/dark";
const WORLD_MONITOR = "https://worldmonitor.app";

function LiveMap() {
  const { t } = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="border border-accent/40 bg-panel p-3">
      <h3 className="mb-2 text-xs tracking-widest text-dim">{t("liveMap")}</h3>
      <div className="relative aspect-square max-h-[70dvh] w-full overflow-hidden bg-black sm:aspect-video">
        {!loaded && <p className="absolute inset-0 grid place-items-center text-xs tracking-widest text-dim">{t("mapLoading")}</p>}
        <iframe
          src={KASPERSKY}
          title={t("liveMap")}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 size-full border-0"
        />
      </div>
    </div>
  );
}

/** Summarizes the console's own threat and intel data. Runs locally; no model call. */
function AiAnalyzer() {
  const { t } = useT();
  const [threats] = usePersisted<Threat[]>("threats-v2", SEED_THREATS);
  const [reports] = usePersisted<Report[]>("reports", SEED_REPORTS);
  const [out, setOut] = useState<null | { counts: Record<string, number>; top: string; advice: string }>(null);

  function analyze() {
    const counts = Object.fromEntries(SEVERITIES.map((s) => [s, threats.filter((x) => x.severity === s).length]));
    const byRegion = new Map<string, number>();
    const weight = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    threats.forEach((x) => byRegion.set(x.region, (byRegion.get(x.region) ?? 0) + weight[x.severity]));
    const top = [...byRegion.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const openCritical = reports.filter((r) => r.severity === "critical").length;
    const advice =
      counts.critical + openCritical > 2
        ? "Escalate: isolate affected segments and rotate credentials."
        : counts.critical + counts.high > 0
          ? "Elevated: increase monitoring on the top region and verify open reports."
          : "Stable: continue routine monitoring.";
    setOut({ counts, top, advice });
  }

  return (
    <div className="space-y-3 border border-line bg-panel p-4">
      <h3 className="glow text-sm tracking-widest">{t("aiAnalyzer")}</h3>
      <p className="text-xs text-dim">{t("aiHint")}</p>
      <button type="button" onClick={analyze} className={btnCls}>
        {t("analyze")}
      </button>
      {out && (
        <div className="fade-in space-y-2 border-t border-line pt-3 text-sm" key={JSON.stringify(out)}>
          <div className="flex flex-wrap gap-3 text-xs">
            {SEVERITIES.map((s) => (
              <span key={s} style={{ color: SEVERITY_COLOR[s] }}>
                {t(s)}: {out.counts[s]}
              </span>
            ))}
            <span className="text-dim">
              {t("total")}: {threats.length}
            </span>
          </div>
          <p>
            <span className="text-dim">{t("topRegion")}: </span>
            {out.top}
          </p>
          <p>
            <span className="text-dim">{t("advice")}: </span>
            {out.advice}
          </p>
        </div>
      )}
    </div>
  );
}

function RavenGhostTool() {
  const { t } = useT();
  return (
    <div className="space-y-3 border border-danger/50 bg-panel p-4">
      <h3 className="glow text-sm tracking-widest">{t("ghostTool")}</h3>
      <p className="text-xs text-dim" dir="ltr">{t("ghostDesc")}</p>
      <button
        type="button"
        onClick={() => window.open(WORLD_MONITOR, "_blank", "noopener,noreferrer")}
        className={`${btnCls} border-danger text-danger hover:bg-danger/10`}
      >
        {t("launchBridge")}
      </button>
    </div>
  );
}

export default function CommandCenterModule() {
  const { t } = useT();
  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabCommand")}</h2>
      <LiveMap />
      <div className="grid gap-4 md:grid-cols-2">
        <AiAnalyzer />
        <RavenGhostTool />
      </div>
    </section>
  );
}
