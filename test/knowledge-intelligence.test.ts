import { describe, it, expect } from "vitest";
import { knowledgeService } from "@/lib/services/knowledge-service";

describe("supportV8 Knowledge Intelligence", () => {
  it("tracks articles, gaps, and update proposals", () => {
    const articles = knowledgeService.getArticles();
    const gaps = knowledgeService.getGaps();
    const proposals = knowledgeService.getProposals();

    expect(articles.length).toBeGreaterThanOrEqual(2);
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(proposals.length).toBeGreaterThanOrEqual(1);
  });

  it("publishes proposed knowledge updates via Action Gateway", async () => {
    const res = await knowledgeService.publishProposal("PROP-101");
    expect(res.success).toBe(true);
    expect(res.auditId).toBeDefined();

    const articles = knowledgeService.getArticles();
    expect(articles.some((a) => a.title.includes("FIDO2"))).toBe(true);
  });
});
