"use client";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { SEED_THREATS, SEVERITY_COLOR, type Threat } from "@/lib/data";
import { usePersisted } from "@/lib/store";

export type LayerId = "aircraft" | "threats" | "bases" | "quakes";
type Base = "dark" | "sat";

interface Plane {
  id: string;
  call: string;
  lat: number;
  lon: number;
  alt: number;
  spd: number;
  hdg: number;
  mil: boolean;
}
interface Quake {
  id: string;
  mag: number;
  place: string;
  lat: number;
  lon: number;
}

const BASES: [string, number, number][] = [
  ["Tripoli · Mitiga", 32.89, 13.28],
  ["Benghazi · Benina", 32.1, 20.27],
  ["Sirte · Qardabiyah", 31.06, 16.59],
  ["Al-Jufra", 29.2, 15.99],
  ["Tobruk", 32.09, 23.96],
  ["Sabha", 27.02, 14.47],
  ["Sigonella (NAS)", 37.4, 14.92],
  ["Souda Bay", 35.53, 24.15],
  ["Incirlik", 37.0, 35.43],
  ["Al Udeid", 25.12, 51.31],
  ["Cairo West", 30.12, 30.92],
  ["Djibouti · Lemonnier", 11.55, 43.15],
];

const TILES = {
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap · © CARTO", max: 19 },
  sat: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri · Maxar · Earthstar", max: 19 },
} as const;
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const LAYER_LABEL: Record<LayerId, { ar: string; en: string }> = {
  aircraft: { ar: "الطائرات المباشرة", en: "Live Aircraft" },
  threats: { ar: "التهديدات", en: "Threats" },
  bases: { ar: "القواعد", en: "Bases" },
  quakes: { ar: "الزلازل", en: "Seismic" },
};

const dot = (color: string, size = 12, glow = true) =>
  `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};${glow ? `box-shadow:0 0 10px ${color},0 0 2px #fff;` : ""}"></span>`;
const planeIcon = (hdg: number, mil: boolean) =>
  `<span style="display:block;transform:rotate(${hdg}deg);font-size:15px;line-height:15px;color:${mil ? "#ff3b3b" : "#00e5ff"};text-shadow:0 0 6px currentColor">✈</span>`;

/** Interactive Leaflet map: pan/zoom, layer toggles, live aircraft/threat markers and a coordinate HUD. */
export default function TacticalMap({
  initial = { lat: 32.8, lng: 15, zoom: 5 },
  base = "dark",
  layers = ["aircraft", "threats", "bases", "quakes"],
  height = "h-[26rem]",
  searchable = false,
}: {
  initial?: { lat: number; lng: number; zoom: number };
  base?: Base;
  layers?: LayerId[];
  height?: string;
  searchable?: boolean;
}) {
  const { lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const groups = useRef<Partial<Record<LayerId, Leaflet.LayerGroup>>>({});
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState<Record<LayerId, boolean>>({ aircraft: layers.includes("aircraft"), threats: layers.includes("threats"), bases: layers.includes("bases"), quakes: false });
  const [hud, setHud] = useState({ lat: initial.lat, lng: initial.lng, zoom: initial.zoom });
  const [count, setCount] = useState({ ac: 0, mil: 0 });
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [threats] = usePersisted<Threat[]>("threats-v2", SEED_THREATS);

  // Create the map once.
  useEffect(() => {
    let dead = false;
    let map: Leaflet.Map | null = null;
    (async () => {
      const Lf = (await import("leaflet")).default ?? (await import("leaflet"));
      if (dead || !box.current) return;
      lib.current = Lf;
      map = Lf.map(box.current, { center: [initial.lat, initial.lng], zoom: initial.zoom, zoomControl: true, worldCopyJump: true, attributionControl: true });
      const t = TILES[base];
      Lf.tileLayer(t.url, { attribution: t.attr, maxZoom: t.max, subdomains: "abcd" }).addTo(map);
      if (base === "sat") Lf.tileLayer(LABELS, { maxZoom: 19, opacity: 0.9 }).addTo(map);
      for (const id of ["bases", "threats", "quakes", "aircraft"] as LayerId[]) groups.current[id] = Lf.layerGroup().addTo(map);
      map.on("mousemove", (e) => setHud((h) => ({ ...h, lat: e.latlng.lat, lng: e.latlng.lng })));
      map.on("zoomend", () => setHud((h) => ({ ...h, zoom: map!.getZoom() })));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      dead = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // initial/base are fixed per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Static layers: bases + threats.
  useEffect(() => {
    const Lf = lib.current;
    if (!ready || !Lf) return;
    const b = groups.current.bases!.clearLayers();
    if (on.bases)
      for (const [name, lat, lng] of BASES)
        Lf.marker([lat, lng], { icon: Lf.divIcon({ className: "", html: `<span style="display:block;color:#ffb020;font-size:13px;text-shadow:0 0 6px #ffb020">▲</span>`, iconSize: [14, 14] }) }).bindTooltip(name).addTo(b);
    const g = groups.current.threats!.clearLayers();
    if (on.threats)
      for (const x of threats) {
        const c = SEVERITY_COLOR[x.severity];
        Lf.marker([x.lat, x.lng], { icon: Lf.divIcon({ className: "", html: dot(c, 14), iconSize: [14, 14] }) })
          .bindTooltip(`${x.region} · ${x.vector} · ${x.severity.toUpperCase()}`)
          .addTo(g);
        Lf.circle([x.lat, x.lng], { radius: 90_000, color: c, weight: 1, fillOpacity: 0.08 }).addTo(g);
      }
  }, [ready, on.bases, on.threats, threats]);

  // Live aircraft around the current view.
  useEffect(() => {
    const Lf = lib.current;
    const map = mapRef.current;
    if (!ready || !Lf || !map) return;
    const g = groups.current.aircraft!;
    g.clearLayers();
    if (!on.aircraft) return;
    let alive = true;
    async function load() {
      const c = map!.getCenter();
      try {
        const res = await fetch(`/api/feed?src=air&lat=${c.lat.toFixed(2)}&lon=${c.lng.toFixed(2)}`);
        if (!res.ok) throw new Error();
        const { ac } = (await res.json()) as { ac: Plane[] };
        if (!alive) return;
        g.clearLayers();
        for (const p of ac)
          Lf!.marker([p.lat, p.lon], { icon: Lf!.divIcon({ className: "", html: planeIcon(p.hdg, p.mil), iconSize: [16, 16] }) })
            .bindTooltip(`${p.call}${p.mil ? " · MIL" : ""} · ${p.alt} ft · ${Math.round(p.spd)} kt`)
            .addTo(g);
        setCount({ ac: ac.length, mil: ac.filter((p) => p.mil).length });
        setStatus("");
      } catch {
        if (alive) setStatus(L("تعذر تحديث الطائرات", "Aircraft feed unavailable"));
      }
    }
    void load();
    const id = setInterval(load, 12_000);
    map.on("moveend", load);
    return () => {
      alive = false;
      clearInterval(id);
      map.off("moveend", load);
    };
    // L is a stable closure over `lang` only for the status text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, on.aircraft]);

  // Seismic layer.
  useEffect(() => {
    const Lf = lib.current;
    if (!ready || !Lf) return;
    const g = groups.current.quakes!.clearLayers();
    if (!on.quakes) return;
    let alive = true;
    fetch("/api/feed?src=usgs")
      .then((r) => r.json())
      .then(({ items }: { items: Quake[] }) => {
        if (!alive) return;
        for (const q of items)
          Lf.circleMarker([q.lat, q.lon], { radius: 3 + q.mag * 1.6, color: "#ff3b3b", weight: 1, fillOpacity: 0.35 }).bindTooltip(`M${q.mag} · ${q.place}`).addTo(g);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, on.quakes]);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || !mapRef.current) return;
    const m = q.match(/^(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)$/);
    if (m) return void mapRef.current.setView([Number(m[1]), Number(m[2])], 15);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const [hit] = (await r.json()) as { lat: string; lon: string }[];
      if (hit) mapRef.current.setView([Number(hit.lat), Number(hit.lon)], 14);
      else setStatus(L("لا نتائج", "No results"));
    } catch {
      setStatus(L("تعذر البحث", "Search failed"));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs" dir="ltr">
        {layers.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={on[id]}
            onClick={() => setOn((p) => ({ ...p, [id]: !p[id] }))}
            className={`border px-2.5 py-1 ${on[id] ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            {LAYER_LABEL[id][lang]}
          </button>
        ))}
        {on.aircraft && count.ac > 0 && (
          <span className="text-dim">
            ✈ {count.ac} · <span className="text-danger">MIL {count.mil}</span>
          </span>
        )}
        {status && <span className="text-warn">{status}</span>}
        {searchable && (
          <form onSubmit={find} className="ms-auto flex gap-1">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L("مكان أو 32.88, 13.19", "Place or 32.88, 13.19")} className="w-44 border border-line bg-black/70 px-2 py-1 text-xs outline-none focus:border-accent" />
            <button type="submit" className="border border-accent px-2 text-accent">GO</button>
          </form>
        )}
      </div>
      <div className={`relative isolate ${height} w-full overflow-hidden border border-accent/40 bg-black`}>
        <div ref={box} className="absolute inset-0 z-0" />
        <div className="pointer-events-none absolute start-2 top-2 z-[500] border border-accent/50 bg-black/75 px-2 py-1 text-[10px] leading-4 text-accent" dir="ltr">
          LAT {hud.lat.toFixed(4)}
          <br />
          LON {hud.lng.toFixed(4)}
          <br />Z{hud.zoom} · {base === "sat" ? "SAT-RECON" : "TAC-RADAR"}
        </div>
        {!ready && <p className="absolute inset-0 z-[400] grid place-items-center text-xs tracking-widest text-dim">{L("جارٍ تحميل الخريطة…", "Loading map…")}</p>}
      </div>
    </div>
  );
}
