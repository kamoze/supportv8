import { describe, it, expect } from "vitest";
import { webCrawler } from "@/lib/services/web-crawler-service";
import { ragService } from "@/lib/services/rag-service";

describe("supportV8 Website Crawler & RAG Ingestion", () => {
  it("cleans raw HTML and converts to clean semantic Markdown", () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Okta SAML 2.0 Configuration Guide</title></head>
        <body>
          <nav><a href="/">Home</a><a href="/login">Login</a></nav>
          <script>console.log("analytics tracking");</script>
          <style>body { font-size: 16px; }</style>
          <h1>Configuring Okta SAML SSO</h1>
          <p>This document details how to set up SAML 2.0 assertions for enterprise domains.</p>
          <h2>Entity ID and ACS URL</h2>
          <p>ACS URL must point to https://auth.acme.com/saml/callback with POST binding.</p>
          <footer>Copyright 2026 Acme Corp</footer>
        </body>
      </html>
    `;

    const { title, markdown } = webCrawler.cleanHtmlToMarkdown(rawHtml, "https://docs.acme.com/saml");

    expect(title).toBe("Okta SAML 2.0 Configuration Guide");
    expect(markdown).toContain("# Configuring Okta SAML SSO");
    expect(markdown).toContain("ACS URL must point to https://auth.acme.com/saml/callback");
    expect(markdown).not.toContain("analytics tracking");
    expect(markdown).not.toContain("Copyright 2026");
  });

  it("crawls and ingests website into S3 snapshot and pgvector chunks", async () => {
    const crawlResult = await webCrawler.crawlAndIngest({
      tenantId: "tenant_test_web",
      url: "https://docs.acme.com/api/webhooks",
      title: "Acme Webhook Delivery Guide",
      category: "infrastructure",
      mockHtmlContent: `
        <html>
          <head><title>Acme Webhook Delivery Guide</title></head>
          <body>
            <h1>Webhook Architecture</h1>
            <p>Webhooks are delivered with HMAC SHA-256 signatures in the X-Acme-Signature header.</p>
            <p>Retries follow exponential backoff: 5s, 25s, 125s, 625s.</p>
          </body>
        </html>
      `,
    });

    expect(crawlResult.source.id).toBeDefined();
    expect(crawlResult.source.url).toBe("https://docs.acme.com/api/webhooks");
    expect(crawlResult.chunkCount).toBeGreaterThanOrEqual(1);
    expect(crawlResult.s3SnapshotUrl).toBeDefined();
    expect(crawlResult.source.status).toBe("indexed");
  });

  it("retrieves crawled website knowledge through RAG semantic search", async () => {
    await webCrawler.crawlAndIngest({
      tenantId: "tenant_default",
      url: "https://docs.acme.com/security/mfa-fido2",
      title: "FIDO2 Security Key Setup Documentation",
      category: "auth_mfa",
      mockHtmlContent: `
        <html>
          <head><title>FIDO2 Hardware Key Documentation</title></head>
          <body>
            <h1>FIDO2 and WebAuthn Support</h1>
            <p>Hardware keys such as YubiKey 5 Series can be bound directly via WebAuthn API.</p>
          </body>
        </html>
      `,
    });

    const searchResults = await ragService.searchSemantic("How does WebAuthn hardware key support work?");
    expect(searchResults.length).toBeGreaterThanOrEqual(1);

    const matched = searchResults.find(
      (r) => r.title.includes("FIDO2") || r.content.includes("WebAuthn")
    );
    expect(matched).toBeDefined();
    expect(matched?.similarity).toBeGreaterThan(0.7);
  });
});
