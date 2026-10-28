import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Server-side relay for live public feeds, so the browser never hits CORS or mixed-content limits.
// Only the fixed upstreams below can be reached.
const UA = { "user-agent": "romoz-alhaq/1.0 (+tactical console)" };
const num = (v: string | null, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v ?? d) || d));

async function getJson(url: string, ms = 9000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

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

async function aircraft(lat: number, lon: number): Promise<Plane[]> {
  try {
    const d = await getJson(`https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/250`);
    return (d.ac ?? [])
      .filter((a: { lat?: number; lon?: number }) => typeof a.lat === "number" && typeof a.lon === "number")
      .slice(0, 400)
      .map((a: Record<string, unknown>) => ({
        id: String(a.hex),
        call: String(a.flight ?? "").trim() || String(a.r ?? a.hex),
        lat: a.lat as number,
        lon: a.lon as number,
        alt: typeof a.alt_baro === "number" ? a.alt_baro : 0,
        spd: Number(a.gs ?? 0),
        hdg: Number(a.track ?? 0),
        mil: Boolean((Number(a.dbFlags ?? 0) & 1) || /^(RCH|FORTE|LAGR|HOMER|NATO|DUKE|IAM|CNV)/i.test(String(a.flight ?? ""))),
      }));
  } catch {
    const d = await getJson(`https://opensky-network.org/api/states/all?lamin=${lat - 4}&lamax=${lat + 4}&lomin=${lon - 6}&lomax=${lon + 6}`);
    return ((d.states ?? []) as unknown[][])
      .filter((s) => typeof s[5] === "number" && typeof s[6] === "number")
      .slice(0, 400)
      .map((s) => ({ id: String(s[0]), call: String(s[1] ?? "").trim() || String(s[0]), lat: s[6] as number, lon: s[5] as number, alt: Math.round(Number(s[7] ?? 0) * 3.281), spd: Math.round(Number(s[9] ?? 0) * 1.944), hdg: Number(s[10] ?? 0), mil: false }));
  }
}

const GDELT_Q = {
  world: "(war OR military OR missile OR conflict OR sanctions)",
  cyber: '("cyberattack" OR "internet outage" OR ransomware OR "data breach" OR "power outage")',
} as const;

const gdelt = new Map<string, { t: number; items: unknown[] }>();

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.codename) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  try {
    switch (q.get("src")) {
      case "air":
        return NextResponse.json({ ac: await aircraft(num(q.get("lat"), 32.8, -80, 80), num(q.get("lon"), 15, -180, 180)) });
      case "usgs": {
        const d = await getJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
        return NextResponse.json({
          items: (d.features ?? []).slice(0, 60).map((f: { id: string; properties: { mag: number; place: string; time: number }; geometry: { coordinates: number[] } }) => ({
            id: f.id,
            mag: f.properties.mag,
            place: f.properties.place,
            time: f.properties.time,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          })),
        });
      }
      case "gdelt": {
        // GDELT allows one request per 5 s: share one cached answer per kind and serve it stale on errors.
        const kind = q.get("kind") === "cyber" ? "cyber" : "world";
        const hit = gdelt.get(kind);
        if (hit && Date.now() - hit.t < 90_000) return NextResponse.json({ items: hit.items });
        try {
          const d = await getJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(GDELT_Q[kind])}&mode=artlist&format=json&maxrecords=30&sort=datedesc&timespan=1d`, 12000);
          const items = (d.articles ?? []).map((a: { url: string; title: string; domain: string; seendate: string; sourcecountry: string }) => ({
            url: a.url,
            title: a.title,
            domain: a.domain,
            time: a.seendate,
            country: a.sourcecountry,
          }));
          gdelt.set(kind, { t: Date.now(), items });
          return NextResponse.json({ items });
        } catch (e) {
          if (hit) return NextResponse.json({ items: hit.items });
          throw e;
        }
      }
      default:
        return NextResponse.json({ error: "BAD_SRC" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "UPSTREAM" }, { status: 502 });
  }
}
