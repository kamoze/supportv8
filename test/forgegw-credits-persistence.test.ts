import { describe, it, expect, beforeEach } from "vitest";
import { marketplaceService } from "../src/lib/services/marketplace-service";
import { GET as getMarketplace, POST as postMarketplace } from "../src/app/api/marketplace/route";
import { GET as getCredits, POST as postCredits } from "../src/app/api/credits/route";
import { NextRequest } from "next/server";

describe("ForgeGW Spendable Credits & Lifecycle Persistence", () => {
  beforeEach(() => {
    marketplaceService.setCredits(4850);
  });

  it("1. MarketplaceService should start with 4,850 initial credits", () => {
    expect(marketplaceService.getCredits()).toBe(4850);
  });

  it("2. MarketplaceService.deductCredits should accurately subtract credits and return remaining balance", () => {
    // Generative AI reply deduction (15 credits)
    const replyRes = marketplaceService.deductCredits(15, "Generative reply generation");
    expect(replyRes.deducted).toBe(15);
    expect(replyRes.remaining).toBe(4835);
    expect(marketplaceService.getCredits()).toBe(4835);

    // Autonomous multi-action resolution deduction (35 credits)
    const autoRes = marketplaceService.deductCredits(35, "Autonomous AI agent resolution");
    expect(autoRes.deducted).toBe(35);
    expect(autoRes.remaining).toBe(4800);
    expect(marketplaceService.getCredits()).toBe(4800);

    // RAG vector indexing deduction (20 credits)
    const ragRes = marketplaceService.deductCredits(20, "pgvector RAG corpus indexing");
    expect(ragRes.deducted).toBe(20);
    expect(ragRes.remaining).toBe(4780);
    expect(marketplaceService.getCredits()).toBe(4780);
  });

  it("3. MarketplaceService.addCredits should top-up balance when purchasing credit packs", () => {
    // Top-up 2,500 credits
    const topupRes = marketplaceService.addCredits(2500, "Purchased 2,500 Credits Pack");
    expect(topupRes.added).toBe(2500);
    expect(topupRes.remaining).toBe(4850 + 2500);
    expect(marketplaceService.getCredits()).toBe(7350);
  });

  it("4. GET /api/marketplace should return live server-persisted credits", async () => {
    marketplaceService.setCredits(4750);
    const req = new NextRequest("http://localhost:3000/api/marketplace");
    const res = await getMarketplace(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.credits).toBe(4750);
  });

  it("5. POST /api/marketplace should handle deduct_credits and add_credits actions", async () => {
    marketplaceService.setCredits(4850);

    // Test deduct_credits
    const deductReq = new NextRequest("http://localhost:3000/api/marketplace", {
      method: "POST",
      body: JSON.stringify({ action: "deduct_credits", amount: 35, reason: "Autonomous resolution" }),
    });
    const deductRes = await postMarketplace(deductReq);
    const deductJson = await deductRes.json();

    expect(deductJson.success).toBe(true);
    expect(deductJson.data.remaining).toBe(4815);
    expect(marketplaceService.getCredits()).toBe(4815);

    // Test add_credits
    const addReq = new NextRequest("http://localhost:3000/api/marketplace", {
      method: "POST",
      body: JSON.stringify({ action: "add_credits", amount: 6000, reason: "Purchased 6,000 Credits" }),
    });
    const addRes = await postMarketplace(addReq);
    const addJson = await addRes.json();

    expect(addJson.success).toBe(true);
    expect(addJson.data.remaining).toBe(4815 + 6000);
    expect(marketplaceService.getCredits()).toBe(10815);
  });

  it("6. GET and POST /api/credits dedicated endpoint should support direct balance sync", async () => {
    marketplaceService.setCredits(5000);

    // GET /api/credits
    const getReq = new NextRequest("http://localhost:3000/api/credits");
    const getRes = await getCredits(getReq);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.credits).toBe(5000);
    expect(getJson.data.provider).toBe("forgegw");

    // POST /api/credits deduct
    const deductReq = new NextRequest("http://localhost:3000/api/credits", {
      method: "POST",
      body: JSON.stringify({ action: "deduct", amount: 20, reason: "RAG index" }),
    });
    const deductRes = await postCredits(deductReq);
    const deductJson = await deductRes.json();
    expect(deductJson.success).toBe(true);
    expect(deductJson.data.remaining).toBe(4980);
    expect(marketplaceService.getCredits()).toBe(4980);
  });
});
