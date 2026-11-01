import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

/**
 * Jeton de lecture signé pour Mux (« signed playback »). Mux fournit la clé privée encodée en base64 :
 * on la décode, on signe un JWT (RS256) dont le sujet est l'identifiant de lecture, valable pour la durée donnée.
 * Sans ce jeton, une vidéo protégée refuse de se lancer : son adresse seule ne suffit plus.
 */
export async function signMuxPlaybackToken(opts: {
  playbackId: string;
  keyId: string;
  privateKeyBase64: string;
  /** Durée de validité en secondes (assez longue pour un film entier). */
  ttlSeconds?: number;
}): Promise<string> {
  const pem = Buffer.from(opts.privateKeyBase64, "base64").toString("utf8");
  // createPrivateKey accepte les deux formats de clé que Mux peut fournir (PKCS#1 et PKCS#8).
  const key = createPrivateKey(pem);
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 6 * 60 * 60);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: opts.keyId })
    .setSubject(opts.playbackId)
    .setAudience("v") // « v » : lecture vidéo
    .setExpirationTime(exp)
    .sign(key);
}
