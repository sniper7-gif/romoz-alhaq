"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers";

interface Cam {
  id: string;
  /** YouTube live video id of a public 24/7 camera stream. */
  yt: string;
  name: { ar: string; en: string };
  lat: number;
  lng: number;
}

const CAMS: Cam[] = [
  { id: "CAM-01", yt: "77akujLn4k8", name: { ar: "القدس - الحائط الغربي", en: "Jerusalem - Western Wall" }, lat: 31.7767, lng: 35.2345 },
  { id: "CAM-02", yt: "02bSSZWvc6c", name: { ar: "مكة المكرمة - الحرم", en: "Makkah - Grand Mosque" }, lat: 21.4225, lng: 39.8262 },
  { id: "CAM-03", yt: "zMCea32gpmg", name: { ar: "لندن - أبي رود", en: "London - Abbey Road" }, lat: 51.532, lng: -0.1773 },
  { id: "CAM-04", yt: "VGnFLdQW39A", name: { ar: "نيويورك - تايمز سكوير", en: "New York - Times Square" }, lat: 40.758, lng: -73.9855 },
  { id: "CAM-05", yt: "_k-5U7IeK8g", name: { ar: "طوكيو - الخليج", en: "Tokyo - Bay" }, lat: 35.63, lng: 139.88 },
  { id: "CAM-06", yt: "5uZa3-RMFos", name: { ar: "سيدني - الميناء", en: "Sydney - Harbour" }, lat: -33.8568, lng: 151.2153 },
];
const CYCLE_MS = 45_000;

const dms = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

/** Real public live camera streams (YouTube embeds) with REC telemetry, UTC clock and coordinates on top. */
export default function Cameras() {
  const { lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [clock, setClock] = useState("");
  const cam = CAMS[idx];

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % CAMS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [auto, idx]);

  return (
    <div className="space-y-2 border border-accent/40 bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="glow text-sm tracking-widest">{L("بث الكاميرات الحية الميدانية (Live Surveillance Cameras)", "Live Surveillance Cameras (Field Feed)")}</h3>
        <button
          type="button"
          aria-pressed={auto}
          onClick={() => setAuto((v) => !v)}
          className={`border px-3 py-1 text-xs ${auto ? "border-accent bg-accent/15 text-accent" : "border-line text-dim"}`}
        >
          {auto ? L("تبديل تلقائي ●", "AUTO-CYCLE ●") : L("يدوي", "MANUAL")}
        </button>
      </div>

      <div className="relative aspect-video w-full overflow-hidden border border-line bg-black" dir="ltr">
        <iframe
          key={cam.yt}
          src={`https://www.youtube.com/embed/${cam.yt}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
          title={cam.name[lang]}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2 text-[11px] text-accent">
          <span className="bg-black/60 px-1.5 py-0.5 font-bold">{cam.id} · {cam.name[lang]}</span>
          <span className="flash bg-black/60 px-1.5 py-0.5 font-bold text-danger">REC ●</span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-end justify-between p-2 text-[11px] text-accent">
          <span className="bg-black/60 px-1.5 py-0.5">{clock}</span>
          <span className="bg-black/60 px-1.5 py-0.5">{dms(cam.lat, "N", "S")} {dms(cam.lng, "E", "W")}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="group" aria-label="Cameras">
        {CAMS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={i === idx}
            onClick={() => {
              setIdx(i);
              setAuto(false);
            }}
            className={`border px-2 py-1.5 text-[11px] ${i === idx ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            {c.id}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-dim">
        {L("بث حي حقيقي من كاميرات عامة (مصدرها YouTube). قد يتوقف بث كاميرا إذا أوقفه مالكه.", "Real live public camera streams (via YouTube). A stream can go offline if its owner stops it.")}
      </p>
    </div>
  );
}
