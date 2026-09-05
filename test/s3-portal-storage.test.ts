import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-s3", async (original) => {
  const actual = await original<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      send = send;
    },
  };
});

const portalEnvironment = {
  PORTAL_MEDIA_S3_BUCKET: "sv8-assets",
  PORTAL_MEDIA_CDN_BASE_URL: "https://cdn.servicev8.com",
  PORTAL_MEDIA_AWS_REGION: "ca-central-1",
  PORTAL_MEDIA_AWS_ACCESS_KEY_ID: "test-access-key",
  PORTAL_MEDIA_AWS_SECRET_ACCESS_KEY: "test-secret-key",
};

describe("portal media S3 storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    for (const [name, value] of Object.entries(portalEnvironment)) vi.stubEnv(name, value);
    send.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps each tenant in its own immutable CloudFront object prefix", async () => {
    const { S3StorageClient } = await import("@/lib/storage/s3-client");
    const storage = new S3StorageClient();

    const alpha = await storage.uploadPortalAsset({
      tenantId: "tenant_alpha",
      kind: "logo",
      buffer: Buffer.from("alpha"),
      contentType: "image/png",
      extension: "png",
    });
    const meridian = await storage.uploadPortalAsset({
      tenantId: "tenant_meridian",
      kind: "hero",
      buffer: Buffer.from("meridian"),
      contentType: "image/webp",
      extension: "webp",
    });

    expect(alpha.key).toMatch(/^supportv8\/portal\/tenant_alpha\/logo\/[0-9a-f-]+\.png$/);
    expect(alpha.publicUrl).toBe(`https://cdn.servicev8.com/${alpha.key}`);
    expect(meridian.key).toMatch(/^supportv8\/portal\/tenant_meridian\/hero\/[0-9a-f-]+\.webp$/);
    expect(meridian.publicUrl).toBe(`https://cdn.servicev8.com/${meridian.key}`);
    expect(alpha.key).not.toContain("tenant_meridian");
    expect(meridian.key).not.toContain("tenant_alpha");

    const firstCommand = send.mock.calls[0]?.[0];
    const secondCommand = send.mock.calls[1]?.[0];
    expect(firstCommand.input).toEqual(expect.objectContaining({
      Bucket: "sv8-assets",
      Key: alpha.key,
      Body: Buffer.from("alpha"),
      ContentType: "image/png",
      ContentLength: 5,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
      Metadata: { tenant: "tenant_alpha", purpose: "portal-logo" },
    }));
    expect(secondCommand.input).toEqual(expect.objectContaining({
      Bucket: "sv8-assets",
      Key: meridian.key,
      ContentType: "image/webp",
      Metadata: { tenant: "tenant_meridian", purpose: "portal-hero" },
    }));
  });

  it("rejects missing or unsafe CDN configuration before uploading", async () => {
    vi.stubEnv("PORTAL_MEDIA_CDN_BASE_URL", "http://cdn.servicev8.com");
    const { S3StorageClient } = await import("@/lib/storage/s3-client");
    const storage = new S3StorageClient();

    await expect(storage.uploadPortalAsset({
      tenantId: "tenant_alpha",
      kind: "logo",
      buffer: Buffer.from("alpha"),
      contentType: "image/png",
      extension: "png",
    })).rejects.toThrow("Portal media CDN is not configured correctly");
    expect(send).not.toHaveBeenCalled();
  });

  it("propagates S3 upload failures and does not return a public URL", async () => {
    send.mockRejectedValueOnce(new Error("S3 unavailable"));
    const { S3StorageClient } = await import("@/lib/storage/s3-client");
    const storage = new S3StorageClient();

    await expect(storage.uploadPortalAsset({
      tenantId: "tenant_alpha",
      kind: "hero",
      buffer: Buffer.from("hero"),
      contentType: "image/jpeg",
      extension: "jpg",
    })).rejects.toThrow("S3 unavailable");
  });
});
