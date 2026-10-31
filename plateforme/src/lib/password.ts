import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  // Même calcul si le compte n'existe pas : on ne révèle pas quels comptes existent.
  const [, saltHex, keyHex] = (stored ?? "scrypt$00$00").split("$");
  const salt = Buffer.from(saltHex ?? "00", "hex");
  const expected = Buffer.from(keyHex ?? "00", "hex");
  const actual = await derive(password, salt);
  return (
    stored !== null &&
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}
