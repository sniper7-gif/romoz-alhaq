"use client";
import { useEffect, useRef } from "react";
import { useT } from "@/components/providers";

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="fade-in w-full max-w-md max-h-[90dvh] overflow-y-auto border border-accent/50 bg-panel p-5 shadow-[0_0_40px_rgba(0,255,65,.15)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="glow text-sm tracking-widest">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="px-2 text-dim hover:text-accent">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full bg-black/60 border border-line px-3 py-2 text-sm text-fg outline-none placeholder:text-dim/60 focus:border-accent";
export const btnCls =
  "border border-accent/60 px-4 py-2 text-xs tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
