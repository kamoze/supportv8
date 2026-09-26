// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingPageGuide, GUIDE_CONTENT } from "@/components/FloatingPageGuide";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("FloatingPageGuide Component", () => {
  let notifyFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notifyFn = vi.fn();
  });

  afterEach(() => {
    for (const root of roots) act(() => root.unmount());
    roots.length = 0;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders trigger button and guide pill for active tab", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<FloatingPageGuide activeTab="overview" onNotify={notifyFn} />);
    });

    const triggerBtn = container.querySelector("button[aria-label*='Open page guide']");
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn?.textContent).toBe("?");

    // Verify tab guide pill
    expect(container.textContent).toContain("Guide:");
    expect(container.textContent).toContain(GUIDE_CONTENT.overview.label);
  });

  it("opens flyout panel showing tab-specific description, actions, and tip", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<FloatingPageGuide activeTab="knowledge" onNotify={notifyFn} />);
    });

    const triggerBtn = container.querySelector("button[aria-label*='Open page guide']") as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    expect(container.textContent).toContain(GUIDE_CONTENT.knowledge.label);
    expect(container.textContent).toContain(GUIDE_CONTENT.knowledge.what);
    expect(container.textContent).toContain("Key Actions");
    expect(container.textContent).toContain(GUIDE_CONTENT.knowledge.actions[0]);
    expect(container.textContent).toContain("Pro Tip");
    expect(container.textContent).toContain(GUIDE_CONTENT.knowledge.tip);
  });

  it("dynamically shows chat tab guide content when activeTab is chat", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<FloatingPageGuide activeTab="chat" onNotify={notifyFn} />);
    });

    const triggerBtn = container.querySelector("button[aria-label*='Open page guide']") as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    expect(container.textContent).toContain("AgenticOS Chat");
    expect(container.textContent).toContain(GUIDE_CONTENT.chat.what);
  });

  it("switches to feedback / report issue view and back to guide", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<FloatingPageGuide activeTab="issues" onNotify={notifyFn} />);
    });

    const triggerBtn = container.querySelector("button[aria-label*='Open page guide']") as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    const reportBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Report an issue"
    );
    expect(reportBtn).toBeDefined();

    act(() => {
      reportBtn?.click();
    });

    expect(container.textContent).toContain("Report an Issue");
    expect(container.textContent).toContain("Bug");
    expect(container.textContent).toContain("Confusing");
    expect(container.textContent).toContain("Idea");

    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Back to Guide"
    );
    act(() => {
      backBtn?.click();
    });

    expect(container.textContent).toContain(GUIDE_CONTENT.issues.label);
  });

  it("closes flyout when Escape key is pressed", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<FloatingPageGuide activeTab="overview" onNotify={notifyFn} />);
    });

    const triggerBtn = container.querySelector("button[aria-label*='Open page guide']") as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    expect(container.textContent).toContain("Executive Overview • Guide");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.textContent).not.toContain("Executive Overview • Guide");
  });
});
