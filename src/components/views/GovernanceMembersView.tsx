"use client";

import React, { useState, useEffect } from "react";
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
  X,
  Camera,
  Sliders,
  Phone,
  MessageSquare,
  Sparkles,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import type { TenantMember } from "@/lib/types/marketplace-types";
import type { MemberGroup, ChatStreamType } from "@/lib/types";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";

interface GovernanceMembersViewProps {
  members: TenantMember[];
  onOpenInviteModal: () => void;
  onUpdateMember?: (updatedMember: TenantMember) => void;
  onUpdateMembers?: (updatedMembers: TenantMember[]) => void;
}

const AVATAR_PRESETS = [
  { id: "alex", label: "Alex (CX Director)", url: "/avatars/beaver-manager.jpg" },
  { id: "sophia", label: "Sophia (Success Lead)", url: "/avatars/beaver-sophia.jpg" },
  { id: "barnaby", label: "Barnaby (Knowledge)", url: "/avatars/beaver-curator.jpg" },
  { id: "arthur", label: "Arthur (Ops Engineer)", url: "/avatars/beaver-ops.jpg" },
  { id: "elena", label: "Elena (Vendor Lead)", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" },
  { id: "marcus", label: "Marcus (Sales Lead)", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
  { id: "david", label: "David (Field Tech)", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" },
];

export function GovernanceMembersView({
  members: initialMembers,
  onOpenInviteModal,
  onUpdateMember,
  onUpdateMembers,
}: GovernanceMembersViewProps) {
  const [activeTab, setActiveTab] = useState<"groups" | "roster" | "presence">("roster");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [localMembers, setLocalMembers] = useState<TenantMember[]>(initialMembers);
  const [groups, setGroups] = useState<MemberGroup[]>(ChatWorkflowService.listGroups());
  const [staffPresence, setStaffPresence] = useState(ChatWorkflowService.listStaffPresence());
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Synchronize with external props
  useEffect(() => {
    if (initialMembers && initialMembers.length > 0) {
      setLocalMembers(initialMembers);
    }
  }, [initialMembers]);

  // Edit Member Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TenantMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<TenantMember["role"]>("CX Operations Lead");
  const [editStatus, setEditStatus] = useState<TenantMember["status"]>("active");
  const [editAvatarUrl, setEditAvatarUrl] = useState("/avatars/beaver-manager.jpg");
  const [editTwoFactor, setEditTwoFactor] = useState(true);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editIsOnline, setEditIsOnline] = useState(true);
  const [editMaxChats, setEditMaxChats] = useState(5);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // New / Edit Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupStream, setGroupStream] = useState<ChatStreamType | "all">("customers");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupColor, setGroupColor] = useState("#2ED8B6");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "tickets.view",
    "tickets.reply",
  ]);

  const openEditGroupModal = (group: any) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupStream(group.streamType || "customers");
    setGroupDesc(group.description || "");
    setGroupColor(group.color || "#2ED8B6");
    setSelectedPermissions(group.permissions || ["tickets.view", "tickets.reply"]);
    setIsGroupModalOpen(true);
  };

  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupName("");
    setGroupStream("customers");
    setGroupDesc("");
    setGroupColor("#2ED8B6");
    setSelectedPermissions(["tickets.view", "tickets.reply"]);
    setIsGroupModalOpen(true);
  };

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

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleToggleOnline = (email: string, currentOnline: boolean) => {
    ChatWorkflowService.toggleStaffOnline(email, !currentOnline);
    setStaffPresence([...ChatWorkflowService.listStaffPresence()]);
    showToast(`Updated live presence for ${email.split("@")[0]}`);
  };

  const openEditMemberModal = (member: TenantMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditStatus(member.status);
    setEditAvatarUrl(member.avatarUrl || "/avatars/beaver-manager.jpg");
    setEditTwoFactor(member.twoFactorEnabled);

    // Find assigned groups
    const assignedGroupIds = groups
      .filter((g) => g.memberEmails.map((e) => e.toLowerCase()).includes(member.email.toLowerCase()))
      .map((g) => g.id);
    setEditGroupIds(assignedGroupIds.length > 0 ? assignedGroupIds : ["group_support"]);

    // Find staff presence
    const presence = staffPresence.find((s) => s.email.toLowerCase() === member.email.toLowerCase());
    setEditIsOnline(presence?.isOnline ?? true);
    setEditMaxChats(5);

    setIsEditModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim() || !editEmail.trim()) return;

    setIsSavingMember(true);
    try {
      const updatedMember: TenantMember = {
        ...editingMember,
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
        avatarUrl: editAvatarUrl,
        twoFactorEnabled: editTwoFactor,
        lastActive: "Active now",
      };

      // 1. Update local state
      const updatedList = localMembers.map((m) =>
        m.id === editingMember.id ? updatedMember : m
      );
      setLocalMembers(updatedList);

      // 2. Sync group memberships in ChatWorkflowService
      const currentGroups = ChatWorkflowService.listGroups();
      currentGroups.forEach((group) => {
        const isSelected = editGroupIds.includes(group.id);
        const hasEmail = group.memberEmails.map((e) => e.toLowerCase()).includes(editEmail.toLowerCase());
        const hadOldEmail = group.memberEmails.map((e) => e.toLowerCase()).includes(editingMember.email.toLowerCase());

        let newEmails = group.memberEmails.filter((e) => e.toLowerCase() !== editingMember.email.toLowerCase() && e.toLowerCase() !== editEmail.toLowerCase());
        if (isSelected) {
          newEmails.push(editEmail.trim());
        }
        ChatWorkflowService.updateGroup(group.id, { memberEmails: newEmails });
      });
      setGroups([...ChatWorkflowService.listGroups()]);

      // 3. Sync presence in ChatWorkflowService
      ChatWorkflowService.toggleStaffOnline(editEmail.trim(), editIsOnline);
      setStaffPresence([...ChatWorkflowService.listStaffPresence()]);

      // 4. Invoke external callbacks
      onUpdateMember?.(updatedMember);
      onUpdateMembers?.(updatedList);

      // 5. Persist to API
      await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: editingMember.id,
          updates: updatedMember,
        }),
      }).catch(() => {});

      setIsEditModalOpen(false);
      showToast(`Successfully updated account profile for ${updatedMember.name}`);
    } catch {
      showToast("Error updating member profile");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    if (editingGroupId) {
      ChatWorkflowService.updateGroup(editingGroupId, {
        name: groupName.trim(),
        streamType: groupStream,
        description: groupDesc.trim() || "Custom RBAC user group",
        color: groupColor,
        permissions: selectedPermissions,
      });
      showToast(`Updated RBAC group "${groupName}"`);
    } else {
      ChatWorkflowService.createGroup({
        name: groupName.trim(),
        streamType: groupStream,
        description: groupDesc.trim() || "Custom RBAC user group",
        color: groupColor,
        permissions: selectedPermissions,
        memberEmails: ["inigodwin@redoo.solutions"],
        isSystem: false,
      });
      showToast(`Created RBAC group "${groupName}"`);
    }

    setGroups([...ChatWorkflowService.listGroups()]);
    setIsGroupModalOpen(false);
    setEditingGroupId(null);
    setGroupName("");
    setGroupDesc("");
  };

  const handleDeleteGroup = (groupId: string) => {
    ChatWorkflowService.deleteGroup(groupId);
    setGroups([...ChatWorkflowService.listGroups()]);
    showToast("Deleted group");
  };

  const toggleGroupSelection = (groupId: string) => {
    setEditGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const filteredMembers = localMembers.filter(
    (m) =>
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-[#121A24] border border-[#2ED8B6] text-[#EAF1F8] shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-[#2ED8B6] shrink-0" />
          <span className="text-xs font-mono">{successToast}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Team Members, Accounts &amp; RBAC Group Matrix</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Manage human agent profiles, corporate credentials, channel group assignments (Contractors, Customers, Enquiries), and live routing presence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openCreateGroupModal}
            className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 font-mono cursor-pointer hover:border-[#2ED8B6]"
          >
            <FolderPlus className="w-4 h-4 text-[#2ED8B6]" />
            <span>+ Create Group</span>
          </button>

          <button
            onClick={onOpenInviteModal}
            className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold cursor-pointer shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
        <button
          onClick={() => setActiveTab("roster")}
          className={`px-4 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "roster"
              ? "bg-[#2ED8B6] text-[#090E15] font-bold shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Roster &amp; Profiles ({localMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "groups"
              ? "bg-[#2ED8B6] text-[#090E15] font-bold shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>RBAC Group Table ({groups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("presence")}
          className={`px-4 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "presence"
              ? "bg-[#2ED8B6] text-[#090E15] font-bold shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live Routing Presence ({staffPresence.filter((s) => s.isOnline).length} Online)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ROSTER MEMBERS & PROFILES */}
      {/* ========================================================================= */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          {/* Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter members by name, email, or role..."
                className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line)] text-xs focus:outline-none focus:border-[#2ED8B6] font-mono"
              />
            </div>
            <div className="text-xs font-mono text-[#6B7C8D]">
              Showing <strong className="text-[#2ED8B6]">{filteredMembers.length}</strong> active team members &bull; Click <strong>Edit Profile</strong> to modify permissions and settings
            </div>
          </div>

          <div className="card rounded-2xl border-[var(--line)] overflow-hidden bg-[#121A24]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[#0C121A] text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Member Name &amp; Email</th>
                  <th className="py-3.5 px-4">Assigned RBAC Role</th>
                  <th className="py-3.5 px-4">Channel Groups</th>
                  <th className="py-3.5 px-4">2FA Status</th>
                  <th className="py-3.5 px-4">Live Presence</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredMembers.map((m) => {
                  const presence = staffPresence.find((s) => s.email.toLowerCase() === m.email.toLowerCase());
                  const isOnline = presence?.isOnline ?? true;

                  return (
                    <tr key={m.id} className="hover:bg-[#18222E]/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={m.avatarUrl || "/avatars/beaver-manager.jpg"}
                            alt={m.name}
                            className="w-9 h-9 rounded-xl object-cover border border-[var(--line-2)] shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-[#EAF1F8] flex items-center gap-1.5">
                              <span>{m.name}</span>
                              {m.status === "active" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6]" title="Active Account" />
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B7C8D] font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#2ED8B6]" />
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="pill text-[10px] font-mono bg-[#18222E] text-[#B4C2D0] uppercase border border-[var(--line)]">
                          {m.role}
                        </span>
                      </td>

                      {/* Channel Groups */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {groups
                            .filter((g) => g.memberEmails.map((e) => e.toLowerCase()).includes(m.email.toLowerCase()))
                            .map((g) => (
                              <span
                                key={g.id}
                                className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold"
                                style={{ backgroundColor: `${g.color}20`, color: g.color, border: `1px solid ${g.color}40` }}
                              >
                                {g.name.split(" ")[0]}
                              </span>
                            ))}
                        </div>
                      </td>

                      {/* 2FA */}
                      <td className="py-3.5 px-4">
                        {m.twoFactorEnabled ? (
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

                      {/* Routing Presence */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleOnline(m.email, isOnline)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer border transition-all ${
                            isOnline
                              ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                              : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D]"
                          }`}
                          title="Click to toggle live chat routing"
                        >
                          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#2ED8B6] animate-pulse" : "bg-[#6B7C8D]"}`} />
                          <span>{isOnline ? "Online" : "Offline"}</span>
                        </button>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openEditMemberModal(m)}
                          className="btn btn-secondary py-1 px-3 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer hover:border-[#2ED8B6] text-[#2ED8B6] shadow-sm"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Profile</span>
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

      {/* ========================================================================= */}
      {/* TAB 2: RBAC GROUP TABLE */}
      {/* ========================================================================= */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="card p-5 rounded-2xl border bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all"
                style={{ borderColor: `${group.color}40` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
                        <span>{group.name}</span>
                        {group.isSystem && (
                          <span className="pill text-[9px] font-mono bg-[#18222E] text-[#6B7C8D]">SYSTEM</span>
                        )}
                      </h3>
                      <p className="text-[11px] font-mono text-[#6B7C8D] uppercase mt-0.5">
                        Stream Focus: <strong style={{ color: group.color }}>{group.streamType}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditGroupModal(group)}
                      className="p-1 text-[#6B7C8D] hover:text-[#2ED8B6] transition-colors cursor-pointer"
                      title="Edit RBAC Group"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!group.isSystem && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1 text-[#6B7C8D] hover:text-[#E5484D] transition-colors cursor-pointer"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#B4C2D0] leading-relaxed">
                  {group.description}
                </p>

                {/* Member Roster Chips */}
                <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                  <label className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                    Group Members ({group.memberEmails.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {group.memberEmails.map((email, idx) => {
                      const member = localMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
                      const presence = staffPresence.find((s) => s.email.toLowerCase() === email.toLowerCase());
                      const isOnline = presence?.isOnline ?? false;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (member) openEditMemberModal(member);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-[#18222E] border border-[var(--line)] text-[11px] font-mono text-[#EAF1F8] flex items-center gap-1.5 hover:border-[#2ED8B6] cursor-pointer"
                          title="Click to edit member profile"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#2ED8B6] shadow-sm shadow-[#2ED8B6]" : "bg-[#6B7C8D]"}`}
                            title={isOnline ? "Online (Receiving Live Chats)" : "Offline"}
                          />
                          <span>{member?.name || email.split("@")[0]}</span>
                          <Edit2 className="w-2.5 h-2.5 text-[#6B7C8D]" />
                        </button>
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
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIVE ONLINE PRESENCE */}
      {/* ========================================================================= */}
      {activeTab === "presence" && (
        <div className="space-y-4">
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <h3 className="text-sm font-bold text-[#EAF1F8]">Live Human Agent Queue &amp; Routing Status</h3>
            <p className="text-xs text-[#8E9AA8]">
              When an incoming chat is submitted on the customer portal, the routing engine matches the selected group against online staff members. If all agents are offline, the AI employee takes over autonomously.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffPresence.map((staff, idx) => {
              const member = localMembers.find((m) => m.email.toLowerCase() === staff.email.toLowerCase());
              return (
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
                      src={staff.avatar || "/avatars/beaver-manager.jpg"}
                      alt={staff.name}
                      className="w-10 h-10 rounded-xl object-cover border border-[var(--line)]"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5">
                        <span>{staff.name}</span>
                        {member && (
                          <button
                            type="button"
                            onClick={() => openEditMemberModal(member)}
                            className="text-[#6B7C8D] hover:text-[#2ED8B6]"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </h4>
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
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TEAM MEMBER ACCOUNT / PROFILE */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 bg-[#090E15]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#121A24] border border-[#2ED8B6] rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#EAF1F8]">Edit Team Member Profile &amp; Account</h3>
                  <p className="text-xs text-[#6B7C8D] font-mono">
                    ID: {editingMember.id} &bull; Manage security, group access, and routing capacity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4 text-xs">
              {/* Avatar Selector */}
              <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-3">
                <label className="font-bold text-[#EAF1F8] block font-mono">Profile Photo &amp; Avatar</label>
                <div className="flex items-center gap-4">
                  <img
                    src={editAvatarUrl || "/avatars/beaver-manager.jpg"}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-[#2ED8B6] shadow-md"
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setEditAvatarUrl(preset.url)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer border ${
                            editAvatarUrl === preset.url
                              ? "bg-[#2ED8B6] text-[#090E15] border-[#2ED8B6] font-bold"
                              : "bg-[#121A24] text-[#B4C2D0] border-[var(--line)] hover:border-[#2ED8B6]"
                          }`}
                        >
                          {preset.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="Or paste custom image URL..."
                      className="w-full bg-[#121A24] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-[11px] font-mono focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#B4C2D0] block mb-1 font-mono">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Ini Godwin"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#B4C2D0] block mb-1 font-mono">Corporate Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g. inigodwin@redoo.solutions"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#B4C2D0] block mb-1 font-mono">Assigned RBAC Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                  >
                    <option value="Owner / CX Director">Owner / CX Director (Full Access)</option>
                    <option value="CX Operations Lead">CX Operations Lead (Supervisory)</option>
                    <option value="Tier 2 Escalation Agent">Tier 2 Escalation Agent</option>
                    <option value="Security & Compliance Auditor">Security &amp; Compliance Auditor</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#B4C2D0] block mb-1 font-mono">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active (Full Portal Access)</option>
                    <option value="invited">Invited (Pending Confirmation)</option>
                    <option value="disabled">Disabled / Suspended</option>
                  </select>
                </div>
              </div>

              {/* Assigned Groups Multi-select */}
              <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                <label className="font-bold text-[#EAF1F8] block font-mono">
                  Assigned RBAC Channel Groups (Routes Live Chats)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groups.map((group) => {
                    const isSelected = editGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleGroupSelection(group.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#121A24] border-[#2ED8B6] shadow-sm"
                            : "bg-[#121A24]/60 border-[var(--line)] opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="font-bold text-[#EAF1F8] text-[11px]">{group.name}</span>
                        </div>
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2ED8B6]" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-[var(--line)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security & Work Desk Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2FA Enforcement */}
                <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#EAF1F8] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Two-Factor Auth (2FA)</span>
                    </div>
                    <div className="text-[10px] text-[#6B7C8D] font-mono">Require hardware key / TOTP</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTwoFactor(!editTwoFactor)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      editTwoFactor ? "bg-[#2ED8B6]" : "bg-[#2C3848]"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                        editTwoFactor ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Live Routing Presence */}
                <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#EAF1F8] flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Routing Presence</span>
                    </div>
                    <div className="text-[10px] text-[#6B7C8D] font-mono">Receive inbound queue chats</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditIsOnline(!editIsOnline)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      editIsOnline ? "bg-[#2ED8B6]" : "bg-[#2C3848]"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                        editIsOnline ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary py-2 px-4 text-xs font-mono"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="btn btn-primary py-2 px-5 text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#2ED8B6]/20"
                >
                  {isSavingMember ? (
                    <span>Saving Updates...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW RBAC GROUP */}
      {/* ========================================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#090E15]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-[#121A24] border border-[#2ED8B6] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#2ED8B6]" />
                <span>{editingGroupId ? "Edit RBAC User Group" : "Create New User Group"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Group Name *</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. VIP Enterprise Escalations"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Stream Binding</label>
                  <select
                    value={groupStream}
                    onChange={(e) => setGroupStream(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                  >
                    <option value="contractors">Contractors &amp; Vendors</option>
                    <option value="enquiries">General Enquiries</option>
                    <option value="customers">Customers &amp; Clients</option>
                    <option value="all">All Omnichannel Streams</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Badge Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    {["#2ED8B6", "#4D9FFF", "#F5A623", "#E5484D", "#9B51E0", "#50E3C2"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setGroupColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          groupColor === c ? "scale-125 ring-2 ring-white" : "opacity-60"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Description</label>
                <textarea
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Briefly describe what this group handles..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[#6B7C8D] block font-mono">Select Permissions</label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`p-2 rounded-xl border transition-colors flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? "bg-[#18222E] border-[#2ED8B6] text-[#EAF1F8]"
                            : "bg-[#121A24] border-[var(--line)] text-[#6B7C8D]"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-[11px]">{perm.label}</div>
                          <div className="text-[10px] text-[#6B7C8D] font-mono">{perm.desc}</div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#2ED8B6]" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="btn btn-secondary py-1.5 px-3 text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary py-1.5 px-4 text-xs font-bold"
                >
                  {editingGroupId ? "Save Group Changes" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
