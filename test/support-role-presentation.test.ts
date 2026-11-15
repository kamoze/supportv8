import { describe, expect, it } from "vitest";
import { supportRoleLabel } from "@/lib/auth/role-presentation";

describe("Support workspace role presentation", () => {
  it.each([
    ["observer", "Workspace Member"],
    ["operator", "Operator"],
    ["cx_lead", "CX Lead"],
    ["superadmin", "Administrator"],
    ["contractor", "Contractor"],
    ["contractor_lead", "Contractor"],
    ["technician", "Contractor"],
  ] as const)("labels %s truthfully", (role, expected) => {
    expect(supportRoleLabel(role)).toBe(expected);
  });
});
