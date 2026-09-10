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

  it("rejects unsigned browser-only presence toggles", () => {
    const testEmail = "elena.contractors@servicev8.com";
    expect(() => ChatWorkflowService.toggleStaffOnline(testEmail, false)).toThrow("authenticated presence");
    expect(() => ChatWorkflowService.toggleStaffOnline(testEmail, true)).toThrow("authenticated presence");
    expect(ChatWorkflowService.listStaffPresence()).toEqual([]);
  });

  it("does not expose the former three-online seeded roster", () => {
    const staff = ChatWorkflowService.listStaffPresence();
    expect(staff).toEqual([]);
    expect(staff.filter(person => person.isOnline)).toHaveLength(0);
    expect(ChatWorkflowService.listStaffPresence()).not.toBe(staff);
  });
});
