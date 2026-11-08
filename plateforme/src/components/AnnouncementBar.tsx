import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/settings";

/**
 * Bandeau d'annonce et avertissement de maintenance, pilotés depuis /admin/parametres.
 * Rendu dans le layout racine : un réglage change donc immédiatement tout le site public.
 * Aucune donnée n'est affichée si aucun texte n'est saisi : le bandeau reste invisible.
 */
export async function AnnouncementBar() {
  const [lang, settings] = await Promise.all([getLang(), getSettings()]);
  const maintenance = settings.maintenance_mode === "true";
  const active = settings.announcement_active === "true";
  // Repli sur l'autre langue si une seule des deux versions est renseignée.
  const text = (lang === "fr" ? settings.announcement_fr : settings.announcement_en).trim()
    || (lang === "fr" ? settings.announcement_en : settings.announcement_fr).trim();

  if (!maintenance && (!active || !text)) return null;

  return (
    <div
      role="status"
      className={`ccc-site-chrome w-full border-b px-4 py-2 text-center text-sm font-medium ${
        maintenance
          ? "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          : "border-brand-light/40 bg-brand/10 text-brand"
      }`}
    >
      {maintenance && (
        <strong className="mr-2">
          {lang === "fr" ? "Maintenance en cours —" : "Maintenance in progress —"}
        </strong>
      )}
      {text || (lang === "fr"
        ? "Les nouvelles inscriptions sont temporairement suspendues."
        : "New registrations are temporarily suspended.")}
    </div>
  );
}
