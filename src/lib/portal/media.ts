export type PortalMediaKind = "logo" | "hero";

const MEDIA_LIMITS: Record<PortalMediaKind, number> = {
  logo: 2 * 1024 * 1024,
  hero: 8 * 1024 * 1024,
};

const MEDIA_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export class PortalMediaError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 503 = 400) {
    super(message);
    this.name = "PortalMediaError";
  }
}

export function portalMediaKind(value: unknown): PortalMediaKind {
  if (value !== "logo" && value !== "hero") {
    throw new PortalMediaError("Choose either a logo or hero image upload.");
  }
  return value;
}

export function portalMediaTenantSegment(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function detectedMediaType(bytes: Uint8Array): keyof typeof MEDIA_TYPES | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function readPortalMediaFile(
  file: File,
  kind: PortalMediaKind,
): Promise<{ buffer: Buffer; contentType: keyof typeof MEDIA_TYPES; extension: string }> {
  if (!file.size) throw new PortalMediaError("Choose a non-empty image file.");
  const limit = MEDIA_LIMITS[kind];
  if (file.size > limit) {
    throw new PortalMediaError(
      `${kind === "logo" ? "Logo" : "Hero"} images must be ${Math.round(limit / 1024 / 1024)} MB or smaller.`,
      413,
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectedMediaType(buffer);
  if (!detected || !(file.type in MEDIA_TYPES) || file.type !== detected) {
    throw new PortalMediaError("Upload a valid PNG, JPEG, or WebP image.");
  }
  return { buffer, contentType: detected, extension: MEDIA_TYPES[detected] };
}
