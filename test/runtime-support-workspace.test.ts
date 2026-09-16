import { describe, expect, it } from "vitest";
import { InvalidWorkspaceReservationInputError, validateRuntimeSupportWorkspaceInput } from "@/lib/service-app/workspace-reservation";

const valid = { accountId:"acct-1", registryTenantId:"registry-1", installationId:"install-1", operationId:"operation-1", tenantDomain:"acme.support", subject:"user-1", verticalId:"runtime" as const };

describe("runtime Support workspace input", () => {
  it("preserves the complete exact scope", () => expect(validateRuntimeSupportWorkspaceInput(valid)).toEqual(valid));
  it.each([
    null, {}, {...valid, extra:true}, {...valid, verticalId:"supportv8"}, {...valid, accountId:" acct-1"},
    {...valid, subject:"user\n1"}, {...valid, operationId:"x".repeat(129)}, {...valid, tenantDomain:"Bad Domain"},
  ])("rejects malformed, unknown, whitespace, control, oversized, or wrong-vertical input", (input) => {
    expect(() => validateRuntimeSupportWorkspaceInput(input)).toThrow(InvalidWorkspaceReservationInputError);
  });
});
