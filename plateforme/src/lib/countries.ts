/** Pays proposés au lancement pilote (cahier des charges, section 5). La liste s'étend avec les fiches pays. */
export const COUNTRIES = [
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "NG", name: "Nigéria" },
  { code: "NE", name: "Niger" },
  { code: "BF", name: "Burkina Faso" },
  { code: "CI", name: "Côte d’Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "CA", name: "Canada" },
  { code: "US", name: "États-Unis" },
] as const;

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  BJ: "XOF", TG: "XOF", NE: "XOF", BF: "XOF", CI: "XOF", SN: "XOF",
  FR: "EUR", BE: "EUR", CA: "CAD", US: "USD", NG: "NGN",
};

/** Devise d'un pays (franc CFA, euro, dollar…). */
export const currencyOf = (country: string) => CURRENCY_BY_COUNTRY[country] ?? "USD";

/** Convertit un montant saisi en unités normales vers la plus petite unité (le F CFA n'a pas de centimes). */
export const toMinorUnits = (currency: string, amount: number) =>
  currency === "XOF" ? Math.round(amount) : Math.round(amount * 100);

export const COUNTRY_NAME: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]));

export const isCountryCode = (v: unknown): v is string =>
  typeof v === "string" && COUNTRIES.some((c) => c.code === v);
