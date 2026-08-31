import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

/**
 * Generates a salted scrypt hash of the plaintext password.
 * Output format: `<saltHex>:<derivedKeyHex>`
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored `<saltHex>:<derivedKeyHex>` hash in constant time.
 */
export function verifyPasswordHash(password: string, passwordHash: string): boolean {
  if (!password || !passwordHash) return false;
  const [salt, key] = passwordHash.split(":");
  if (!salt || !key) return false;

  try {
    const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
    const keyBuf = Buffer.from(key, "hex");
    const derivedBuf = Buffer.from(derivedKey, "hex");
    if (keyBuf.length !== derivedBuf.length) return false;
    return timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}
