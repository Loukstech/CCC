/**
 * Envoi des événements d'audience depuis le navigateur.
 *
 * Ce module est volontairement distinct de `lib/audience.ts` (qui est `server-only`) : il ne
 * contient aucune logique Prisma et peut être importé par les composants clients. Un événement
 * `download` n'est PAS exposé ici : il est compté par la route de fichier, après vérification
 * des droits, afin qu'un simple POST navigateur ne puisse pas gonfler ce compteur.
 */

export type AudienceClientKind = "view" | "play";

/** Fenêtre anti-doublon : un re-render, un retour arrière ou une reprise après publicité ne recrédite pas. */
const COOLDOWN_MS: Record<AudienceClientKind, number> = {
  view: 15 * 60_000,
  play: 2 * 60_000,
};

/**
 * Déclare un événement d'audience. Ne lance jamais d'exception : la mesure ne doit jamais
 * empêcher l'affichage d'une fiche, la lecture d'un livre ou le démarrage d'une vidéo.
 */
export function reportAudience(workId: string, kind: AudienceClientKind): void {
  if (typeof window === "undefined" || !workId) return;
  try {
    const key = `ccc-audience-${kind}-${workId}`;
    const at = Date.now();
    const previous = Number(sessionStorage.getItem(key) ?? 0);
    if (Number.isFinite(previous) && at - previous < COOLDOWN_MS[kind]) return;
    sessionStorage.setItem(key, String(at));
    void fetch("/api/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId, kind }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => null);
  } catch {
    /* stockage de session ou réseau indisponible : on ignore silencieusement */
  }
}
