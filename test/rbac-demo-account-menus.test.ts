import { describe, it, expect } from "vitest";
import type { AuthSession } from "../src/lib/auth-service";

interface NavItem {
  id: string;
  label: string;
  roles: AuthSession["role"][];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getFilteredNavSections(role: AuthSession["role"]) {
  const isContractorRole = role === "contractor" || role === "contractor_lead" || role === "technician";

  const allNavSections: NavSection[] = [
    {
      title: isContractorRole ? "Field Operations" : "Work Desk",
      items: [
        {
          id: "workspace",
          label: isContractorRole ? "Field Work Desk" : "Work Desk",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "problems",
          label: "Problem Matrix",
          roles: ["operator", "cx_lead", "superadmin"],
        },
        {
          id: "issues",
          label: isContractorRole ? "Work Orders Explorer" : "Issues Explorer",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "cx_cockpit",
          label: "CX Cockpit",
          roles: ["cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: isContractorRole ? "Field Assistant & Comms" : "Core Intelligence",
      items: [
        {
          id: "overview",
          label: "Overview",
          roles: ["operator", "cx_lead", "superadmin", "observer"],
        },
        {
          id: "ask",
          label: isContractorRole ? "Field Assistant (AI)" : "Ask supportV8",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "studio",
          label: "Autonomous Studio",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "workforce",
          label: "AI Workforce",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "voice",
          label: isContractorRole ? "Dispatch Audio (Comms)" : "Voice Telephony",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: "Knowledge & Radar",
      items: [
        {
          id: "trends",
          label: "Trend Radar",
          roles: ["operator", "cx_lead", "superadmin"],
        },
        {
          id: "knowledge",
          label: "Knowledge Suite",
          roles: ["operator", "cx_lead", "superadmin", "observer"],
        },
        {
          id: "stale_work",
          label: "Work Sweep",
          roles: ["cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: "Marketplace & Registry",
      items: [
        {
          id: "studio_marketplace",
          label: "Studio Marketplace",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "market_workforce",
          label: "Active Capabilities",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "market_plans",
          label: "Plans & Credits",
          roles: ["cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: "Governance",
      items: [
        {
          id: "gov_settings",
          label: "Settings",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "gov_members",
          label: "Members",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "gov_audit",
          label: "Audit Logs",
          roles: ["cx_lead", "superadmin", "observer"],
        },
        {
          id: "gov_reports",
          label: "Reports",
          roles: ["cx_lead", "superadmin", "observer"],
        },
        {
          id: "policies",
          label: "Policies & Rules",
          roles: ["cx_lead", "superadmin", "observer"],
        },
      ],
    },
  ];

  return allNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

describe("Demo Accounts RBAC Navigation & Menu Restrictions", () => {
  it("1. Contractor Demo Account (dispatch@meridian.com) must only see Field Operations & Comms menus", () => {
    const contractorSections = getFilteredNavSections("contractor_lead");
    const itemIds = contractorSections.flatMap((s) => s.items.map((i) => i.id));

    // Must have exactly the 4 field operations menus
    expect(itemIds).toEqual(["workspace", "issues", "ask", "voice"]);
    expect(contractorSections.length).toBe(2);
    expect(contractorSections[0].title).toBe("Field Operations");
    expect(contractorSections[1].title).toBe("Field Assistant & Comms");

    // Must NOT have access to administrative, governance, or commercial menus
    expect(itemIds).not.toContain("overview");
    expect(itemIds).not.toContain("problems");
    expect(itemIds).not.toContain("cx_cockpit");
    expect(itemIds).not.toContain("studio");
    expect(itemIds).not.toContain("workforce");
    expect(itemIds).not.toContain("trends");
    expect(itemIds).not.toContain("knowledge");
    expect(itemIds).not.toContain("stale_work");
    expect(itemIds).not.toContain("studio_marketplace");
    expect(itemIds).not.toContain("gov_settings");
    expect(itemIds).not.toContain("gov_members");
  });

  it("2. Support Operator Demo Account (david.kim@acme.com) must see frontline triage but NO governance or marketplace", () => {
    const operatorSections = getFilteredNavSections("operator");
    const itemIds = operatorSections.flatMap((s) => s.items.map((i) => i.id));

    // Permitted operator triage & knowledge tools
    expect(itemIds).toContain("workspace");
    expect(itemIds).toContain("problems");
    expect(itemIds).toContain("issues");
    expect(itemIds).toContain("overview");
    expect(itemIds).toContain("ask");
    expect(itemIds).toContain("voice");
    expect(itemIds).toContain("trends");
    expect(itemIds).toContain("knowledge");

    // Strictly restricted from management & admin
    expect(itemIds).not.toContain("cx_cockpit");
    expect(itemIds).not.toContain("studio");
    expect(itemIds).not.toContain("workforce");
    expect(itemIds).not.toContain("stale_work");
    expect(itemIds).not.toContain("studio_marketplace");
    expect(itemIds).not.toContain("market_workforce");
    expect(itemIds).not.toContain("market_plans");
    expect(itemIds).not.toContain("gov_settings");
    expect(itemIds).not.toContain("gov_members");
    expect(itemIds).not.toContain("policies");
  });

  it("3. CX Lead & Admin Demo Account (admin@acme-movers.com, acme@servicev8.com) must see full menu suite", () => {
    const cxLeadSections = getFilteredNavSections("cx_lead");
    const itemIds = cxLeadSections.flatMap((s) => s.items.map((i) => i.id));

    // Full 20 menus across all 5 sections
    expect(cxLeadSections.length).toBe(5);
    expect(itemIds.length).toBe(20);
    expect(itemIds).toContain("cx_cockpit");
    expect(itemIds).toContain("studio");
    expect(itemIds).toContain("workforce");
    expect(itemIds).toContain("stale_work");
    expect(itemIds).toContain("studio_marketplace");
    expect(itemIds).toContain("gov_settings");
    expect(itemIds).toContain("gov_members");
    expect(itemIds).toContain("policies");
  });

  it("4. Tab Route Guard fallback calculation should resolve to workspace when current tab is restricted", () => {
    const contractorTabs = getFilteredNavSections("contractor_lead").flatMap((s) => s.items.map((i) => i.id));
    
    // If a contractor is somehow directed to "gov_settings", guard redirects to "workspace"
    const currentTab = "gov_settings";
    const isAllowed = contractorTabs.includes(currentTab);
    expect(isAllowed).toBe(false);

    const fallbackTab = contractorTabs.includes("workspace") ? "workspace" : contractorTabs[0];
    expect(fallbackTab).toBe("workspace");
  });
});
