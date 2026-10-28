"use client";
import { useT } from "@/components/providers";

export const TELEGRAM_URL = "https://t.me/+xpPkpobTB8AwNzk0";

/** Cyberpunk Telegram channel link, shown to every role. */
export default function TelegramButton({ compact = false }: { compact?: boolean }) {
  const { lang } = useT();
  const title = lang === "ar" ? "قناة العمليات المشتركة - تيليجرام" : "Joint Ops Channel - Telegram";
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Telegram Channel"
      className={`group flex items-center gap-2 border border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_12px_#00e5ff55] transition-colors hover:bg-[#00e5ff]/25 ${
        compact ? "px-3 py-1.5 text-[11px]" : "w-full px-3 py-2.5 text-xs"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-current" aria-hidden>
        <path d="M22 3 2 11l7 2.5L11 21l3-6 5 4z" />
      </svg>
      <span className="min-w-0 flex-1 truncate font-bold tracking-wider">{compact ? "Telegram" : title}</span>
      {!compact && <span className="text-[9px] text-[#00e5ff]/70" dir="ltr">t.me ↗</span>}
    </a>
  );
}
