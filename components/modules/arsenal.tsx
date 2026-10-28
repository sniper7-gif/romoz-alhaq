"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import ExifScrubber from "@/components/modules/arsenal/exif-scrubber";
import IpRecon from "@/components/modules/arsenal/ip-recon";
import Vault from "@/components/modules/arsenal/vault";
import type { Key } from "@/lib/i18n";

const SUBS: { id: "exif" | "recon" | "vault"; label: Key; icon: string }[] = [
  { id: "exif", label: "arsenalExif", icon: "🖼️" },
  { id: "recon", label: "arsenalRecon", icon: "🌐" },
  { id: "vault", label: "arsenalVault", icon: "🔐" },
];

export default function ArsenalModule() {
  const { t } = useT();
  const [sub, setSub] = useState<(typeof SUBS)[number]["id"]>("exif");

  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabArsenal")}</h2>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("tabArsenal")}>
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sub === s.id}
            onClick={() => setSub(s.id)}
            className={`border px-4 py-2 text-xs ${sub === s.id ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:text-fg"}`}
          >
            <span aria-hidden>{s.icon}</span> {t(s.label)}
          </button>
        ))}
      </div>
      <div className="border border-line bg-panel p-4" role="tabpanel">
        {sub === "exif" && <ExifScrubber />}
        {sub === "recon" && <IpRecon />}
        {sub === "vault" && <Vault />}
      </div>
    </section>
  );
}
