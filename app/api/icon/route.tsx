import { ImageResponse } from "next/og";
import { ICON_SVG, isDisguise, PROFILES } from "@/lib/disguise";

const SIZES = [48, 96, 180, 192, 512];
const CACHE = "public, max-age=86400";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const id = q.get("disguise") ?? q.get("id");
  if (!isDisguise(id)) return new Response("Not found", { status: 404 });
  const asked = Number(q.get("size"));
  const size = SIZES.includes(asked) ? asked : 512;
  const png = PROFILES[id].png;

  let src: string;
  if (png) {
    const res = await fetch(new URL(png, url.origin));
    if (!res.ok) return new Response("Not found", { status: 404 });
    src = `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } else {
    const svg = ICON_SVG[id as keyof typeof ICON_SVG];
    if (q.get("format") === "svg") return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE } });
    src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: PROFILES[id].theme }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={size} height={size} alt="" style={{ objectFit: "contain" }} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": CACHE } },
  );
}
