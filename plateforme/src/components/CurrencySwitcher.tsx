"use client";

import { DISPLAY_CURRENCIES, isDisplayCurrency } from "@/lib/currency";
import { t, type Lang } from "@/lib/i18n";
import { setDisplayCurrency, useDisplayCurrency } from "@/components/Money";

/** Sélecteur de devise d'affichage des prix (F CFA, naira, euro, dollar, livre sterling). */
export function CurrencySwitcher({ lang, className = "inline-flex" }: { lang: Lang; className?: string }) {
  const pref = useDisplayCurrency();
  return (
    <label className={`items-center gap-2 text-sm ${className}`}>
      <span className="sr-only">{t(lang, "currency.label")}</span>
      <select
        value={pref}
        onChange={(e) => setDisplayCurrency(isDisplayCurrency(e.target.value) ? e.target.value : "")}
        className="h-10 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-brand-light"
      >
        <option value="">{t(lang, "currency.auto")}</option>
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.short} · {c.name[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
