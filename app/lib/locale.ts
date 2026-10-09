import type { Language } from "./tracker-types";
export function resolveLanguage(requested: string | null, saved: string | null, browserLanguages: readonly string[]): Language {
  if (requested === "en" || requested === "zh") return requested;
  if (saved === "en" || saved === "zh") return saved;
  const supported = browserLanguages.find(value => /^(en|zh)(?:-|$)/i.test(value));
  return supported && /^zh(?:-|$)/i.test(supported) ? "zh" : "en";
}
