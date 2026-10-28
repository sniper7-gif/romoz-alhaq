import { ImageResponse } from "next/og";
import { ICON_SVG, isDisguise } from "@/lib/disguise";

const SIZES = [48, 96, 180, 192, 512];
const CACHE = "public, max-age=86400";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (!isDisguise(id) || id === "default") return new Response("Not found", { status: 404 });
  const svg = ICON_SVG[id];

  if (q.get("format") === "svg") {
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE } });
  }
  const asked = Number(q.get("size"));
  const size = SIZES.includes(asked) ? asked : 512;
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="" />,
    { width: size, height: size, headers: { "Cache-Control": CACHE } },
  );
}
