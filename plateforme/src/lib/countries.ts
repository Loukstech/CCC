/** Pays proposés au lancement pilote (cahier des charges, section 5). La liste s'étend avec les fiches pays. */
export const COUNTRIES = [
  // Afrique de l'Ouest
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "NG", name: "Nigéria" },
  { code: "GH", name: "Ghana" },
  { code: "NE", name: "Niger" },
  { code: "BF", name: "Burkina Faso" },
  { code: "CI", name: "Côte d’Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "ML", name: "Mali" },
  { code: "LR", name: "Libéria" },
  { code: "SL", name: "Sierra Leone" },
  // Afrique centrale, de l'Est et australe
  { code: "CM", name: "Cameroun" },
  { code: "GA", name: "Gabon" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "RD Congo" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "Afrique du Sud" },
  // Europe
  { code: "FR", name: "France" },
  { code: "GB", name: "Royaume-Uni (Angleterre)" },
  { code: "BE", name: "Belgique" },
  { code: "CH", name: "Suisse" },
  { code: "DE", name: "Allemagne" },
  { code: "IT", name: "Italie" },
  { code: "ES", name: "Espagne" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Pays-Bas" },
  // Amériques
  { code: "CA", name: "Canada" },
  { code: "US", name: "États-Unis" },
  { code: "BR", name: "Brésil" },
] as const;

/**
 * Devise d'affichage par défaut d'un pays. Le sélecteur de devises propose cinq devises
 * (F CFA, naira, euro, dollar, livre sterling) : les pays sans devise propre dans cette liste passent au dollar.
 * Le F CFA d'Afrique centrale (XAF) vaut exactement le F CFA d'Afrique de l'Ouest (XOF) : on les affiche pareil.
 */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  BJ: "XOF", TG: "XOF", NE: "XOF", BF: "XOF", CI: "XOF", SN: "XOF", ML: "XOF",
  CM: "XOF", GA: "XOF", CG: "XOF",
  FR: "EUR", BE: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR",
  GB: "GBP", NG: "NGN", US: "USD",
};

/** Devise d'un pays (franc CFA, euro, dollar…). */
export const currencyOf = (country: string) => CURRENCY_BY_COUNTRY[country] ?? "USD";

/** Convertit un montant saisi en unités normales vers la plus petite unité (le F CFA n'a pas de centimes). */
export const toMinorUnits = (currency: string, amount: number) =>
  currency === "XOF" ? Math.round(amount) : Math.round(amount * 100);

export const COUNTRY_NAME: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]));

const NAME_EN: Record<string, string> = { GB: "United Kingdom (England)" };

/** Nom d'un pays dans la langue demandée (noms français de la liste, noms anglais fournis par le navigateur). */
export function countryName(code: string, lang: "fr" | "en" = "fr"): string {
  if (lang === "fr") return COUNTRY_NAME[code] ?? code;
  if (NAME_EN[code]) return NAME_EN[code];
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return COUNTRY_NAME[code] ?? code;
  }
}

export const isCountryCode = (v: unknown): v is string =>
  typeof v === "string" && COUNTRIES.some((c) => c.code === v);
