"use client";
import Image from "next/image";
import { useState } from "react";

const SRC = { hood: "/logo-hood.png", eagle: "/logo-eagle.png" } as const;

/** Official brand marks. Drop the files at public/logo-hood.png and public/logo-eagle.png. */
export default function Logo({ kind, size, className = "" }: { kind: keyof typeof SRC; size: number; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`grid place-items-center rounded-full border border-accent/60 text-accent/70 text-[10px] tracking-widest ${className}`}
        role="img"
        aria-label={kind}
      >
        {kind.toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={SRC[kind]}
      alt={kind === "eagle" ? "Symbols of Truth eagle emblem" : "Symbols of Truth hood emblem"}
      width={size}
      height={size}
      priority
      unoptimized
      onError={() => setMissing(true)}
      className={`rounded-full object-contain shadow-[0_0_40px_rgba(0,255,65,.45)] ${className}`}
    />
  );
}
