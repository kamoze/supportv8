"use client";

import React from "react";
import { Briefcase, CheckCircle2, X, Zap } from "@/components/ui/FlatIcon";
import type { Issue } from "@/lib/types";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";

export interface WorkAssignModalProps {
  assignDescription: string;
  assignTicketId: string;
  handleConfirmAssignWork: () => Promise<void>;
  isAssigningWork: boolean;
  issues: Issue[];
  selectedEmployeeForAssign: any;
  setAssignDescription: React.Dispatch<React.SetStateAction<string>>;
  setAssignTicketId: React.Dispatch<React.SetStateAction<string>>;
  setIsWorkAssignModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function WorkAssignModal({
  assignDescription,
  assignTicketId,
  handleConfirmAssignWork,
  isAssigningWork,
  issues,
  selectedEmployeeForAssign,
  setAssignDescription,
  setAssignTicketId,
  setIsWorkAssignModalOpen,
}: WorkAssignModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-5 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Assign Work</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">Hired Roster Dispatch</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkAssignModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Employee Info */}
            <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center gap-3">
              <EmployeeAvatar
                src={selectedEmployeeForAssign.avatarUrl}
                name={selectedEmployeeForAssign.name}
                role={selectedEmployeeForAssign.role}
                size={40}
                className="w-10 h-10 rounded-xl object-cover border border-[#2ED8B6]/40 shrink-0"
              />
              <div>
                <div className="text-xs font-bold text-[#EAF1F8]">{selectedEmployeeForAssign.name}</div>
                <div className="text-[10px] text-[#2ED8B6] font-mono uppercase">
                  {selectedEmployeeForAssign.role} • Autonomy: {selectedEmployeeForAssign.autonomyLevel}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  Select Customer Issue / Ticket Queue
                </label>
                <select
                  value={assignTicketId}
                  onChange={(e) => {
                    setAssignTicketId(e.target.value);
                    const iss = issues.find((i) => i.id === e.target.value);
                    if (iss) setAssignDescription(iss.title || iss.summary || "");
                  }}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                >
                  {issues.map((iss) => (
                    <option key={iss.id} value={iss.id}>
                      [{iss.id}] {iss.title || iss.summary} ({iss.customerTier || "Enterprise"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  Resolution Mission / Task Scope
                </label>
                <textarea
                  rows={3}
                  value={assignDescription}
                  onChange={(e) => setAssignDescription(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#121A24] border border-[var(--line)] text-[10px] text-[#4CC38A] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Supervising AI Employee will coordinate sub-tasks across paired specialized interns.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsWorkAssignModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignWork}
                disabled={isAssigningWork || !assignDescription.trim()}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isAssigningWork ? "Dispatching..." : "Confirm & Assign Work"}</span>
              </button>
            </div>
          </div>
        </div>
  );
}
