"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import type { Key } from "@/lib/i18n";

interface Node {
  id: string;
  title: Key;
  desc: Key;
  url: string;
  icon: string;
  repo?: string;
}

const NODES: Node[] = [
  { id: "eye", title: "osintEye", desc: "osintEyeDesc", url: "https://maptheworld.ai/", icon: "🛰️", repo: "https://github.com/bilawalsidhu/gods-eye-view" },
  { id: "monitor", title: "osintMonitor", desc: "osintMonitorDesc", url: "https://worldmonitor.app/", icon: "🌐" },
  { id: "air", title: "osintAir", desc: "osintAirDesc", url: "https://globe.adsbexchange.com/", icon: "✈️" },
  { id: "sea", title: "osintSea", desc: "osintSeaDesc", url: "https://www.marinetraffic.com/", icon: "🚢" },
  { id: "net", title: "osintNet", desc: "osintNetDesc", url: "https://radar.cloudflare.com/", icon: "📡" },
  { id: "wx", title: "osintWx", desc: "osintWxDesc", url: "https://embed.windy.com/?27.0,17.0,5", icon: "🌪️" },
];

const SLOW_MS = 9000;

const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

function Hud({ node, onClose }: { node: Node; onClose: () => void }) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.())?.catch(() => {});

  return (
    <div ref={box} className="flex min-h-[28rem] flex-col border border-accent/50 bg-black">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2 text-xs">
        <span className="glow min-w-0 flex-1 truncate tracking-widest">{t(node.title)}</span>
        <button type="button" onClick={toggleFull} className={btnCls}>
          {full ? t("hudExitFull") : t("hudFull")}
        </button>
        <button type="button" onClick={() => openExternal(node.url)} className={btnCls}>
          {t("osintExternal")}
        </button>
        <button type="button" onClick={onClose} aria-label={t("close")} className="px-2 text-dim hover:text-accent">
          ✕
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe
          src={node.url}
          title={t(node.title)}
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 size-full bg-black"
        />
        {!loaded && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-3 text-center text-xs tracking-widest text-dim">{t("hudLoading")}</div>
        )}
      </div>
      {slow && (
        <div role="status" className="flex flex-wrap items-center gap-3 border-t border-warn/60 bg-warn/10 px-3 py-2 text-xs text-warn">
          <span className="min-w-0 flex-1">{t("hudBlocked")}</span>
          <button type="button" onClick={() => openExternal(node.url)} className={btnCls}>
            {t("osintExternal")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OsintHub() {
  const { t } = useT();
  const [active, setActive] = useState<Node | null>(null);

  return (
    <div className="space-y-3 border border-danger/50 bg-panel p-4">
      <div>
        <h3 className="glow text-sm tracking-widest">{t("ghostTool")}</h3>
        <p className="mt-1 text-xs text-dim" dir="ltr">{t("ghostDesc")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {NODES.map((n) => (
          <article key={n.id} className={`flex flex-col gap-2 border p-3 ${active?.id === n.id ? "border-accent bg-accent/10" : "border-line bg-black/40"}`}>
            <h4 className="flex items-center gap-2 text-sm text-accent">
              <span aria-hidden className="text-lg">{n.icon}</span>
              {t(n.title)}
            </h4>
            <p className="flex-1 text-xs text-dim">{t(n.desc)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setActive(n)} className={btnCls}>
                {t("osintEmbedded")}
              </button>
              <button type="button" onClick={() => openExternal(n.url)} className={`${btnCls} border-danger text-danger hover:bg-danger/10`}>
                {t("osintExternal")}
              </button>
            </div>
            {n.repo && (
              <a href={n.repo} target="_blank" rel="noopener noreferrer" className="text-[11px] text-dim underline hover:text-accent" dir="ltr">
                GitHub · gods-eye-view
              </a>
            )}
          </article>
        ))}
      </div>

      {active && <Hud key={active.id} node={active} onClose={() => setActive(null)} />}
    </div>
  );
}
