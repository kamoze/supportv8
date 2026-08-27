import { describe, it, expect } from "vitest";
import { chunkBody } from "@/lib/rag/chunker";
import { kv8RetrievalEngine, STATUS_WEIGHT } from "@/lib/rag/retrieval";

describe("KnowledgeV8-Aligned RAG Architecture", () => {
  it("extracts hierarchical section paths with heading-based chunker", () => {
    const markdownDoc = `
# Customer Authentication
Preamble text explaining authentication protocols.

## SAML 2.0 Identity Federation
Configure Okta and Azure AD enterprise identity providers.

### Entity ID Configuration
Entity ID must match the SP metadata URL.

## Multi-Factor Authentication
FIDO2 and WebAuthn hardware keys.
    `;

    const chunks = chunkBody(markdownDoc);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const samlChunk = chunks.find((c) => c.section === "Customer Authentication > SAML 2.0 Identity Federation");
    expect(samlChunk).toBeDefined();
    expect(samlChunk?.content).toContain("Configure Okta and Azure AD");

    const entityChunk = chunks.find(
      (c) => c.section === "Customer Authentication > SAML 2.0 Identity Federation > Entity ID Configuration"
    );
    expect(entityChunk).toBeDefined();
    expect(entityChunk?.content).toContain("Entity ID must match");
  });

  it("applies status weighting favoring authoritative/reviewed sources over drafts", () => {
    expect(STATUS_WEIGHT.authoritative).toBe(1.15);
    expect(STATUS_WEIGHT.reviewed).toBe(1.0);
    expect(STATUS_WEIGHT.draft).toBe(0.8);
    expect(STATUS_WEIGHT.deprecated).toBe(0);
  });

  it("queries both curated concepts and raw documents in unified retrieval", async () => {
    const results = await kv8RetrievalEngine.query("SAML 2.0 identity federation configuration", {
      topK: 5,
      kind: "both",
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBeDefined();
    expect(results[0].status).toBeDefined();
    expect(results[0].score).toBeGreaterThan(0.6);
    expect(results[0].matchedSections.length).toBeGreaterThan(0);
  });

  it("performs long-context token-budgeted expansion", async () => {
    const results = await kv8RetrievalEngine.query("Checkout gateway timeout 504", {
      topK: 3,
      budgetChars: 5000,
      includeBodies: true,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].expandedBody).toBeDefined();
    expect(results[0].expandedBody!.length).toBeLessThanOrEqual(5000);
  });
});
