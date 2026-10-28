import { iconUrl, isDisguise, isLang, PROFILES } from "@/lib/disguise";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = isDisguise(q.get("disguise")) ? (q.get("disguise") as keyof typeof PROFILES) : "default";
  const lang = isLang(q.get("lang")) ? (q.get("lang") as "ar" | "en") : "ar";
  const p = PROFILES[id];
  const name = p.name[lang];
  const icon = (size: number, purpose: string) => ({ src: iconUrl(id, size), sizes: `${size}x${size}`, type: "image/png", purpose });

  return Response.json(
    {
      id: `/?disguise=${id}`,
      name,
      short_name: id === "default" ? "L.I.S" : name,
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      background_color: p.theme,
      theme_color: p.theme,
      icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
}
