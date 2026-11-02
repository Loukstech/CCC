"use client";

import { useSyncExternalStore } from "react";
import { convertMinor, formatMoney, isDisplayCurrency, type DisplayCurrency } from "@/lib/currency";
import { t, type Lang } from "@/lib/i18n";

const KEY = "ccc-currency";
const EVENT = "ccc-currency";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function snapshot(): string {
  try {
    const v = localStorage.getItem(KEY);
    return isDisplayCurrency(v) ? v : "";
  } catch {
    return "";
  }
}

/** Devise d'affichage choisie par le visiteur ; chaîne vide = « devise du pays » (aucune conversion). */
export function useDisplayCurrency(): DisplayCurrency | "" {
  return useSyncExternalStore(subscribe, snapshot, () => "") as DisplayCurrency | "";
}

export function setDisplayCurrency(code: DisplayCurrency | "") {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le choix vaut pour la page en cours seulement */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Montant dans la devise choisie par le visiteur (converti à titre indicatif), sinon dans sa devise d'origine. */
export function Money({ amount, currency, lang }: { amount: number; currency: string; lang: Lang }) {
  const pref = useDisplayCurrency();
  if (pref && pref !== currency) {
    const converted = convertMinor(amount, currency, pref);
    if (converted !== null) return <span title={t(lang, "currency.note")}>≈ {formatMoney(converted, pref, lang)}</span>;
  }
  return <>{formatMoney(amount, currency, lang)}</>;
}

export type PriceSource = {
  access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
  priceAmount: number | null;
  priceCurrency: string | null;
};

/** Étiquette de prix d'une œuvre : « Gratuit », « Abonnement » ou le montant dans la devise choisie. */
export function PriceLabel({ item, lang }: { item: PriceSource; lang: Lang }) {
  if (item.access === "FREE") return <>{t(lang, "price.free")}</>;
  if (item.access === "SUBSCRIPTION") return <>{t(lang, "price.subscription")}</>;
  if (item.priceAmount !== null && item.priceCurrency) {
    return <Money amount={item.priceAmount} currency={item.priceCurrency} lang={lang} />;
  }
  return <>{t(lang, "price.purchase")}</>;
}
