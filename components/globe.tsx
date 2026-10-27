"use client";
import { useEffect, useRef } from "react";
import { SEVERITY_COLOR, type Threat } from "@/lib/data";

type V3 = [number, number, number];
const RAD = Math.PI / 180;
const TILT = 22 * RAD;

const vec = (lat: number, lng: number): V3 => [Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lng * RAD)];

/** Rotate around the vertical axis by `rot`, then tilt toward the viewer. */
function view(v: V3, rot: number): V3 {
  const x = v[0] * Math.cos(rot) + v[2] * Math.sin(rot);
  const z = -v[0] * Math.sin(rot) + v[2] * Math.cos(rot);
  return [x, v[1] * Math.cos(TILT) - z * Math.sin(TILT), v[1] * Math.sin(TILT) + z * Math.cos(TILT)];
}

function slerp(a: V3, b: V3, t: number, lift: number): V3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const w = Math.acos(dot) || 1e-6;
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  const h = 1 + Math.sin(Math.PI * t) * lift * w;
  return [(a[0] * ka + b[0] * kb) * h, (a[1] * ka + b[1] * kb) * h, (a[2] * ka + b[2] * kb) * h];
}

interface Props {
  threats: Threat[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Drag-to-rotate 3D globe with animated attack arcs between threat sites. */
export default function Globe({ threats, selectedId, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ threats, selectedId, onSelect });
  const rot = useRef(0.6);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const hits = useRef<{ id: string; x: number; y: number }[]>([]);

  useEffect(() => {
    live.current = { threats, selectedId, onSelect };
  });

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    const ctx = el?.getContext("2d");
    if (!el || !box || !ctx) return;
    let size = 0;
    let raf = 0;
    let last = 0;

    const resize = () => {
      size = Math.max(240, Math.min(box.clientWidth, 640));
      const dpr = window.devicePixelRatio || 1;
      el.width = size * dpr;
      el.height = size * dpr;
      el.style.width = el.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(now - last, 50);
      last = now;
      if (!drag.current) rot.current += dt * 0.00012;

      const { threats: list, selectedId: sel } = live.current;
      const R = size * 0.42;
      const cx = size / 2;
      const cy = size / 2;
      const px = (p: V3) => [cx + p[0] * R, cy - p[1] * R] as const;
      ctx.clearRect(0, 0, size, size);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(0,255,65,0.10)");
      glow.addColorStop(1, "rgba(0,255,65,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,18,6,0.85)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,255,65,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.strokeStyle = "rgba(0,255,65,0.16)";
      ctx.lineWidth = 1;
      const line = (pts: V3[]) => {
        ctx.beginPath();
        let pen = false;
        for (const p of pts) {
          const v = view(p, rot.current);
          if (v[2] < 0) {
            pen = false;
            continue;
          }
          const [x, y] = px(v);
          if (pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        }
        ctx.stroke();
      };
      for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => vec(lat, i * 5 - 180)));
      for (let lng = -180; lng < 180; lng += 30) line(Array.from({ length: 37 }, (_, i) => vec(i * 5 - 90, lng)));

      const sites = list.map((t) => ({ t, v: vec(t.lat, t.lng) }));
      ctx.lineWidth = 1.2;
      sites.forEach((a, i) => {
        const b = sites[(i + 1) % sites.length];
        if (a === b) return;
        ctx.strokeStyle = `${SEVERITY_COLOR[a.t.severity]}66`;
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= 32; k++) {
          const v = view(slerp(a.v, b.v, k / 32, 0.3), rot.current);
          if (v[2] < 0) {
            pen = false;
            continue;
          }
          const [x, y] = px(v);
          if (pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        }
        ctx.stroke();
        const head = view(slerp(a.v, b.v, ((now / 2600 + i * 0.27) % 1), 0.3), rot.current);
        if (head[2] > 0) {
          const [x, y] = px(head);
          ctx.fillStyle = SEVERITY_COLOR[a.t.severity];
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const pulse = (now % 1600) / 1600;
      const found: typeof hits.current = [];
      for (const { t, v } of sites) {
        const p = view(v, rot.current);
        if (p[2] < 0.05) continue;
        const [x, y] = px(p);
        const c = SEVERITY_COLOR[t.severity];
        found.push({ id: t.id, x, y });
        ctx.strokeStyle = c;
        ctx.globalAlpha = 1 - pulse;
        ctx.beginPath();
        ctx.arc(x, y, 4 + pulse * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, t.id === sel ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        if (t.id === sel) {
          ctx.strokeStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      hits.current = found;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="grid w-full place-items-center">
      <canvas
        ref={canvas}
        role="img"
        aria-label="3D cyber threat globe"
        className="cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          if (Math.abs(dx) > 2) drag.current.moved = true;
          rot.current += dx * 0.008;
          drag.current.x = e.clientX;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          const hit = hits.current.map((h) => ({ id: h.id, d: Math.hypot(h.x - x, h.y - y) })).sort((a, b) => a.d - b.d)[0];
          if (hit && hit.d < 16) live.current.onSelect(hit.id);
        }}
        onPointerCancel={() => (drag.current = null)}
      />
    </div>
  );
}
