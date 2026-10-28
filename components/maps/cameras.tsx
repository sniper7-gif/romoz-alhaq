"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";

interface Cam {
  id: string;
  name: { ar: string; en: string };
  lat: number;
  lng: number;
  /** Scene seed: tint and the number of moving contacts. */
  tint: [number, number, number];
  contacts: number;
}

const CAMS: Cam[] = [
  { id: "CAM-01", name: { ar: "البوابة الشمالية - طرابلس", en: "North Gate - Tripoli" }, lat: 32.8872, lng: 13.1913, tint: [0, 255, 65], contacts: 3 },
  { id: "CAM-02", name: { ar: "الميناء البحري", en: "Harbour Watch" }, lat: 32.9025, lng: 13.1803, tint: [0, 229, 255], contacts: 5 },
  { id: "CAM-03", name: { ar: "الطريق الساحلي - سرت", en: "Coastal Road - Sirte" }, lat: 31.2089, lng: 16.5887, tint: [255, 176, 32], contacts: 4 },
  { id: "CAM-04", name: { ar: "المطار - بنغازي", en: "Airfield - Benghazi" }, lat: 32.0968, lng: 20.2695, tint: [0, 255, 65], contacts: 2 },
  { id: "CAM-05", name: { ar: "نقطة الصحراء - سبها", en: "Desert Post - Sabha" }, lat: 27.0377, lng: 14.4283, tint: [255, 90, 60], contacts: 3 },
];
const CYCLE_MS = 8000;

const dms = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

function draw(g: CanvasRenderingContext2D, w: number, h: number, cam: Cam, ms: number, seed: number) {
  const [r, gr, b] = cam.tint;
  g.fillStyle = `rgb(${r * 0.06},${gr * 0.06},${b * 0.06})`;
  g.fillRect(0, 0, w, h);
  // horizon + ground gradient
  const grad = g.createLinearGradient(0, h * 0.45, 0, h);
  grad.addColorStop(0, `rgba(${r},${gr},${b},0.04)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0.22)`);
  g.fillStyle = grad;
  g.fillRect(0, h * 0.45, w, h * 0.55);
  g.strokeStyle = `rgba(${r},${gr},${b},0.18)`;
  g.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const x = (i / 12) * w;
    g.beginPath();
    g.moveTo(w / 2, h * 0.45);
    g.lineTo((x - w / 2) * 4 + w / 2, h);
    g.stroke();
  }
  // structures
  g.fillStyle = `rgba(${r},${gr},${b},0.12)`;
  for (let i = 0; i < 7; i++) {
    const bw = 40 + ((seed * (i + 3) * 37) % 70);
    const bh = 30 + ((seed * (i + 5) * 53) % 90);
    g.fillRect(((i * 131 + seed * 17) % (w - bw)) | 0, h * 0.45 - bh, bw, bh);
  }
  // moving contacts
  for (let i = 0; i < cam.contacts; i++) {
    const sp = 0.012 + ((i * 7 + seed) % 5) * 0.006;
    const x = (((ms * sp + i * 197 + seed * 41) % (w + 80)) + w + 80) % (w + 80) - 40;
    const y = h * (0.6 + ((i * 0.13 + seed * 0.07) % 0.3));
    const s = 10 + (y / h) * 18;
    g.fillStyle = `rgba(${r},${gr},${b},0.85)`;
    g.fillRect(x - s * 0.3, y - s * 1.6, s * 0.6, s * 1.6);
    g.beginPath();
    g.arc(x, y - s * 1.9, s * 0.32, 0, 7);
    g.fill();
    if (i === 0) {
      g.strokeStyle = "#ff3b3b";
      g.lineWidth = 1.5;
      g.strokeRect(x - s * 0.8, y - s * 2.4, s * 1.6, s * 2.6);
    }
  }
  // sensor noise + scanlines
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r},${gr},${b},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  }
  g.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  const sweep = (ms / 6) % (h + 60);
  g.fillStyle = `rgba(${r},${gr},${b},0.07)`;
  g.fillRect(0, sweep - 30, w, 30);
}

export default function Cameras() {
  const { lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [clock, setClock] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
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

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    let raf = 0;
    const loop = (ms: number) => {
      draw(g, c.width, c.height, cam, ms, idx + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cam, idx]);

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
        <canvas ref={canvas} width={800} height={450} className="size-full" aria-label={cam.name[lang]} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2 text-[11px] text-accent">
          <span className="bg-black/60 px-1.5 py-0.5 font-bold">{cam.id} · {cam.name[lang]}</span>
          <span className="flash bg-black/60 px-1.5 py-0.5 font-bold text-danger">REC ●</span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-2 text-[11px] text-accent">
          <span className="bg-black/60 px-1.5 py-0.5">{clock}</span>
          <span className="bg-black/60 px-1.5 py-0.5">{dms(cam.lat, "N", "S")} {dms(cam.lng, "E", "W")}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="group" aria-label="Cameras">
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
      <p className="text-[10px] text-dim">{L("عرض بصري محاكى للمراقبة الميدانية - ليس بثاً حقيقياً من كاميرات فعلية.", "Simulated surveillance display - not a feed from physical cameras.")}</p>
    </div>
  );
}
