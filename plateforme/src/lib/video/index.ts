import "server-only";
import { basename } from "node:path";
import { mux } from "@/lib/video/mux";

export type Playback = {
  url: string;
  /** `mp4` : fichier lu directement ; `hls` : flux adaptatif (prestataires de streaming). */
  kind: "mp4" | "hls";
};

/**
 * Un prestataire vidéo. Le reste du site ne connaît que cette interface : brancher Bunny Stream, Mux ou
 * Cloudflare Stream revient à écrire un adaptateur (il renvoie une adresse de lecture signée et à durée courte)
 * et à changer VIDEO_PROVIDER. `fileKey` est l'identifiant de la vidéo chez le prestataire.
 */
export interface VideoProvider {
  id: string;
  getPlayback(fileKey: string, viewer: { userId: string }): Promise<Playback>;
}

/**
 * Prestataire de démonstration : de courts fichiers MP4 servis avec le site (dossier public/demo-video).
 * Gratuit et sans compte, mais **sans protection** : l'adresse du fichier est publique. Les droits (abonnement,
 * pays, appareil) sont appliqués par la page de lecture, pas par le fichier. À remplacer avant le lancement.
 */
const demo: VideoProvider = {
  id: "demo",
  async getPlayback(fileKey) {
    return { url: `/demo-video/${basename(fileKey)}`, kind: "mp4" };
  },
};

const PROVIDERS: Record<string, VideoProvider> = { demo, mux };

/**
 * Prestataire d'une vidéo, selon sa clé : un nom de fichier `.mp4` est une vidéo de démonstration ;
 * toute autre clé est un identifiant du prestataire configuré (VIDEO_PROVIDER, Mux par défaut).
 * Les deux peuvent donc coexister pendant la transition.
 */
export function getVideoProvider(fileKey: string): VideoProvider {
  if (/\.mp4$/i.test(fileKey)) return demo;
  const id = process.env.VIDEO_PROVIDER ?? "mux";
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Prestataire vidéo inconnu : ${id}`);
  return provider;
}

/** Une clé vidéo valide : lettres, chiffres, points, tirets (pas de chemin). */
export const isVideoKey = (v: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(v);
