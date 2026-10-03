// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileClientAppShell } from "@/components/portal/MobileClientAppShell";

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
};

const fireEvent = {
  click(element: Element) {
    act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if ((element as HTMLButtonElement).type === "submit") {
        const form = (element as HTMLButtonElement).form;
        if (form) {
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      }
    });
  },
  change(element: Element, { target }: { target: { value: string } }) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (valueSetter) {
        valueSetter.call(element, target.value);
      } else {
        (element as HTMLInputElement).value = target.value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },
};

async function waitFor(callback: () => void, timeout = 1000) {
  const start = Date.now();
  while (true) {
    try {
      await act(async () => {
        callback();
      });
      return;
    } catch (err) {
      if (Date.now() - start > timeout) {
        throw err;
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }
}

describe("MobileClientAppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage);
    storageMap.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => root.unmount());
    }
    roots.length = 0;
    document.body.innerHTML = "";
    storageMap.clear();
  });

  it("renders bottom navigation tabs with concise labels", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    expect(screen.getByText("Chat")).toBeDefined();
    expect(screen.getByText("Requests")).toBeDefined();
    expect(screen.getByText("Help")).toBeDefined();
    expect(screen.getByText("Account")).toBeDefined();
  });

  it("opens OTP login modal when Account tab is tapped while unauthenticated", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Account"));
    expect(screen.getByPlaceholderText("client@company.com")).toBeDefined();
    expect(screen.getByText("Verify")).toBeDefined();
  });

  it("calls onOpenChat when Chat tab is selected", () => {
    const onOpenChat = vi.fn();
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={onOpenChat}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Chat"));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenHelp when Help tab is selected", () => {
    const onOpenHelp = vi.fn();
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={onOpenHelp}
      />
    );

    fireEvent.click(screen.getByText("Help"));
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it("prompts to sign in on Requests tab when unauthenticated", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Requests"));
    expect(screen.getByText("Sign In")).toBeDefined();
  });

  it("displays customer tickets when authenticated on Requests tab", async () => {
    mockLocalStorage.setItem("supportv8_client_token", "fake-token");
    mockLocalStorage.setItem(
      "supportv8_client_session_acme",
      JSON.stringify({
        email: "sarah@acme.com",
        name: "Sarah Jenkins",
        tenantSlug: "acme",
      })
    );

    const mockTickets = [
      {
        id: "TCK-1001",
        title: "Billing inquiry",
        status: "open",
        updatedAt: new Date().toISOString(),
        assignedTo: "Support Agent",
        publicNotes: "Investigating charge",
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/portal/tickets") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, tickets: mockTickets }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Requests"));

    await waitFor(() => {
      expect(screen.getByText("TCK-1001")).toBeDefined();
      expect(screen.getByText("Billing inquiry")).toBeDefined();
    });
  });

  it("completes OTP flow, persists tokens and displays account details", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/portal/auth/otp/send") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, email: "client@company.com" }),
        });
      }
      if (url === "/api/portal/auth/otp/verify") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              clientToken: "test_signed_token_xyz",
              customer: {
                id: "cust_123",
                email: "client@company.com",
                name: "Client Name",
                tenantId: "acme",
              },
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Account"));

    const emailInput = screen.getByPlaceholderText("client@company.com");
    fireEvent.change(emailInput, { target: { value: "client@company.com" } });

    fireEvent.click(screen.getByText("Verify"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("123456")).toBeDefined();
    });

    const codeInput = screen.getByPlaceholderText("123456");
    fireEvent.change(codeInput, { target: { value: "123456" } });

    fireEvent.click(screen.getByText("Verify"));

    await waitFor(() => {
      expect(mockLocalStorage.getItem("supportv8_client_token")).toBe("test_signed_token_xyz");
      expect(screen.getByText("client@company.com")).toBeDefined();
      expect(screen.getByText("Log Out")).toBeDefined();
    });
  });

  it("handles PWA install prompt banner", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    const promptMock = vi.fn();
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: promptMock });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.getByText("Install App")).toBeDefined();
  });
});
