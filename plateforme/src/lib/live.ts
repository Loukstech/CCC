import "server-only";
import { getActiveSubscription } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";

/**
 * Lot 8 — événements en direct. Le flux vidéo n'est JAMAIS hébergé par Vercel : il vient d'un
 * prestataire externe (iframe d'une plateforme de live, ou HLS Mux). Ce module ne fait que
 * contrôler qui peut voir quoi et filtrer les URL avant de les placer dans une iframe.
 */

/** Hôtes autorisés dans une iframe. Liste fermée : une URL arbitraire n'est jamais acceptée. */
const EMBED_HOSTS = new Set([
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "facebook.com",
  "fb.watch",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "player.twitch.tv",
]);

/**
 * Valide une URL d'intégration : HTTPS obligatoire et hôte connu. Sans cette liste, un compte
 * éditeur pourrait injecter n'importe quelle page dans le site (hameçonnage, scripts, etc.).
 */
export function safeEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const allowed = [...EMBED_HOSTS].some((h) => host === h || host.endsWith(`.${h}`));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Identifiant de lecture Mux : lettres, chiffres, tirets et soulignés uniquement (jamais une URL). */
export const isPlaybackId = (v: string): boolean => /^[A-Za-z0-9_-]{6,200}$/.test(v);

export type LiveGate = { ok: true } | { ok: false; reason: "login" | "subscription" };

/** Visibilité d'un direct : PUBLIC, membres connectés, ou abonnés en cours de validité. */
export async function canViewLive(visibility: string, user: CurrentUser | null): Promise<LiveGate> {
  if (visibility === "PUBLIC") return { ok: true };
  if (!user) return { ok: false, reason: "login" };
  if (user.staffRole) return { ok: true }; // le personnel peut toujours prévisualiser
  if (visibility === "AUTHENTICATED") return { ok: true };
  if (visibility === "SUBSCRIBERS") {
    return (await getActiveSubscription(user.id)) ? { ok: true } : { ok: false, reason: "subscription" };
  }
  return { ok: false, reason: "login" };
}

/** Statuts visibles sur la page publique ; un brouillon n'est ouvert qu'au personnel. */
export const PUBLIC_LIVE_STATUSES = ["LIVE", "SCHEDULED", "ENDED"] as const;
