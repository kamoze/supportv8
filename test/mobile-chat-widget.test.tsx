// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
};

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(ui);
  });
  return { container };
}

const screen = {
  getByText(text: string | RegExp) {
    const el = [...document.body.querySelectorAll("*")].find((node) => {
      const content = node.textContent?.trim();
      if (typeof text === "string") {
        return content === text || (node.children.length === 0 && content?.includes(text));
      }
      return text.test(content || "");
    });
    if (!el) throw new Error(`Unable to find element with text: ${text}`);
    return el;
  },
  queryByText(text: string | RegExp) {
    return (
      [...document.body.querySelectorAll("*")].find((node) => {
        const content = node.textContent?.trim();
        if (typeof text === "string") {
          return content === text || (node.children.length === 0 && content?.includes(text));
        }
        return text.test(content || "");
      }) || null
    );
  },
  getByPlaceholderText(placeholder: string) {
    const el = document.body.querySelector(`[placeholder="${placeholder}"]`);
    if (!el) throw new Error(`Unable to find element with placeholder: ${placeholder}`);
    return el;
  },
  queryByPlaceholderText(placeholder: string) {
    return document.body.querySelector(`[placeholder="${placeholder}"]`);
  },
};

class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
  }
}

describe("SupportChatWidget Mobile Client Auth", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ session: null }),
      }),
    );
    storageMap.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      act(() => {
        root?.unmount();
      });
    }
    document.body.innerHTML = "";
    storageMap.clear();
  });

  it("bypasses intake form when pre-authenticated client identity is present", async () => {
    localStorage.setItem(
      "supportv8_client_session_acme",
      JSON.stringify({
        email: "sarah@jenkins.com",
        name: "Sarah Jenkins",
        tenantSlug: "acme",
      })
    );

    render(<SupportChatWidget tenantSlug="acme" />);

    await act(async () => {
      await Promise.resolve();
    });

    // Trigger open chat event
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
      await Promise.resolve();
    });

    // In authenticated state, customer name & email inputs are bypassed directly to chat message input
    expect(screen.queryByPlaceholderText("Your full name")).toBeNull();
    expect(screen.queryByText("Start Live Session")).toBeNull();
    expect(screen.getByPlaceholderText("Type a message, ask about PINs, or status...")).toBeDefined();
  });

  it("bypasses intake form when supportv8:client-authenticated event is received", async () => {
    render(<SupportChatWidget tenantSlug="acme" />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("supportv8:client-authenticated", {
          detail: {
            customer: {
              email: "alex@jenkins.com",
              name: "Alex Jenkins",
            },
            clientToken: "test_token_123",
          },
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
      await Promise.resolve();
    });

    expect(screen.queryByText("Start Live Session")).toBeNull();
    expect(screen.getByPlaceholderText("Type a message, ask about PINs, or status...")).toBeDefined();
  });

  it("applies dynamic viewport height and dock offset styling on mobile viewports", () => {
    render(<SupportChatWidget tenantSlug="acme" />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
    });

    // Find the expanded modal container
    const modal = document.body.querySelector(".fixed.z-50.flex.flex-col");
    expect(modal).not.toBeNull();
    expect(modal?.className).toContain("max-h-[calc(100dvh-5rem)]");
    expect(modal?.className).toContain("h-[100dvh]");
  });

  it("shows intake form when unauthenticated", () => {
    render(<SupportChatWidget tenantSlug="acme" />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
    });

    expect(screen.getByText("Start Live Session")).toBeDefined();
    expect(screen.queryByPlaceholderText("Type a message, ask about PINs, or status...")).toBeNull();
  });

  it("sets dynamic agent title in active session header when authenticated", async () => {
    localStorage.setItem(
      "supportv8_client_session_acme",
      JSON.stringify({
        email: "sarah@jenkins.com",
        name: "Sarah Jenkins",
        tenantSlug: "acme",
      })
    );

    render(<SupportChatWidget tenantSlug="acme" tenantName="Acme Logistics" />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
      await Promise.resolve();
    });

    expect(screen.getByText("Acme Logistics Support")).toBeDefined();
  });
});
