// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AuthBotCheck } from "@/components/AuthBotCheck";

it("uses server transaction binding, clears expired proof and fences late widget callbacks", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const changes = vi.fn(); let options: Record<string, unknown> = {}, counter = 0;
  const remove = vi.fn(); window.turnstile = { remove, render: (_element, value) => { options = value; return String(++counter); } };
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return Response.json({ success: true, challengeId: String(counter + 1).repeat(64), cdata: String(counter + 1).repeat(64), action: body.action, siteKey: "synthetic-public-widget-key", expiresAt: Date.now() + 300000 });
  }); vi.stubGlobal("fetch", fetcher);
  try {
    await act(async () => { root.render(<AuthBotCheck action="signin" email="lead@example.com" tenantSlug="alpha" reset={0} onProof={changes} />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ action: "signin", email: "lead@example.com", tenantSlug: "alpha" });
    expect(options).toMatchObject({ sitekey: "synthetic-public-widget-key", action: "signin", cData: "1".repeat(64) });
    const completed = options.callback as (token: string) => void;
    await act(async () => completed("controlled-proof")); expect(changes).toHaveBeenLastCalledWith({ challengeId: "1".repeat(64), botToken: "controlled-proof" });
    await act(async () => (options["expired-callback"] as () => void)()); expect(changes).toHaveBeenLastCalledWith(null);
    await act(async () => root.unmount()); changes.mockClear(); completed("late-proof");
    expect(changes).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledWith("1");
  } finally { container.remove(); delete window.turnstile; vi.unstubAllGlobals(); }
});
