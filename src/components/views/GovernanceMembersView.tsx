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
} from "lucide-react";
import type { TenantMember } from "@/lib/types/marketplace-types";

interface GovernanceMembersViewProps {
  members: TenantMember[];
  onOpenInviteModal: () => void;
}

export function GovernanceMembersView({
  members,
  onOpenInviteModal,
}: GovernanceMembersViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = members.filter(
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
            <h1 className="text-lg font-bold text-[#EAF1F8]">Team Members &amp; RBAC Access Control</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Manage human support agents, escalation managers, compliance auditors, and 2FA authentication requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenInviteModal}
          className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B7C8D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter members by name or role..."
            className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line)] text-xs focus:outline-none focus:border-[#2ED8B6]"
          />
        </div>

        <div className="text-xs font-mono text-[#6B7C8D]">
          Showing <strong className="text-[#2ED8B6]">{filtered.length}</strong> active members
        </div>
      </div>

      {/* Members Table */}
      <div className="card rounded-2xl border-[var(--line)] overflow-hidden bg-[#121A24]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[#0C121A] text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
              <th className="py-3 px-4">Member Name &amp; Email</th>
              <th className="py-3 px-4">Assigned RBAC Role</th>
              <th className="py-3 px-4">2FA Status</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4">Membership</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {filtered.map((m) => (
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
                      <div className="text-[11px] text-[#6B7C8D] font-mono">{m.email}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className="pill text-[10px] font-mono bg-[#18222E] border border-[var(--line-2)] text-[#2ED8B6]">
                    {m.role}
                  </span>
                </td>

                <td className="py-3 px-4 font-mono text-[11px]">
                  {m.twoFactorEnabled ? (
                    <span className="text-[#4CC38A] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Enforced
                    </span>
                  ) : (
                    <span className="text-[#F5A623]">Optional</span>
                  )}
                </td>

                <td className="py-3 px-4 font-mono text-[11px] text-[#B4C2D0]">
                  {m.lastActive}
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`pill text-[9px] font-mono uppercase ${
                      m.status === "active" ? "ok" : "warn"
                    }`}
                  >
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
