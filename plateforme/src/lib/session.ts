import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "ccc_session";
const DURATION_S = 60 * 60 * 24 * 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(secret);
}

/** `deviceId` : l'appareil autorisé auquel la session est liée (absent si la limite d'appareils est atteinte). */
export async function createSession(userId: string, deviceId: string | null = null) {
  const token = await new SignJWT({ sub: userId, ...(deviceId ? { dev: deviceId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURATION_S}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURATION_S,
  });
}

export async function readSession(): Promise<{ userId: string; deviceId: string | null } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, deviceId: typeof payload.dev === "string" ? payload.dev : null };
  } catch {
    return null;
  }
}

export async function readSessionUserId(): Promise<string | null> {
  return (await readSession())?.userId ?? null;
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}
