import "server-only";
import type { VideoProvider } from "@/lib/video";
import { signMuxPlaybackToken } from "@/lib/video/mux-token";

/**
 * Prestataire Mux : flux adaptatif (HLS). `fileKey` est l'identifiant de lecture (« playback ID ») de la vidéo.
 *
 * - Vidéo à lecture **signée** (recommandé) : il faut MUX_SIGNING_KEY_ID et MUX_SIGNING_PRIVATE_KEY ; chaque
 *   visionnage reçoit une adresse avec un jeton à durée limitée, délivré seulement après nos contrôles
 *   (abonnement ou achat, pays, appareil).
 * - Vidéo à lecture **publique** : sans clés, l'adresse est lisible par quiconque la connaît (à réserver aux bandes-annonces).
 */
export const mux: VideoProvider = {
  id: "mux",
  async getPlayback(playbackId) {
    const base = `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`;
    const keyId = process.env.MUX_SIGNING_KEY_ID;
    const privateKeyBase64 = process.env.MUX_SIGNING_PRIVATE_KEY;
    if (!keyId || !privateKeyBase64) return { url: base, kind: "hls" };
    const token = await signMuxPlaybackToken({ playbackId, keyId, privateKeyBase64 });
    return { url: `${base}?token=${token}`, kind: "hls" };
  },
};
