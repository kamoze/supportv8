import { NextResponse } from "next/server";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";

export async function GET() {
  const groups = ChatWorkflowService.listGroups();
  const staff = ChatWorkflowService.listStaffPresence();
  return NextResponse.json({ groups, staff });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, streamType, description, color, permissions, memberEmails } = body;

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const group = ChatWorkflowService.createGroup({
      name,
      streamType: streamType || "customers",
      description: description || "",
      color: color || "#2ED8B6",
      permissions: permissions || ["tickets.view", "tickets.reply"],
      memberEmails: memberEmails || [],
      isSystem: false,
    });

    return NextResponse.json({ success: true, group });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create group" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { groupId, updates, toggleStaff } = body;

    if (toggleStaff) {
      const { email, isOnline } = toggleStaff;
      const updated = ChatWorkflowService.toggleStaffOnline(email, isOnline);
      return NextResponse.json({ success: true, staff: updated });
    }

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const group = ChatWorkflowService.updateGroup(groupId, updates || {});
    return NextResponse.json({ success: true, group });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update group" }, { status: 500 });
  }
}
