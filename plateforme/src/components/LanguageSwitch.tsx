import { setLang } from "@/app/actions/lang";
import { LANGS, t, type Lang } from "@/lib/i18n";

/** Bascule FR / EN : chaque bouton enregistre la langue dans un cookie, sans JavaScript nécessaire. */
export function LanguageSwitch({ lang, className = "inline-flex" }: { lang: Lang; className?: string }) {
  return (
    <form action={setLang} role="group" aria-label={t(lang, "lang.label")} className={`rounded-full border border-line bg-surface p-0.5 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="submit"
          name="lang"
          value={l}
          lang={l}
          aria-pressed={l === lang}
          className={`h-9 rounded-full px-3 text-xs font-bold tracking-wide uppercase transition-colors ${
            l === lang ? "bg-brand text-white" : "text-ink/70 hover:text-brand"
          }`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}
