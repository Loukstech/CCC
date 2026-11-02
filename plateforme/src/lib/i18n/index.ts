import { fr } from "./fr";
import { en } from "./en";

export type Lang = "fr" | "en";
export type Key = keyof typeof fr;

export const LANGS: readonly Lang[] = ["fr", "en"];
export const LANG_COOKIE = "ccc_lang";
export const isLang = (v: unknown): v is Lang => v === "fr" || v === "en";

const DICT: Record<Lang, Record<Key, string>> = { fr, en };

/** Traduit une clé. Les variables s'écrivent {nom} dans le texte. */
export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? fr[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
