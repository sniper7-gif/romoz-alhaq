"use client";
import { useT } from "@/components/providers";

/** Shared frame for both gates: language toggle plus the terminal card. `leaving` plays the exit warp. */
export default function GateShell({ leaving, children }: { leaving: boolean; children: React.ReactNode }) {
  const { lang, setLang } = useT();
  return (
    <main className={`grid min-h-dvh place-items-center p-4 ${leaving ? "warp-out" : "fade-in"}`}>
      <button
        type="button"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="fixed end-4 top-4 z-10 border border-line px-3 py-1 text-xs text-dim hover:border-accent hover:text-accent"
      >
        {lang === "ar" ? "EN" : "عربي"}
      </button>
      <section className="w-full max-w-md border border-accent/40 bg-panel p-6 shadow-[0_0_60px_rgba(0,255,65,.12)] sm:p-8">{children}</section>
    </main>
  );
}
