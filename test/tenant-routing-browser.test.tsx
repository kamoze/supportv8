// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GlobalLandingView } from "@/components/GlobalLandingView";
import { SignInModal } from "@/components/SignInModal";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

beforeEach(() => {
  window.matchMedia = window.matchMedia || function() {
    return {
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  };
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots.length = 0;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("TR08 Served-Browser Tests: Workspace Entry & Sign-In Form Accessibility", () => {
  it("GlobalLandingView: accessible workspace input has associated label, autocomplete, and handles lookup submission", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            slug: "acme-corp",
            redirectUrl: "https://acme-corp.support.servicev8.com/",
          }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <GlobalLandingView
        onOpenSignIn={vi.fn()}
        onOpenTenantPortal={vi.fn()}
        onOpenSignup={vi.fn()}
      />
    );

    const input = container.querySelector("#panel-login-workspace") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute("autocomplete")).toBe("organization");
    expect(input.getAttribute("name")).toBe("workspace");

    const label = container.querySelector('label[for="panel-login-workspace"]');
    expect(label).not.toBeNull();
    expect(label?.textContent?.trim()).toContain("Workspace");

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toContain("Go to workspace");
    expect(submitBtn.disabled).toBe(true); // empty slug initially disables button

    // Type slug
    act(() => {
      typeInto(input, "acme-corp");
    });

    expect(submitBtn.disabled).toBe(false);

    // Submit form
    await act(async () => {
      submitBtn.click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/lookup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ workspace: "acme-corp" }),
      })
    );
  });

  it("GlobalLandingView: displays distinct error alert on unknown workspace lookup", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "workspace_not_found" }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <GlobalLandingView
        onOpenSignIn={vi.fn()}
        onOpenTenantPortal={vi.fn()}
        onOpenSignup={vi.fn()}
      />
    );

    const input = container.querySelector("#panel-login-workspace") as HTMLInputElement;
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    act(() => {
      typeInto(input, "nonexistent-workspace");
    });

    await act(async () => {
      submitBtn.click();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Workspace not found");
  });

  it("SignInModal: a prop alone cannot turn a global host into a credential form", () => {
    const { container } = render(
      <SignInModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenSignup={vi.fn()}
        lockedTenantSlug="acme-corp"
        initialTenantSlug="acme"
      />
    );

    expect(container.querySelector("#panel-login-workspace")).not.toBeNull();
    expect((container.querySelector("#panel-login-workspace") as HTMLInputElement).value).toBe("");
    expect(container.querySelector("#tenant-login-email")).toBeNull();
    expect(container.querySelector("#tenant-login-password")).toBeNull();
    expect(container.textContent).toContain("Go to workspace");
  });

  it("SignInModal: global modal provides accessible workspace field when unlocked", () => {
    const { container } = render(
      <SignInModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenSignup={vi.fn()}
      />
    );

    const wsInput = container.querySelector("#panel-login-workspace") as HTMLInputElement;
    expect(wsInput).not.toBeNull();
    expect(wsInput.getAttribute("autocomplete")).toBe("organization");
    const wsLabel = container.querySelector('label[for="panel-login-workspace"]');
    expect(wsLabel).not.toBeNull();
  });
});
