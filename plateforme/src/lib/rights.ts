import "server-only";
import { cookies, headers } from "next/headers";
import { isCountryCode } from "@/lib/countries";

export const COUNTRY_COOKIE = "ccc_country";

// En-têtes posés par les hébergeurs qui connaissent le pays du visiteur (Vercel, Cloudflare).
const GEO_HEADERS = ["x-vercel-ip-country", "cf-ipcountry"];

/**
 * Pays de l'utilisateur : celui de son profil, sinon celui qu'il a choisi, sinon celui deviné par l'hébergeur.
 * Null si inconnu : la disponibilité d'une œuvre ne peut alors pas être confirmée.
 */
export async function getCountry(user: { country: string | null } | null): Promise<string | null> {
  const profile = user?.country?.toUpperCase();
  if (isCountryCode(profile)) return profile;

  const chosen = (await cookies()).get(COUNTRY_COOKIE)?.value;
  if (isCountryCode(chosen)) return chosen;

  const h = await headers();
  for (const name of GEO_HEADERS) {
    const v = h.get(name)?.toUpperCase();
    if (isCountryCode(v)) return v;
  }
  return null;
}

type License = { countries: string[]; allowWeb: boolean; startsAt: Date | null; endsAt: Date | null };

/**
 * Règle du registre des licences (section 17) : l'œuvre est disponible si une licence couvre le pays,
 * le web, et la date du jour. Cette règle est appliquée par le serveur, jamais par l'écran seul.
 */
export function isAvailable(licenses: License[], country: string, now: Date): boolean {
  return licenses.some(
    (l) =>
      l.allowWeb &&
      l.countries.includes(country) &&
      (!l.startsAt || l.startsAt <= now) &&
      (!l.endsAt || l.endsAt >= now),
  );
}
