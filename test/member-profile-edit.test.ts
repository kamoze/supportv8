import { describe, it, expect } from "vitest";
import { ChatWorkflowService } from "../src/lib/services/chat-workflow-service";

describe("Team Member Account & Profile Editing", () => {
  it("should update team member profile attributes and sync with RBAC groups", () => {
    const initialGroups = ChatWorkflowService.listGroups();
    expect(initialGroups.length).toBeGreaterThan(0);

    const testEmail = "elena.contractors@servicev8.com";
    const contractorGroup = initialGroups.find((g) => g.id === "group_contractors");
    expect(contractorGroup).toBeDefined();
    expect(contractorGroup?.memberEmails).toContain(testEmail);

    // Update member groups in ChatWorkflowService
    const updatedGroups = ChatWorkflowService.updateGroup("group_contractors", {
      memberEmails: ["elena.contractors@servicev8.com", "inigodwin@redoo.solutions", "david.field@servicev8.com"],
    });

    expect(updatedGroups.memberEmails).toContain(testEmail);
  });

  it("should toggle live agent routing presence", () => {
    const testEmail = "elena.contractors@servicev8.com";
    const toggledOff = ChatWorkflowService.toggleStaffOnline(testEmail, false);
    expect(toggledOff.isOnline).toBe(false);

    const toggledOn = ChatWorkflowService.toggleStaffOnline(testEmail, true);
    expect(toggledOn.isOnline).toBe(true);
  });

  it("should maintain member presence state in activeStaffPresence", () => {
    const staff = ChatWorkflowService.listStaffPresence();
    const adminStaff = staff.find((s) => s.email === "inigodwin@redoo.solutions");
    expect(adminStaff).toBeDefined();
    expect(adminStaff?.name).toContain("Ini Godwin");
  });
});
