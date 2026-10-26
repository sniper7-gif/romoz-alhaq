"use client";
import { useEffect, useState } from "react";

export interface Quake {
  id: string;
  mag: number | null;
  place: string;
  time: number;
  lat: number;
  lng: number;
  url: string;
}

const FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export function useQuakes() {
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch(FEED, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (dead) return;
        const list: Quake[] = j.features
          .filter((f: { geometry?: { coordinates?: number[] } }) => f.geometry?.coordinates)
          .map((f: { id: string; properties: { mag: number | null; place: string; time: number; url: string }; geometry: { coordinates: number[] } }) => ({
            id: f.id,
            mag: f.properties.mag,
            place: f.properties.place ?? "Unknown",
            time: f.properties.time,
            url: f.properties.url,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
          .sort((a: Quake, b: Quake) => (b.mag ?? 0) - (a.mag ?? 0));
        setQuakes(list);
        setStatus("live");
      } catch {
        if (!dead) setStatus("error");
      }
    };
    void load();
    const t = setInterval(load, 120000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  return { quakes, status };
}

interface AlertMsg {
  id: string;
  sender_codename: string;
  created_at: string;
  text?: string;
}

export function WorldMonitor({ quakes, status, alerts }: { quakes: Quake[]; status: string; alerts: AlertMsg[] }) {
  return (
    <div className="h-full overflow-auto p-4 grid gap-4 lg:grid-cols-2 content-start">
      <section className="border border-line bg-panel p-3">
        <h2 className="text-xs text-dim mb-2 tracking-widest">COMMAND ALERTS</h2>
        {alerts.length === 0 && <p className="text-xs text-dim">NO ACTIVE ALERTS</p>}
        {[...alerts].reverse().map((a) => (
          <p key={a.id} className="text-sm text-danger border-b border-line py-1" dir="auto">
            ⚠ {a.text} <span className="text-dim text-[10px]">— {a.sender_codename} {new Date(a.created_at).toLocaleTimeString()}</span>
          </p>
        ))}
      </section>
      <section className="border border-line bg-panel p-3">
        <h2 className="text-xs text-dim mb-2 tracking-widest">
          USGS SEISMIC FEED · 24H · <span className={status === "live" ? "text-accent" : "text-warn"}>{status.toUpperCase()}</span> · {quakes.length} EVENTS
        </h2>
        <ul className="text-xs space-y-1 max-h-[60vh] overflow-auto">
          {quakes.map((q) => (
            <li key={q.id} className="flex gap-2 border-b border-line/50 py-1">
              <span className={`w-10 shrink-0 ${(q.mag ?? 0) >= 5 ? "text-danger" : (q.mag ?? 0) >= 4 ? "text-warn" : "text-accent"}`}>
                M{q.mag?.toFixed(1) ?? "?"}
              </span>
              <a href={q.url} target="_blank" rel="noopener noreferrer" className="flex-1 hover:underline">{q.place}</a>
              <span className="text-dim">{new Date(q.time).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
