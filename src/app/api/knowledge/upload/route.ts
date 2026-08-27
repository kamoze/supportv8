import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { db } from "@/lib/db/mock-data";

export async function GET(req: NextRequest) {
  const documents = ragIngestion.getDocuments(db.tenant.tenantId);
  return NextResponse.json({
    success: true,
    count: documents.length,
    data: documents,
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const category = (formData.get("category") as string) || "general";
      const title = (formData.get("title") as string) || "";
      const rawGroups = formData.get("groups") as string | null;
      const rawTags = formData.get("tags") as string | null;

      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided in form data" }, { status: 400 });
      }

      const groups = rawGroups ? (rawGroups.startsWith("[") ? JSON.parse(rawGroups) : rawGroups.split(",").map((s) => s.trim()).filter(Boolean)) : ["support-tier1"];
      const tags = rawTags ? (rawTags.startsWith("[") ? JSON.parse(rawTags) : rawTags.split(",").map((s) => s.trim()).filter(Boolean)) : [];

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await ragIngestion.ingestDocument({
        tenantId: db.tenant.tenantId,
        filename: file.name,
        content: buffer,
        category,
        title: title || file.name,
        groups,
        tags,
      });

      return NextResponse.json({
        success: true,
        message: `File '${file.name}' successfully uploaded to S3 and indexed into ${result.chunks.length} pgvector chunks!`,
        data: result,
      });
    }

    // Direct JSON payload upload (base64 or text)
    const body = await req.json();
    const { filename, content, category, title, groups, tags } = body;

    if (!filename || !content) {
      return NextResponse.json(
        { success: false, error: "filename and content are required in JSON body" },
        { status: 400 }
      );
    }

    const result = await ragIngestion.ingestDocument({
      tenantId: db.tenant.tenantId,
      filename,
      content,
      category: category || "general",
      title: title || filename,
      groups: groups || ["support-tier1"],
      tags: tags || [],
    });

    return NextResponse.json({
      success: true,
      message: `Document '${filename}' successfully ingested to S3 (${result.s3Url}) and indexed into ${result.chunks.length} pgvector chunks!`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
