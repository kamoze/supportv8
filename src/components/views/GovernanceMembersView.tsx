"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  Mail,
  Lock,
  MoreVertical,
  Search,
  HardHat,
  HelpCircle,
  FolderPlus,
  Trash2,
  Edit2,
  Radio,
  Check,
  Plus,
} from "lucide-react";
import type { TenantMember } from "@/lib/types/marketplace-types";
import type { MemberGroup, ChatStreamType } from "@/lib/types";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";

interface GovernanceMembersViewProps {
  members: TenantMember[];
  onOpenInviteModal: () => void;
}

export function GovernanceMembersView({
  members,
  onOpenInviteModal,
}: GovernanceMembersViewProps) {
  const [activeTab, setActiveTab] = useState<"groups" | "roster" | "presence">("groups");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [groups, setGroups] = useState<MemberGroup[]>(ChatWorkflowService.listGroups());
  const [staffPresence, setStaffPresence] = useState(ChatWorkflowService.listStaffPresence());

  // New Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupStream, setGroupStream] = useState<ChatStreamType | "all">("customers");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupColor, setGroupColor] = useState("#2ED8B6");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "tickets.view",
    "tickets.reply",
  ]);

  const AVAILABLE_PERMISSIONS = [
    { id: "tickets.view", label: "View Assigned Tickets", desc: "Read access to chat sessions and logs" },
    { id: "tickets.reply", label: "Reply & Engage in Chat", desc: "Live omnichannel chat participation" },
    { id: "contractors.manage", label: "Contractor Dispatch & PINs", desc: "Issue lockbox access and work orders" },
    { id: "invoices.approve", label: "Invoice & Payout Verification", desc: "Review vendor payment submissions" },
    { id: "orderv8.refund", label: "OrderV8 Refund Tokens", desc: "Dispatch autonomous credit vouchers up to limit" },
    { id: "forgev8.dispatch", label: "ForgeGW Action Execution", desc: "Trigger external microservices via mTLS" },
    { id: "knowledge.read", label: "Read Internal Knowledge Base", desc: "Access indexed S3 documents" },
    { id: "governance.admin", label: "Full Governance Administration", desc: "Configure BYOM and security policies" },
  ];

  const handleToggleOnline = (email: string, currentOnline: boolean) => {
    const updated = ChatWorkflowService.toggleStaffOnline(email, !currentOnline);
    setStaffPresence([...ChatWorkflowService.listStaffPresence()]);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const newGroup = ChatWorkflowService.createGroup({
      name: groupName.trim(),
      streamType: groupStream,
      description: groupDesc.trim() || "Custom RBAC user group",
      color: groupColor,
      permissions: selectedPermissions,
      memberEmails: ["inigodwin@redoo.solutions"],
      isSystem: false,
    });

    setGroups([...ChatWorkflowService.listGroups()]);
    setIsGroupModalOpen(false);
    setGroupName("");
    setGroupDesc("");
  };

  const handleDeleteGroup = (groupId: string) => {
    ChatWorkflowService.deleteGroup(groupId);
    setGroups([...ChatWorkflowService.listGroups()]);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const filteredMembers = members.filter(
    (m) =>
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Team Members, Groups &amp; RBAC Table</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Define user groups matching chat options (Contractors, Customers, Enquiries, Staff, Admin) with granular RBAC permissions and online agent routing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsGroupModalOpen(true)}
            className="btn btn-secondary py-2.5 px-4 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#2ED8B6]" />
            <span>Add Group</span>
          </button>

          <button
            type="button"
            onClick={onOpenInviteModal}
            className="btn btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* View Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
        <button
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "groups"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 font-bold"
              : "text-[#8E9AA8] hover:bg-[#141C26] hover:text-[#EAF1F8]"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Group Table &amp; RBAC Permissions ({groups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("roster")}
          className={`px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "roster"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 font-bold"
              : "text-[#8E9AA8] hover:bg-[#141C26] hover:text-[#EAF1F8]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Roster Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("presence")}
          className={`px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "presence"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 font-bold"
              : "text-[#8E9AA8] hover:bg-[#141C26] hover:text-[#EAF1F8]"
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-[#2ED8B6]" />
          <span>Live Online Presence &amp; Routing Queue</span>
        </button>
      </div>

      {/* TAB 1: GROUP TABLE & RBAC PERMISSIONS */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="card p-5 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-4 hover:border-[#2ED8B6]/40 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: `${group.color}20`, color: group.color, border: `1px solid ${group.color}40` }}
                    >
                      {group.streamType === "contractors" ? (
                        <HardHat className="w-5 h-5" />
                      ) : group.streamType === "enquiries" ? (
                        <HelpCircle className="w-5 h-5" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#EAF1F8]">{group.name}</h3>
                        <span
                          className="pill text-[9px] font-mono uppercase"
                          style={{ borderColor: `${group.color}60`, color: group.color }}
                        >
                          {group.streamType.toUpperCase()}
                        </span>
                        {group.isSystem && (
                          <span className="pill text-[9px] font-mono bg-[#18222E] text-[#6B7C8D]">
                            System Group
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8E9AA8] mt-0.5">{group.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#6B7C8D]">
                      {group.memberEmails.length} assigned members
                    </span>
                    {!group.isSystem && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg hover:bg-[#E5484D]/15 text-[#6B7C8D] hover:text-[#E5484D] transition-colors cursor-pointer"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Details: Members & RBAC Permissions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Assigned Members */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                      Assigned Support Members
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {group.memberEmails.map((email, idx) => {
                        const presence = staffPresence.find((s) => s.email.toLowerCase() === email.toLowerCase());
                        const isOnline = presence?.isOnline ?? false;
                        return (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-xl bg-[#18222E] border border-[var(--line)] text-[11px] font-mono text-[#EAF1F8] flex items-center gap-1.5"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#2ED8B6] shadow-sm shadow-[#2ED8B6]" : "bg-[#6B7C8D]"}`}
                              title={isOnline ? "Online (Receiving Live Chats)" : "Offline"}
                            />
                            <span>{email.split("@")[0]}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Permissions Chips */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                      RBAC Restricted Permissions
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {group.permissions.map((perm, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-[#101720] border border-[var(--line)] text-[10px] font-mono text-[#2ED8B6]"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ROSTER MEMBERS */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter members by name or email..."
                className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line)] text-xs focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>
            <div className="text-xs font-mono text-[#6B7C8D]">
              Showing <strong className="text-[#2ED8B6]">{filteredMembers.length}</strong> active members
            </div>
          </div>

          <div className="card rounded-2xl border-[var(--line)] overflow-hidden bg-[#121A24]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[#0C121A] text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name &amp; Email</th>
                  <th className="py-3 px-4">Assigned RBAC Role</th>
                  <th className="py-3 px-4">Channel Groups</th>
                  <th className="py-3 px-4">2FA Status</th>
                  <th className="py-3 px-4">Routing Presence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredMembers.map((m) => {
                  const presence = staffPresence.find((s) => s.email.toLowerCase() === m.email.toLowerCase());
                  const isOnline = presence?.isOnline ?? true;

                  return (
                    <tr key={m.id} className="hover:bg-[#18222E]/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            className="w-8 h-8 rounded-full object-cover border border-[var(--line-2)]"
                          />
                          <div>
                            <div className="font-bold text-[#EAF1F8]">{m.name}</div>
                            <div className="text-[11px] text-[#6B7C8D] font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#2ED8B6]" />
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="pill text-[10px] font-mono bg-[#18222E] text-[#B4C2D0] uppercase">
                          {m.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {groups
                            .filter((g) => g.memberEmails.includes(m.email))
                            .map((g) => (
                              <span
                                key={g.id}
                                className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                                style={{ backgroundColor: `${g.color}15`, color: g.color }}
                              >
                                {g.name.split(" ")[0]}
                              </span>
                            ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {m.mfaEnabled ? (
                          <span className="pill ok text-[10px] font-mono flex items-center gap-1 w-fit">
                            <Lock className="w-3 h-3 text-[#2ED8B6]" />
                            Enforced
                          </span>
                        ) : (
                          <span className="pill warn text-[10px] font-mono flex items-center gap-1 w-fit">
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleOnline(m.email, isOnline)}
                          className={`px-3 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5 cursor-pointer border transition-all ${
                            isOnline
                              ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                              : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D]"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#2ED8B6] animate-pulse" : "bg-[#6B7C8D]"}`} />
                          <span>{isOnline ? "Online" : "Offline"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE ONLINE PRESENCE */}
      {activeTab === "presence" && (
        <div className="space-y-4">
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <h3 className="text-sm font-bold text-[#EAF1F8]">Live Human Agent Queue &amp; Routing Status</h3>
            <p className="text-xs text-[#8E9AA8]">
              When an incoming chat is submitted on the customer portal, the routing engine matches the selected group against online staff members. If all agents are offline, the AI employee takes over autonomously.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffPresence.map((staff, idx) => (
              <div
                key={idx}
                className={`card p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  staff.isOnline
                    ? "bg-[#121A24] border-[#2ED8B6]/40 shadow-sm shadow-[#2ED8B6]/10"
                    : "bg-[#0E1520] border-[var(--line)] opacity-70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={staff.avatar}
                    alt={staff.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[var(--line)]"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-[#EAF1F8]">{staff.name}</h4>
                    <p className="text-[10px] font-mono text-[#6B7C8D]">{staff.email}</p>
                    <div className="text-[10px] font-mono text-[#2ED8B6] mt-1">
                      {staff.activeChatCount} Active Chats
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleOnline(staff.email, staff.isOnline)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer border ${
                    staff.isOnline
                      ? "bg-[#2ED8B6]/20 border-[#2ED8B6] text-[#2ED8B6]"
                      : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${staff.isOnline ? "bg-[#2ED8B6]" : "bg-[#6B7C8D]"}`} />
                  <span>{staff.isOnline ? "ONLINE" : "OFFLINE"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE NEW GROUP MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0E1520] border border-[var(--line-2)] rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Create New Support Channel Group</h3>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0]">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. VIP Enterprise Escalation Desk"
                  required
                  className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#B4C2D0]">Chat Stream Binding</label>
                  <select
                    value={groupStream}
                    onChange={(e) => setGroupStream(e.target.value as any)}
                    className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  >
                    <option value="customers">Customers &amp; Clients</option>
                    <option value="contractors">Contractors &amp; Vendors</option>
                    <option value="enquiries">General Enquiries</option>
                    <option value="all">All Channels (Global Staff)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#B4C2D0]">Badge Accent Color</label>
                  <div className="flex items-center gap-2 pt-1">
                    {["#2ED8B6", "#4D9FFF", "#F5A623", "#E5484D", "#9B51E0"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setGroupColor(c)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          groupColor === c ? "scale-125 ring-2 ring-white" : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0]">Description</label>
                <textarea
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Purpose of this group and who handles these requests..."
                  className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-[#B4C2D0] block">RBAC Restricted Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={`text-left p-2 rounded-xl border text-[11px] transition-all cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#EAF1F8]"
                            : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:bg-[#1C2836]"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-[#2ED8B6] border-[#2ED8B6] text-[#090E15]" : "border-[#6B7C8D]"
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate">{perm.label}</div>
                          <div className="text-[9px] text-[#8E9AA8] line-clamp-1">{perm.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
