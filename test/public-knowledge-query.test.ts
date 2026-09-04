import { afterEach, describe, expect, it, vi } from "vitest";
import { parseKnowledgeWorkspaceKeys, queryPublicTenantKnowledge } from "@/lib/portal/knowledgev8-public";
import { runPublicKnowledgeQuery } from "@/lib/portal/public-query";

const API_KEY = `kv8_${"a".repeat(64)}`;

describe("public knowledge query", () => {
  afterEach(() => {
    delete process.env.KNOWLEDGEV8_QUERY_API_KEY;
    vi.unstubAllGlobals();
  });

  it("rejects bare and malformed workspace keys", () => {
    expect(parseKnowledgeWorkspaceKeys(API_KEY).size).toBe(0);
    expect(parseKnowledgeWorkspaceKeys(`acme=${API_KEY},broken=secret`).get("acme")).toBe(API_KEY);
    expect(parseKnowledgeWorkspaceKeys(`acme=${API_KEY}`).has("broken")).toBe(false);
  });

  it("does not send a question when this tenant has no bound key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPublicKnowledgeQuery({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      question: "How do I troubleshoot login?",
    })).rejects.toThrow("temporarily unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed instead of returning the legacy synthetic citation", async () => {
    process.env.KNOWLEDGEV8_QUERY_API_KEY = `acme=${API_KEY}`;
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(runPublicKnowledgeQuery({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      question: "How do I troubleshoot login?",
    }))
      .rejects.toThrow("temporarily unavailable");
  });

  it("uses the real tenant-bound query API with public-only filters", async () => {
    process.env.KNOWLEDGEV8_QUERY_API_KEY = `acme=${API_KEY}`;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
      workspace: "acme",
      results: [{
        conceptId: "kb-1",
        title: "Login recovery",
        description: "Fallback summary.",
        matchedSections: [{ content: "Reset the cached session." }],
        score: 0.91,
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPublicKnowledgeQuery({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      question: "Login recovery",
      categories: ["troubleshooting"],
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/query");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(headers.get("x-knowledgev8-expected-workspace")).toBe("acme");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      question: "Login recovery",
      tags: ["public"],
      bundle: ["troubleshooting"],
      status: ["reviewed", "authoritative"],
      include_bodies: false,
      expand_links: false,
    });
    expect(body.tenantId).toBeUndefined();
    expect(result.citations[0].title).toBe("Login recovery");
  });

  it("drops results when KnowledgeV8 reports a different workspace", async () => {
    process.env.KNOWLEDGEV8_QUERY_API_KEY = `acme=${API_KEY}`;
    const result = await queryPublicTenantKnowledge({ tenantSlug: "acme", question: "help" }, async () =>
      new Response(JSON.stringify({ workspace: "other", results: [] }), { status: 200 }));
    expect(result).toEqual({ ok: false, reason: "workspace-mismatch" });
  });
});
