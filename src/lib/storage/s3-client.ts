/**
 * supportV8 AWS S3 & MinIO Object Storage Client
 * Handles direct file uploads for Knowledge Base documents and attachments.
 */

import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { portalMediaTenantSegment, type PortalMediaKind } from "@/lib/portal/media";

export interface S3UploadResult {
  success: boolean;
  s3Key: string;
  s3Url: string;
  bucket: string;
  sizeBytes: number;
}

export interface PortalAssetUploadResult {
  key: string;
  publicUrl: string;
  sizeBytes: number;
}

export class S3StorageClient {
  private bucket: string;
  private isS3Configured = false;
  private s3Client: S3Client | null = null;
  private endpoint?: string;
  private portalMediaBucket?: string;
  private portalMediaCdnBaseUrl?: string;
  private portalMediaClient: S3Client | null = null;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || "supportv8-kb-documents";
    this.endpoint = process.env.AWS_S3_ENDPOINT;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const config: S3ClientConfig = {
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        };

        if (this.endpoint) {
          config.endpoint = this.endpoint;
          config.forcePathStyle = true;
        }

        this.s3Client = new S3Client(config);
        this.isS3Configured = true;
      } catch (err) {
        console.warn("[S3StorageClient] Failed to initialize S3 client, using fallback:", err);
      }
    }

    this.portalMediaBucket = process.env.PORTAL_MEDIA_S3_BUCKET;
    this.portalMediaCdnBaseUrl = process.env.PORTAL_MEDIA_CDN_BASE_URL;
    if (this.portalMediaBucket && this.portalMediaCdnBaseUrl) {
      const config: S3ClientConfig = {
        region: process.env.PORTAL_MEDIA_AWS_REGION || process.env.AWS_REGION || "ca-central-1",
      };
      const accessKeyId = process.env.PORTAL_MEDIA_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.PORTAL_MEDIA_AWS_SECRET_ACCESS_KEY;
      if (accessKeyId && secretAccessKey) config.credentials = { accessKeyId, secretAccessKey };
      if (process.env.PORTAL_MEDIA_S3_ENDPOINT) {
        config.endpoint = process.env.PORTAL_MEDIA_S3_ENDPOINT;
        config.forcePathStyle = true;
      }
      this.portalMediaClient = new S3Client(config);
    }
  }

  /**
   * Uploads a document buffer to S3 / MinIO storage under the tenant namespace.
   */
  public async uploadDocument(params: {
    tenantId: string;
    filename: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<S3UploadResult> {
    const { tenantId, filename, buffer, contentType = "application/octet-stream" } = params;
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `${tenantId}/kb/${Date.now()}_${sanitizedFilename}`;

    if (this.isS3Configured && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
        })
      );
    }

    const s3Url = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${s3Key}`
      : `https://${this.bucket}.s3.amazonaws.com/${s3Key}`;

    return {
      success: true,
      s3Key,
      s3Url,
      bucket: this.bucket,
      sizeBytes: buffer.length,
    };
  }

  /** Uploads immutable public portal artwork to the bucket behind CloudFront. */
  public async uploadPortalAsset(params: {
    tenantId: string;
    kind: PortalMediaKind;
    buffer: Buffer;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    extension: string;
  }): Promise<PortalAssetUploadResult> {
    if (!this.portalMediaClient || !this.portalMediaBucket || !this.portalMediaCdnBaseUrl) {
      throw new Error("Portal media storage is not configured");
    }
    let cdnBase: URL;
    try {
      cdnBase = new URL(this.portalMediaCdnBaseUrl.endsWith("/") ? this.portalMediaCdnBaseUrl : `${this.portalMediaCdnBaseUrl}/`);
      if (cdnBase.protocol !== "https:" || cdnBase.username || cdnBase.password) throw new Error();
    } catch {
      throw new Error("Portal media CDN is not configured correctly");
    }
    const tenantSegment = portalMediaTenantSegment(params.tenantId);
    const key = `supportv8/portal/${tenantSegment}/${params.kind}/${randomUUID()}.${params.extension}`;
    await this.portalMediaClient.send(new PutObjectCommand({
      Bucket: this.portalMediaBucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
      ContentLength: params.buffer.length,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
      Metadata: { tenant: tenantSegment, purpose: `portal-${params.kind}` },
    }));
    return {
      key,
      publicUrl: new URL(key, cdnBase).toString(),
      sizeBytes: params.buffer.length,
    };
  }
}

export const s3Storage = new S3StorageClient();
