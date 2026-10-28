"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers";

interface Article {
  url: string;
  title: string;
  domain: string;
  time: string;
  country: string;
}
interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
}

const REFRESH_MS = 60_000;

/** Native live event feed rendered inside the HUD: GDELT headlines (+ USGS seismic for the world monitor). */
export default function FeedPanel({ kind }: { kind: "world" | "cyber" }) {
  const { lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [news, setNews] = useState<Article[] | null>(null);
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [err, setErr] = useState(false);
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [n, q] = await Promise.all([
          fetch(`/api/feed?src=gdelt&kind=${kind}`).then((r) => (r.ok ? r.json() : Promise.reject())),
          kind === "world" ? fetch("/api/feed?src=usgs").then((r) => (r.ok ? r.json() : { items: [] })) : Promise.resolve({ items: [] }),
        ]);
        if (!alive) return;
        setNews(n.items);
        setQuakes(q.items.slice(0, 12));
        setErr(false);
        setUpdated(new Date().toISOString().slice(11, 19) + " UTC");
      } catch {
        if (alive) setErr(true);
      }
    }
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [kind]);

  return (
    <div className="absolute inset-0 grid gap-px overflow-y-auto bg-line text-xs lg:grid-cols-[1fr_18rem]" dir="ltr">
      <section className="bg-black p-3">
        <h4 className="mb-2 flex items-center justify-between tracking-widest text-accent">
          <span>{kind === "world" ? "GDELT · GLOBAL EVENTS" : "GDELT · CYBER & OUTAGES"}</span>
          <span className="text-[10px] text-dim">{updated || "…"}</span>
        </h4>
        {err && !news && <p className="text-danger">{L("تعذر جلب البث الحي - إعادة المحاولة تلقائياً", "Live feed unavailable - retrying automatically")}</p>}
        {!news && !err && <p className="text-dim">{L("جارٍ الاتصال بالبث الحي…", "Connecting to live feed…")}</p>}
        <ul className="space-y-2">
          {news?.map((a) => (
            <li key={a.url} className="border-s-2 border-accent/50 ps-2">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block text-fg hover:text-accent">
                {a.title}
              </a>
              <span className="text-[10px] text-dim">{a.domain} · {a.country} · {a.time.slice(0, 4)}-{a.time.slice(4, 6)}-{a.time.slice(6, 8)} {a.time.slice(9, 11)}:{a.time.slice(11, 13)}</span>
            </li>
          ))}
          {news?.length === 0 && <li className="text-dim">{L("لا أحداث حالياً", "No events right now")}</li>}
        </ul>
      </section>
      {kind === "world" && (
        <aside className="bg-black p-3">
          <h4 className="mb-2 tracking-widest text-danger">USGS · SEISMIC M2.5+</h4>
          <ul className="space-y-1.5">
            {quakes.map((q) => (
              <li key={q.id} className="flex gap-2">
                <span className={`w-9 shrink-0 font-bold ${q.mag >= 5 ? "text-danger" : q.mag >= 4 ? "text-warn" : "text-accent"}`}>M{q.mag.toFixed(1)}</span>
                <span className="min-w-0 truncate text-dim">{q.place}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
