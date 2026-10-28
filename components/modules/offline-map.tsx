"use client";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import { usePersisted } from "@/lib/store";

type Kind = "target" | "checkpoint" | "route";
type Tool = "pan" | Kind | "measure" | "erase";
interface Pin {
  id: string;
  kind: Kind;
  lat: number;
  lng: number;
}

const TILE_CACHE = "rah-tiles-v1";
const TILE_URL = (z: number, x: number, y: number) => `/api/tiles/dark/${z}/${x}/${y}`;
const BBOX = { s: 19, n: 33.6, w: 9, e: 25.6 };
const MIN_Z = 5;
const MAX_Z = 8;
const NO_PINS: Pin[] = [];

/** Simplified national outline (lat, lng). Drawn from code so it works with no network at all. */
const LIBYA: [number, number][] = [
  [33.14, 11.55], [32.9, 12.5], [32.9, 13.2], [32.8, 14.0], [32.6, 15.2], [32.2, 15.3], [31.8, 15.9], [31.2, 16.6], [30.4, 18.5], [30.3, 19.2], [31.0, 20.0],
  [32.1, 20.1], [32.8, 21.7], [32.9, 22.9], [32.2, 24.0], [31.9, 24.5], [31.65, 25.0], [29.0, 25.0], [25.0, 25.0], [22.0, 25.0], [20.0, 24.0], [19.5, 24.0],
  [21.0, 22.5], [22.0, 19.0], [23.45, 15.99], [22.7, 14.2], [23.5, 13.0], [23.52, 12.0], [24.9, 11.9], [26.3, 10.0], [27.5, 9.9], [29.0, 9.8], [30.23, 9.55],
  [31.5, 10.3], [32.2, 11.0],
];
const CITIES: [string, number, number][] = [
  ["طرابلس · Tripoli", 32.8872, 13.1913], ["بنغازي · Benghazi", 32.1167, 20.0667], ["مصراتة · Misrata", 32.3754, 15.0925], ["طبرق · Tobruk", 32.0836, 23.9764],
  ["سرت · Sirte", 31.2089, 16.5887], ["سبها · Sabha", 27.0377, 14.4283], ["الزاوية · Zawiya", 32.7522, 12.7278], ["البيضاء · Al Bayda", 32.7627, 21.7551],
  ["درنة · Derna", 32.767, 22.6367], ["غدامس · Ghadames", 30.1337, 9.5001], ["غات · Ghat", 24.9647, 10.1728], ["مرزق · Murzuq", 25.9155, 13.9184],
  ["الكفرة · Kufra", 24.1996, 23.2915], ["أجدابيا · Ajdabiya", 30.7554, 20.2263], ["زليتن · Zliten", 32.4674, 14.5687], ["أوباري · Ubari", 26.5921, 12.7805],
  ["الجفرة · Jufra", 29.2, 15.99], ["الخمس · Khoms", 32.6486, 14.2619],
];
const NEIGHBORS: [string, number, number][] = [
  ["MEDITERRANEAN SEA", 34.2, 17], ["EGYPT", 27, 28.5], ["SUDAN", 20.5, 26.5], ["CHAD", 19.5, 19.5], ["NIGER", 21.5, 11], ["ALGERIA", 28, 7.5], ["TUNISIA", 33.2, 9.5],
];
const PIN_STYLE: Record<Kind, { c: string; g: string }> = {
  target: { c: "#ff3b3b", g: "🎯" },
  checkpoint: { c: "#ffb020", g: "⛔" },
  route: { c: "#00e5ff", g: "◆" },
};

const rad = (d: number) => (d * Math.PI) / 180;
function haversine(a: [number, number], b: [number, number]) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}
const pathKm = (pts: [number, number][]) => pts.slice(1).reduce((s, p, i) => s + haversine(pts[i], p), 0);
const fmtDist = (km: number) => `${km.toFixed(2)} km · ${(km * 0.621371).toFixed(2)} mi · ${(km / 1.852).toFixed(2)} nm`;

const tileXY = (lat: number, lng: number, z: number) => {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2) * n);
  return { x, y };
};

async function cachedTile(url: string) {
  const cache = await caches.open(TILE_CACHE);
  let res = await cache.match(url);
  if (!res) {
    res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    await cache.put(url, res.clone());
  }
  return URL.createObjectURL(await res.blob());
}

export default function OfflineMapModule() {
  const { lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const pinLayer = useRef<Leaflet.LayerGroup | null>(null);
  const measureLayer = useRef<Leaflet.LayerGroup | null>(null);
  const meLayer = useRef<Leaflet.LayerGroup | null>(null);
  const tileLayer = useRef<Leaflet.TileLayer | null>(null);
  const toolRef = useRef<Tool>("pan");
  const measureRef = useRef<[number, number][]>([]);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
  const [pins, setPins] = usePersisted<Pin[]>("offmap", NO_PINS);
  const [tilesOn, setTilesOn] = useState(true);
  const [measure, setMeasure] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsErr, setGpsErr] = useState("");
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null);
  const [cached, setCached] = useState<number | null>(null);
  const pinsRef = useRef(pins);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  async function countCached() {
    try {
      setCached((await (await caches.open(TILE_CACHE)).keys()).length);
    } catch {
      setCached(null);
    }
  }

  useEffect(() => {
    let dead = false;
    let map: Leaflet.Map | null = null;
    (async () => {
      const Lf = (await import("leaflet")).default ?? (await import("leaflet"));
      if (dead || !box.current) return;
      lib.current = Lf;
      map = Lf.map(box.current, { center: [27.5, 17.5], zoom: 5, minZoom: 3, maxZoom: MAX_Z + 4, attributionControl: false, worldCopyJump: true });

      // Cache-first tiles: whatever was downloaded (or seen before) renders with no network.
      const Cached = Lf.TileLayer.extend({
        createTile(this: Leaflet.TileLayer, c: Leaflet.Coords, done: Leaflet.DoneCallback) {
          const img = document.createElement("img");
          img.alt = "";
          cachedTile(TILE_URL(c.z, c.x, c.y))
            .then((src) => {
              img.onload = () => done(undefined, img);
              img.src = src;
            })
            .catch((e) => done(e as Error, img));
          return img;
        },
      });
      tileLayer.current = new (Cached as unknown as new (u: string, o: Leaflet.TileLayerOptions) => Leaflet.TileLayer)("x", { maxNativeZoom: MAX_Z + 3, maxZoom: MAX_Z + 4 }).addTo(map);

      // Built-in vector basemap: always available.
      Lf.polygon(LIBYA, { color: "#00ff41", weight: 2, fillColor: "#00ff41", fillOpacity: 0.06, interactive: false }).addTo(map);
      Lf.polyline([[20.0, 24.0], [19.5, 24.0]], { color: "#00ff41", weight: 1 }).addTo(map);
      for (const [name, lat, lng] of NEIGHBORS)
        Lf.marker([lat, lng], { interactive: false, icon: Lf.divIcon({ className: "", html: `<span style="white-space:nowrap;color:#4f8a62;font-size:10px;letter-spacing:2px">${name}</span>`, iconSize: [0, 0] }) }).addTo(map);
      for (const [name, lat, lng] of CITIES) {
        Lf.circleMarker([lat, lng], { radius: 3, color: "#00ff41", weight: 1, fillOpacity: 1 }).bindTooltip(name, { direction: "right", className: "" }).addTo(map);
      }
      pinLayer.current = Lf.layerGroup().addTo(map);
      measureLayer.current = Lf.layerGroup().addTo(map);
      meLayer.current = Lf.layerGroup().addTo(map);

      map.on("mousemove", (e) => setCursor([e.latlng.lat, e.latlng.lng]));
      map.on("click", (e) => {
        const t = toolRef.current;
        const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
        if (t === "measure") {
          measureRef.current = [...measureRef.current, pt];
          setMeasure(measureRef.current);
        } else if (t === "target" || t === "checkpoint" || t === "route") {
          setPins([...pinsRef.current, { id: Math.random().toString(36).slice(2, 9), kind: t, lat: pt[0], lng: pt[1] }]);
        }
      });
      mapRef.current = map;
      setReady(true);
      void countCached();
    })();
    return () => {
      dead = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // setPins is stable per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins + route line.
  useEffect(() => {
    const Lf = lib.current;
    const g = pinLayer.current;
    if (!ready || !Lf || !g) return;
    g.clearLayers();
    const route = pins.filter((p) => p.kind === "route");
    if (route.length > 1) Lf.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: "#00e5ff", weight: 3, dashArray: "6 6" }).addTo(g);
    for (const p of pins) {
      const s = PIN_STYLE[p.kind];
      Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: "", html: `<span style="display:block;font-size:18px;color:${s.c};text-shadow:0 0 8px ${s.c}">${s.g}</span>`, iconSize: [20, 20] }) })
        .bindTooltip(`${p.kind.toUpperCase()} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`)
        .on("click", () => {
          if (toolRef.current === "erase") setPins(pinsRef.current.filter((x) => x.id !== p.id));
        })
        .addTo(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pins]);

  // Measure line.
  useEffect(() => {
    const Lf = lib.current;
    const g = measureLayer.current;
    if (!ready || !Lf || !g) return;
    g.clearLayers();
    if (measure.length) Lf.polyline(measure, { color: "#ffb020", weight: 2, dashArray: "2 6" }).addTo(g);
    for (const p of measure) Lf.circleMarker(p, { radius: 4, color: "#ffb020", fillOpacity: 1 }).addTo(g);
  }, [ready, measure]);

  useEffect(() => {
    const m = mapRef.current;
    const t = tileLayer.current;
    if (!ready || !m || !t) return;
    if (tilesOn) t.addTo(m);
    else t.remove();
  }, [ready, tilesOn]);

  useEffect(() => {
    if (box.current) box.current.style.cursor = tool === "pan" ? "" : "crosshair";
  }, [tool]);

  // Live GPS: works with no connection (device GNSS).
  useEffect(() => {
    if (!ready || !navigator.geolocation) return;
    const Lf = lib.current!;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        setGps(pos);
        setGpsErr("");
        const g = meLayer.current;
        if (!g) return;
        g.clearLayers();
        Lf.circle([pos.lat, pos.lng], { radius: Math.max(pos.acc, 5), color: "#00e5ff", weight: 1, fillOpacity: 0.12 }).addTo(g);
        Lf.circleMarker([pos.lat, pos.lng], { radius: 6, color: "#fff", fillColor: "#00e5ff", fillOpacity: 1, weight: 2 }).addTo(g);
      },
      (e) => setGpsErr(e.code === 1 ? L("تم رفض إذن الموقع", "Location permission denied") : L("GPS غير متاح", "GPS unavailable")),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // L only localizes error text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function download() {
    if (dl) return;
    const urls: string[] = [];
    for (let z = MIN_Z; z <= MAX_Z; z++) {
      const a = tileXY(BBOX.n, BBOX.w, z);
      const b = tileXY(BBOX.s, BBOX.e, z);
      for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) urls.push(TILE_URL(z, x, y));
    }
    setDl({ done: 0, total: urls.length });
    const cache = await caches.open(TILE_CACHE);
    let done = 0;
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(
        urls.slice(i, i + 6).map(async (u) => {
          try {
            if (!(await cache.match(u))) {
              const r = await fetch(u);
              if (r.ok) await cache.put(u, r);
            }
          } catch {
            /* skip: tile stays uncached */
          }
          setDl({ done: ++done, total: urls.length });
        }),
      );
    }
    setDl(null);
    void countCached();
    mapRef.current?.invalidateSize();
  }

  async function clearCache() {
    await caches.delete(TILE_CACHE);
    void countCached();
  }

  const tools: { id: Tool; label: string }[] = [
    { id: "pan", label: L("تحريك", "Pan") },
    { id: "target", label: L("🎯 هدف", "🎯 Target") },
    { id: "checkpoint", label: L("⛔ نقطة تفتيش", "⛔ Checkpoint") },
    { id: "route", label: L("◆ مسار", "◆ Route") },
    { id: "measure", label: L("📏 قياس", "📏 Measure") },
    { id: "erase", label: L("🗑 حذف", "🗑 Erase") },
  ];
  const routePts = pins.filter((p) => p.kind === "route").map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <section className="space-y-3">
      <h2 className="glow text-sm tracking-widest">{L("الخريطة التكتيكية (أوفلاين) / Offline Map", "Tactical Map (Offline)")}</h2>

      <div className="flex flex-wrap items-center gap-2 border border-line bg-panel p-3 text-xs">
        <button type="button" onClick={download} disabled={!!dl} className={btnCls}>
          {dl ? `${dl.done}/${dl.total}` : L("تحميل الخريطة للعمل بدون إنترنت", "Download map for offline use")}
        </button>
        <button type="button" onClick={clearCache} className="border border-line px-3 py-1.5 text-dim hover:text-fg">
          {L("مسح الذاكرة", "Clear cache")}
        </button>
        <label className="flex items-center gap-1.5 text-dim">
          <input type="checkbox" checked={tilesOn} onChange={(e) => setTilesOn(e.target.checked)} className="accent-[#00ff41]" />
          {L("طبقة الخريطة", "Tile layer")}
        </label>
        <span className="text-dim" dir="ltr">
          {cached === null ? "" : `${cached} ${L("مربع مخزّن", "tiles cached")}`}
        </span>
        {dl && <div className="h-1 w-full bg-line"><div className="h-full bg-accent" style={{ width: `${(dl.done / dl.total) * 100}%` }} /></div>}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tools">
        {tools.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={tool === x.id}
            onClick={() => setTool(x.id)}
            className={`border px-3 py-1.5 text-xs ${tool === x.id ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            {x.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            measureRef.current = [];
            setMeasure([]);
          }}
          className="border border-line px-3 py-1.5 text-xs text-dim hover:text-fg"
        >
          {L("مسح القياس", "Reset measure")}
        </button>
        <button type="button" onClick={() => setPins([])} className="border border-danger/60 px-3 py-1.5 text-xs text-danger hover:bg-danger/10">
          {L("حذف كل العلامات", "Clear markers")}
        </button>
      </div>

      <div className="relative isolate h-[60dvh] min-h-96 w-full overflow-hidden border border-accent/40 bg-black">
        <div ref={box} className="absolute inset-0 z-0 bg-black" />
        <div className="pointer-events-none absolute start-2 top-2 z-[500] space-y-0.5 border border-accent/50 bg-black/75 px-2 py-1 text-[10px] leading-4 text-accent" dir="ltr">
          <div>CUR {cursor ? `${cursor[0].toFixed(4)}, ${cursor[1].toFixed(4)}` : "—"}</div>
          <div className="text-[#00e5ff]">GPS {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} ±${Math.round(gps.acc)}m` : gpsErr || "…"}</div>
        </div>
        {gps && (
          <button
            type="button"
            onClick={() => mapRef.current?.setView([gps.lat, gps.lng], Math.max(mapRef.current.getZoom(), 12))}
            className="absolute bottom-3 end-3 z-[500] border border-[#00e5ff] bg-black/80 px-3 py-1.5 text-xs text-[#00e5ff]"
          >
            ◎ {L("موقعي", "My position")}
          </button>
        )}
      </div>

      <div className="grid gap-2 border border-line bg-panel p-3 text-xs sm:grid-cols-2" dir="ltr">
        <p>
          <span className="text-dim">MEASURE: </span>
          <span className="text-warn">{measure.length > 1 ? fmtDist(pathKm(measure)) : "—"}</span>
        </p>
        <p>
          <span className="text-dim">ROUTE: </span>
          <span className="text-[#00e5ff]">{routePts.length > 1 ? fmtDist(pathKm(routePts)) : "—"}</span>
        </p>
        <p className="text-dim sm:col-span-2">
          {pins.filter((p) => p.kind === "target").length} targets · {pins.filter((p) => p.kind === "checkpoint").length} checkpoints · {routePts.length} route pts
        </p>
      </div>
    </section>
  );
}
