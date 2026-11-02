import type { Lang } from "@/lib/i18n";

/** Les cinq devises proposées dans le sélecteur d'affichage. */
export const DISPLAY_CURRENCIES = [
  { code: "XOF", short: "FCFA", name: { fr: "Franc CFA", en: "CFA franc" } },
  { code: "NGN", short: "₦", name: { fr: "Naira nigérian", en: "Nigerian naira" } },
  { code: "EUR", short: "€", name: { fr: "Euro", en: "Euro" } },
  { code: "USD", short: "$", name: { fr: "Dollar américain", en: "US dollar" } },
  { code: "GBP", short: "£", name: { fr: "Livre sterling", en: "Pound sterling" } },
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]["code"];

export const isDisplayCurrency = (v: unknown): v is DisplayCurrency =>
  DISPLAY_CURRENCIES.some((c) => c.code === v);

/**
 * Valeur de 1 unité de chaque devise en F CFA. L'euro est à parité fixe avec le F CFA (655,957) ; les autres
 * taux sont INDICATIFS et doivent être remis à jour (ou remplacés par un taux journalier d'un fournisseur).
 * Ils ne servent qu'à l'affichage : le paiement est toujours facturé dans la devise du prix d'origine.
 */
export const XOF_PER_UNIT: Record<string, number> = {
  XOF: 1,
  XAF: 1,
  EUR: 655.957,
  USD: 600,
  GBP: 770,
  NGN: 0.39,
};

/** Le F CFA n'a pas de centimes ; les autres devises sont stockées en centièmes. */
const digits = (currency: string) => (currency === "XOF" || currency === "XAF" ? 0 : 2);

/** Convertit un montant (plus petite unité) d'une devise à une autre. Null si une devise est inconnue. */
export function convertMinor(amount: number, from: string, to: string): number | null {
  const rf = XOF_PER_UNIT[from];
  const rt = XOF_PER_UNIT[to];
  if (!rf || !rt) return null;
  const major = (amount / 10 ** digits(from)) * rf / rt;
  return Math.round(major * 10 ** digits(to));
}

/** Affiche un montant (plus petite unité) : « 2 000 FCFA », « €3.05 », « 7 690 ₦ »… */
export function formatMoney(amount: number, currency: string, lang: Lang): string {
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const major = amount / 10 ** digits(currency);
  if (currency === "XOF" || currency === "XAF") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major)} FCFA`;
  }
  const whole = Number.isInteger(major) || currency === "NGN";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(major);
}
