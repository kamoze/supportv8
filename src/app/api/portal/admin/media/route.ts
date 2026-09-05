import { NextResponse } from "next/server";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";
import { requireAccountManager } from "@/lib/auth/account-members";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { PortalMediaError, portalMediaKind, readPortalMediaFile } from "@/lib/portal/media";
import { s3Storage } from "@/lib/storage/s3-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(tenant);
    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      throw new PortalMediaError("Upload portal artwork as multipart form data.");
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
      throw new PortalMediaError("Portal image uploads must be 8 MB or smaller.", 413);
    }
    const form = await request.formData();
    const kind = portalMediaKind(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new PortalMediaError("Choose an image to upload.");
    const media = await readPortalMediaFile(file, kind);
    let uploaded;
    try {
      uploaded = await s3Storage.uploadPortalAsset({ tenantId: tenant.tenantId, kind, ...media });
    } catch {
      throw new PortalMediaError("Portal media storage is temporarily unavailable.", 503);
    }
    return NextResponse.json(
      { success: true, kind, url: uploaded.publicUrl, sizeBytes: uploaded.sizeBytes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PortalMediaError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return accountError(error);
  }
}
