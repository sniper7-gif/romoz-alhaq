"use client";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { Quake } from "@/components/world-monitor";

export interface MemberPos {
  user_codename: string;
  role: "ADMIN" | "MEMBER";
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updated_at: string;
}

const icon = (cls: string, size = 16) =>
  L.divIcon({ className: "", html: `<div class="pulse-marker ${cls}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

function Follow({ target }: { target: MemberPos | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 1 });
  }, [target, map]);
  return null;
}

export default function RadarMap({
  members,
  online,
  quakes,
}: {
  members: MemberPos[];
  online: { codename: string }[];
  quakes: Quake[];
}) {
  const [hud, setHud] = useState(true);
  const [locked, setLocked] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const isOnline = (m: MemberPos) =>
    online.some((o) => o.codename === m.user_codename) || now - new Date(m.updated_at).getTime() < 20000;
  const target = members.find((m) => m.user_codename === locked);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer center={[25, 20]} zoom={3} className="h-full w-full" worldCopyJump>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          subdomains="abcd"
          maxZoom={19}
        />
        <Follow target={target} />
        {members.map((m) => (
          <Marker key={m.user_codename} position={[m.lat, m.lng]} icon={icon(m.role === "ADMIN" ? "admin" : "")}>
            <Popup>
              <b>{m.user_codename}</b> [{m.role}]<br />
              {m.lat.toFixed(5)}, {m.lng.toFixed(5)}<br />
              {isOnline(m) ? "● ONLINE" : "○ OFFLINE"}
              {m.speed != null && <><br />SPD {(m.speed * 3.6).toFixed(0)} km/h</>}
              {m.heading != null && <><br />HDG {Math.round(m.heading)}°</>}
            </Popup>
          </Marker>
        ))}
        {quakes.filter((q) => (q.mag ?? 0) >= 2.5).map((q) => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={icon("quake", 14)}>
            <Popup>
              <b>⚠ M{q.mag?.toFixed(1)}</b><br />{q.place}<br />{new Date(q.time).toLocaleString()}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {hud && (
        <>
          <div className="radar-sweep" />
          <div className="hud-grid" />
        </>
      )}
      <span className="hud-corner tl" /><span className="hud-corner tr" />
      <span className="hud-corner bl" /><span className="hud-corner br" />

      <div className="absolute top-3 left-3 z-[1000] w-56 border border-line bg-panel/90 p-2 text-xs space-y-1 max-h-[60%] overflow-auto">
        <div className="flex justify-between items-center">
          <span className="text-dim tracking-widest">GOD EYES</span>
          <button onClick={() => setHud((h) => !h)} className="border border-line px-2 text-accent">HUD {hud ? "ON" : "OFF"}</button>
        </div>
        {members.length === 0 && <p className="text-dim">NO TELEMETRY</p>}
        {members.map((m) => (
          <div key={m.user_codename} className="border-t border-line pt-1">
            <div className="flex justify-between">
              <span className={isOnline(m) ? "text-accent" : "text-dim"}>{isOnline(m) ? "●" : "○"} {m.user_codename}</span>
              <button
                onClick={() => setLocked(locked === m.user_codename ? null : m.user_codename)}
                className={`px-1 border ${locked === m.user_codename ? "border-danger text-danger" : "border-line text-dim"}`}>
                {locked === m.user_codename ? "UNLOCK" : "LOCK ON"}
              </button>
            </div>
            <p className="text-[10px] text-dim">{m.role} · {m.lat.toFixed(4)}, {m.lng.toFixed(4)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
