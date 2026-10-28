// Same-origin map tile relay. Free, key-less sources only; the browser never talks to a tile host,
// so there are no CORS, referrer or "API key" failures, and tiles can be cached for offline use.
const UA = { "user-agent": "romoz-alhaq/1.0 (tactical console)" };

const SOURCES: Record<string, ((z: string, x: string, y: string) => string)[]> = {
  dark: [
    (z, x, y) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
    (z, x, y) => `https://b.basemaps.cartocdn.com/rastertiles/dark_all/${z}/${x}/${y}.png`,
    (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  ],
  sat: [(z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`],
};

export async function GET(_req: Request, ctx: { params: Promise<{ style: string; z: string; x: string; y: string }> }) {
  const { style, z, x, y } = await ctx.params;
  const list = SOURCES[style];
  if (!list || ![z, x, y].every((v) => /^\d{1,7}$/.test(v)) || Number(z) > 19) return new Response("Bad tile", { status: 400 });
  for (const src of list) {
    try {
      const res = await fetch(src(z, x, y), { headers: UA, signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/png";
      if (!type.startsWith("image/")) continue;
      return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, s-maxage=604800" } });
    } catch {
      /* try the next source */
    }
  }
  return new Response("Tile unavailable", { status: 502 });
}
