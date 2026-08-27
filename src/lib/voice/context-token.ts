/**
 * supportV8 Voice Context Token Service
 * Cryptographically signed ephemeral tokens securing real-time voice sessions.
 * Directly based on GrowthV8 Voice Architecture (src/voice/context-token.ts).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { VoiceContextTokenPayload } from "./types";

const VOICE_SECRET = process.env.VOICE_CONTEXT_TOKEN_SECRET || "servicev8-voice-context-secret-key-default-2026";

export function signVoiceContextToken(payload: VoiceContextTokenPayload): string {
  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload, "utf-8").toString("base64url");
  const signature = createHmac("sha256", VOICE_SECRET).update(base64Payload).digest("base64url");
  return `${base64Payload}.${signature}`;
}

export function verifyVoiceContextToken(token: string): VoiceContextTokenPayload | null {
  try {
    const [base64Payload, signature] = token.split(".");
    if (!base64Payload || !signature) return null;

    const expectedSig = createHmac("sha256", VOICE_SECRET).update(base64Payload).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const json = Buffer.from(base64Payload, "base64url").toString("utf-8");
    const payload: VoiceContextTokenPayload = JSON.parse(json);

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
