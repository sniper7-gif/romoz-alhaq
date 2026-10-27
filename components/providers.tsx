"use client";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { dict, type Key, type Lang } from "@/lib/i18n";
import { usePersisted } from "@/lib/store";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = usePersisted<Lang>("lang", "ar");

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback((k: Key) => dict[lang][k], [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useT must be used inside I18nProvider");
  return v;
}
