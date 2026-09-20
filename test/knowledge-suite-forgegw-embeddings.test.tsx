// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeSuiteView } from "@/components/views/KnowledgeSuiteView";
import { GovernanceSettingsView } from "@/components/views/GovernanceSettingsView";
import { INITIAL_SETTINGS, marketplaceService } from "@/lib/services/marketplace-service";

const mockKnowledge = {
  articles: [
    {
      id: "art_01",
      source: "knowledgev8:ws_enterprise_core",
      title: "Okta SSO Setup",
      category: "auth_sso",
      summary: "SAML 2.0 configuration guide",
      url: "https://example.com/art_01",
      status: "active" as const,
      lastUpdated: new Date().toISOString(),
      usageCount: 10,
      csatScore: 98,
    },
  ],
  gaps: [],
  proposals: [],
  documents: [],
  webSources: [],
};

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots.length = 0;
  document.body.innerHTML = "";
});

describe("Knowledge Suite Embeddings ForgeGW Integration", () => {
  it("defaults INITIAL_SETTINGS to ForgeGW routingMode and forge-embed-text-1536 model", () => {
    expect(INITIAL_SETTINGS.routingMode).toBe("forgegw");
    expect(INITIAL_SETTINGS.embeddingProvider).toBe("forgegw");
    expect(INITIAL_SETTINGS.embeddingModel).toBe("forge-embed-text-1536");
    expect(INITIAL_SETTINGS.embeddingDimensions).toBe(1536);

    const acmeSettings = marketplaceService.getSettings("acme");
    expect(acmeSettings.embeddingModel).toBe("forge-embed-text-1536");
    expect(acmeSettings.embeddingProvider).toBe("forgegw");
  });

  it("renders KnowledgeSuiteView with ForgeGW Managed RAG Pipeline when ForgeGW is active", () => {
    const html = renderToStaticMarkup(
      <KnowledgeSuiteView
        knowledge={mockKnowledge}
        onPublishProposal={vi.fn()}
        onSyncKv8={vi.fn()}
        onNotify={vi.fn()}
        routingMode="forgegw"
        embeddingProvider="forgegw"
        embeddingModel="forge-embed-text-1536"
      />
    );

    expect(html).toContain("FORGEGW MANAGED RAG PIPELINE");
    expect(html).toContain("ForgeGW 1536-dim pgvector");
  });

  it("mounts KnowledgeSuiteView, navigates to Topology settings, and verifies ForgeGW embeddings hookup", () => {
    const handleUpdateSettings = vi.fn();
    const handleNotify = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        <KnowledgeSuiteView
          knowledge={mockKnowledge}
          onPublishProposal={vi.fn()}
          onSyncKv8={vi.fn()}
          onNotify={handleNotify}
          routingMode="forgegw"
          embeddingProvider="forgegw"
          embeddingModel="forge-embed-text-1536"
          onUpdateSettings={handleUpdateSettings}
        />
      );
    });

    // Verify initial Ingest tab indicators
    expect(container.textContent).toContain("FORGEGW MANAGED RAG PIPELINE");
    expect(container.textContent).toContain("ForgeGW 1536-dim pgvector");

    // Click "Vector Field Values" sub-tab button
    const topologyBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("Vector Field Values")
    );
    expect(topologyBtn).toBeTruthy();
    act(() => {
      topologyBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Check ForgeGW active banner & Auto-linked label
    expect(container.textContent).toContain("ForgeGW Managed Embeddings Active:");
    expect(container.textContent).toContain("FORGEGW ACTIVE");
    expect(container.textContent).toContain("Auto-linked to ForgeGW LLM");
    expect(container.textContent).toContain("ServiceV8 ForgeGW Managed embeddings pipeline");

    // Check select value has forge-embed-text-1536
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("forge-embed-text-1536");

    // Click "Save Vector Parameters" button
    const saveBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("Save Vector Parameters")
    );
    expect(saveBtn).toBeTruthy();
    act(() => {
      saveBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddingModel: "forge-embed-text-1536",
        embeddingProvider: "forgegw",
        embeddingDimensions: 1536,
      })
    );
    expect(handleNotify).toHaveBeenCalledWith(
      "Vector grounding topology parameters saved to tenant configuration.",
      "success"
    );
  });

  it("switches primary routing to ForgeGW and synchronizes embeddingProvider to forgegw in GovernanceSettingsView", () => {
    const handleUpdateSettings = vi.fn();
    const handleNotify = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        <GovernanceSettingsView
          settings={{
            ...INITIAL_SETTINGS,
            routingMode: "byom",
            embeddingProvider: "openai",
            embeddingModel: "text-embedding-3-small",
          }}
          onUpdateSettings={handleUpdateSettings}
          onNotify={handleNotify}
        />
      );
    });

    // Find and click ForgeGW Managed (Recommended) button
    const forgeGwBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("ForgeGW Managed (Recommended)")
    );
    expect(forgeGwBtn).toBeTruthy();
    act(() => {
      forgeGwBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        routingMode: "forgegw",
        embeddingProvider: "forgegw",
        embeddingModel: "forge-embed-text-1536",
        embeddingDimensions: 1536,
      })
    );
    expect(handleNotify).toHaveBeenCalledWith(
      "Switched primary routing to ForgeGW Managed Compute & Embeddings (forge-embed-text-1536)",
      "success"
    );
  });

  it("displays ForgeGW Managed pill in RAG chunk editor sub-tab when ForgeGW is active", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        <KnowledgeSuiteView
          knowledge={mockKnowledge}
          onPublishProposal={vi.fn()}
          onSyncKv8={vi.fn()}
          onNotify={vi.fn()}
          routingMode="forgegw"
          embeddingProvider="forgegw"
          embeddingModel="forge-embed-text-1536"
        />
      );
    });

    // Click "RAG Output Editor" sub-tab button
    const ragBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("RAG Output Editor")
    );
    expect(ragBtn).toBeTruthy();
    act(() => {
      ragBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("FORGEGW MANAGED (1536-DIM)");
  });
});
