import "server-only";

/**
 * Coordonnées publiques et crédits du site.
 *
 * Le cahier des charges (§ « Informations à compléter ») laisse l'e-mail, le téléphone et le
 * WhatsApp au porteur du projet. Toutes les valeurs sont donc surchargeables par variable
 * d'environnement : aucun code, aucune base de données, il suffit de les définir dans Vercel
 * puis de redéployer. Tant qu'elles sont absentes, on affiche des valeurs de démonstration
 * explicites (domaine réservé `example`, qui n'envoie aucun courrier).
 *
 * Ce module est `server-only` : les composants clients reçoivent les valeurs par props.
 */

const value = (name: string, fallback = "") => process.env[name]?.trim() || fallback;

/** Nom du studio / prestataire qui a développé l'application (crédit public du pied de page). */
export const DEVELOPER = "MkEnterprise";

/** Première année de publication : le copyright affiché ne descend jamais en dessous. */
export const LAUNCH_YEAR = 2026;

export const SITE = {
  name: "CCC",
  tagline: "Lire · Regarder · Transmettre",
  developer: DEVELOPER,
  /** Lien facultatif vers le site du prestataire ; sans valeur, le crédit reste du texte. */
  developerUrl: value("CCC_DEVELOPER_URL"),
  contactEmail: value("CCC_CONTACT_EMAIL", "contact@ccc.example"),
  contactPhone: value("CCC_CONTACT_PHONE"),
  /** Numéro international sans le « + » ni les espaces, ex. 22901000000. */
  whatsapp: value("CCC_CONTACT_WHATSAPP"),
} as const;

/** Vrai tant que le porteur du projet n'a pas fourni ses vraies coordonnées. */
export const isDemoContact = (): boolean => SITE.contactEmail.endsWith(".example");

/** Lien WhatsApp durable (`wa.me`), ou null si aucun numéro n'est configuré. */
export function whatsappHref(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Lien `tel:` ou null si aucun numéro n'est configuré. */
export function phoneHref(number: string): string | null {
  return number.trim() ? `tel:${number.replace(/[^+\d]/g, "")}` : null;
}

/**
 * Millésime du copyright, calculé une fois au chargement du module (pas pendant le rendu :
 * la règle eslint `react-hooks/purity` refuse `Date` dans un composant serveur).
 * « 2026 », puis « 2026–2027 » à partir de l'année suivante.
 */
const currentYear = new Date().getFullYear();
export const COPYRIGHT_YEAR = currentYear > LAUNCH_YEAR ? `${LAUNCH_YEAR}–${currentYear}` : String(LAUNCH_YEAR);
