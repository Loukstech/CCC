import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "ccc_device";

/** Nombre d'appareils autorisés par compte (cahier des charges, section 13 : de 3 à 5, à décider). */
export const DEVICE_LIMIT = Number(process.env.DEVICE_LIMIT ?? 3);

// La clé est propre à (compte, navigateur) : deux comptes sur un même ordinateur ne partagent pas d'appareil.
const hashKey = (userId: string, key: string) => createHash("sha256").update(`${userId}:${key}`).digest("hex");

/** Nom lisible d'un appareil, déduit du navigateur (« Chrome sur Windows »). Aucun identifiant matériel n'est lu. */
export function describeDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navigateur";
  const os = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "appareil inconnu";
  return `${browser} sur ${os}`;
}

export type DeviceRegistration = { ok: true; deviceId: string } | { ok: false };

/**
 * Enregistre le navigateur courant comme appareil du compte (à appeler depuis une action : pose un cookie).
 * Refuse si la limite est atteinte et que cet appareil n'est pas déjà connu.
 */
export async function registerDevice(userId: string): Promise<DeviceRegistration> {
  const jar = await cookies();
  let key = jar.get(COOKIE)?.value;
  if (!key) {
    key = randomBytes(32).toString("hex");
    jar.set(COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }
  const keyHash = hashKey(userId, key);
  const now = new Date();

  const existing = await db.device.findUnique({ where: { keyHash }, select: { id: true, revokedAt: true } });
  if (existing && !existing.revokedAt) {
    await db.device.update({ where: { id: existing.id }, data: { lastSeenAt: now } });
    return { ok: true, deviceId: existing.id };
  }

  const active = await db.device.count({ where: { userId, revokedAt: null } });
  if (active >= DEVICE_LIMIT) return { ok: false };

  const name = describeDevice((await headers()).get("user-agent") ?? "");
  if (existing) {
    await db.device.update({ where: { id: existing.id }, data: { revokedAt: null, name, lastSeenAt: now } });
    return { ok: true, deviceId: existing.id };
  }
  const created = await db.device.create({
    data: { userId, name, platform: "web", keyHash, lastSeenAt: now },
    select: { id: true },
  });
  return { ok: true, deviceId: created.id };
}

export async function clearDeviceCookie() {
  (await cookies()).delete(COOKIE);
}
