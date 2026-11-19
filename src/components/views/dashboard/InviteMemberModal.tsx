"use client";

import React from "react";
import { Users, X } from "@/components/ui/FlatIcon";

export interface InviteMemberModalProps {
  handleInviteMember: () => Promise<void>;
  inviteEmail: string;
  inviteName: string;
  inviteRole: "Owner / CX Director" | "CX Operations Lead" | "Tier 2 Escalation Agent" | "Security & Compliance Auditor" | "Contractor Lead" | "Field Technician" | "No SupportV8 Access";
  setInviteEmail: React.Dispatch<React.SetStateAction<string>>;
  setInviteName: React.Dispatch<React.SetStateAction<string>>;
  setInviteRole: React.Dispatch<React.SetStateAction<"Owner / CX Director" | "CX Operations Lead" | "Tier 2 Escalation Agent" | "Security & Compliance Auditor" | "Contractor Lead" | "Field Technician" | "No SupportV8 Access">>;
  setIsInviteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function InviteMemberModal({
  handleInviteMember,
  inviteEmail,
  inviteName,
  inviteRole,
  setInviteEmail,
  setInviteName,
  setInviteRole,
  setIsInviteModalOpen,
}: InviteMemberModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Invite Member</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. jordan@acme.com"
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Assigned RBAC Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none cursor-pointer"
                >
                  <option value="Tier 2 Escalation Agent">Tier 2 Escalation Agent</option>
                  <option value="CX Operations Lead">CX Operations Lead</option>
                  <option value="Security & Compliance Auditor">Security & Compliance Auditor</option>
                  <option value="Owner / CX Director">Owner / CX Director</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInviteMember}
                className="btn btn-primary text-xs"
              >
                Dispatch Invite
              </button>
            </div>
          </div>
        </div>
  );
}
