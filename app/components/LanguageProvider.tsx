"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Language } from "../lib/tracker-types";
import { resolveLanguage } from "../lib/locale";

type LanguageState = { language: Language; setLanguage: (value: Language) => void; t: (english: string, chinese: string) => string };
const LanguageContext = createContext<LanguageState>({ language: "en", setLanguage: () => {}, t: english => english });
export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>("en");
  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("lang");
    let saved: string | null = null;
    try { saved = localStorage.getItem("cs2:language"); } catch { /* storage may be blocked */ }
    const selected = resolveLanguage(requested, saved, navigator.languages);
    const timer = window.setTimeout(() => updateLanguage(selected), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);
  function setLanguage(value: Language) {
    updateLanguage(value);
    try { localStorage.setItem("cs2:language", value); } catch { /* retain in-memory choice */ }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", value);
    window.history.replaceState(window.history.state, "", url);
  }
  return <LanguageContext.Provider value={{ language, setLanguage, t: (english, chinese) => language === "zh" ? chinese : english }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
