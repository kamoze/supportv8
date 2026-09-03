import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
describe("real Workdesk and account UI wiring", () => {
  it("awaits a confirmed save before adding a manual ticket", () => {
    const ui = source("components/views/FocusedWorkspaceView.tsx");
    const handler = ui.slice(ui.indexOf("const handleCreateManualTicket"), ui.indexOf("// CSV Import Parse"));
    expect(handler).toContain('AuthService.authenticatedFetch("/api/issues"');
    expect(handler.indexOf("if (!response.ok")).toBeLessThan(handler.indexOf("onCreateIssue?.(payload.data)"));
    expect(handler).not.toContain('tenantId: "tenant_default"');
    expect(handler).toContain("setCreateTicketError");
  });
  it("edits profiles inside SupportV8 without the broken external redirect", () => {
    expect(source("app/page.tsx")).not.toContain('href="https://keycloak.servicev8.com/realms/supportv8/account/"');
    expect(source("components/OperatorProfileEditor.tsx")).toContain('authenticatedFetch("/api/auth/profile"');
  });
  it("does not load seeded people or pretend local RBAC into account screens", () => {
    const ui = source("components/views/GovernanceMembersView.tsx");
    expect(ui).not.toContain("ChatWorkflowService");
    expect(ui).toContain('api("/api/members'); expect(ui).toContain('api("/api/presence"');
    expect(ui).not.toContain("toggleStaffOnline");
    expect(ui).not.toContain("activeChatCount");
    expect(ui).toContain("Online staff ({staff.length})");
    expect(ui).toContain("No staff currently online.");
  });
});
