import { NextResponse } from "next/server";
import type { TenantMember } from "@/lib/types/marketplace-types";

// In-memory persistent member state initialized with default executive team
let membersStore: TenantMember[] = [
  {
    id: "mem_1",
    name: "Ini Godwin",
    email: "inigodwin@redoo.solutions",
    role: "Owner / CX Director",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "Active Now",
    avatarUrl: "/avatars/beaver-manager.jpg",
  },
  {
    id: "mem_2",
    name: "Elena Rostova",
    email: "elena.contractors@servicev8.com",
    role: "CX Operations Lead",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "12m ago",
    avatarUrl: "/avatars/beaver-sophia.jpg",
  },
  {
    id: "mem_3",
    name: "Marcus Vance",
    email: "marcus.partner@servicev8.com",
    role: "Tier 2 Escalation Agent",
    status: "active",
    twoFactorEnabled: false,
    lastActive: "1h ago",
    avatarUrl: "/avatars/beaver-curator.jpg",
  },
  {
    id: "mem_4",
    name: "David Kim",
    email: "david.field@servicev8.com",
    role: "Security & Compliance Auditor",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "3h ago",
    avatarUrl: "/avatars/beaver-ops.jpg",
  },
];

export async function GET() {
  return NextResponse.json({ success: true, members: membersStore });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { memberId, updates } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const index = membersStore.findIndex((m) => m.id === memberId);
    if (index === -1) {
      // If not found by ID, match by email
      const emailIndex = membersStore.findIndex(
        (m) => m.email.toLowerCase() === (updates.email || "").toLowerCase()
      );
      if (emailIndex !== -1) {
        membersStore[emailIndex] = { ...membersStore[emailIndex], ...updates };
        return NextResponse.json({ success: true, member: membersStore[emailIndex] });
      }
      // Or add as new member
      const newMember: TenantMember = {
        id: memberId,
        name: updates.name || "Team Member",
        email: updates.email || "member@servicev8.com",
        role: updates.role || "Tier 2 Escalation Agent",
        status: updates.status || "active",
        twoFactorEnabled: updates.twoFactorEnabled ?? true,
        lastActive: "Just now",
        avatarUrl: updates.avatarUrl || "/avatars/beaver-manager.jpg",
      };
      membersStore.push(newMember);
      return NextResponse.json({ success: true, member: newMember });
    }

    membersStore[index] = {
      ...membersStore[index],
      ...updates,
    };

    return NextResponse.json({ success: true, member: membersStore[index] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update member" }, { status: 500 });
  }
}
