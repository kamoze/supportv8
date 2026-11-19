"use client";

import React from "react";
import { Check, CheckCircle2, Sliders, X } from "@/components/ui/FlatIcon";

export interface PermissionScopesModalProps {
  editPermissionScopes: string[];
  handleSavePermissions: () => Promise<void>;
  selectedConfigForPermissions: any;
  setEditPermissionScopes: React.Dispatch<React.SetStateAction<string[]>>;
  setIsEditPermissionsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function PermissionScopesModal({
  editPermissionScopes,
  handleSavePermissions,
  selectedConfigForPermissions,
  setEditPermissionScopes,
  setIsEditPermissionsModalOpen,
}: PermissionScopesModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-5 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Permission Scopes</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">
                    {selectedConfigForPermissions.phoneNumber} • {selectedConfigForPermissions.agentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPermissionsModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <p className="text-xs text-[#B4C2D0]">
                Configure which tool functions the remote voice agent ({selectedConfigForPermissions.remoteAgentId}) can execute during live phone calls:
              </p>

              <div className="space-y-2">
                {[
                  { id: "support.problem.status", label: "Outage & Systemic Problem Status" },
                  { id: "support.ticket.lookup", label: "Customer Ticket Lookup" },
                  { id: "support.ticket.create", label: "Create & Route Support Ticket" },
                  { id: "support.account.unlock_request", label: "Account MFA Unlock & PIN Check" },
                  { id: "knowledge.rag.search", label: "Knowledge RAG Vector Search" },
                  { id: "orderv8.refund", label: "Autonomous Refund Execution (<$500)" },
                  { id: "comms.broadcast", label: "Incident Broadcast Communication" },
                ].map((scope) => {
                  const isChecked = editPermissionScopes.includes(scope.id);
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setEditPermissionScopes(editPermissionScopes.filter((s) => s !== scope.id));
                        } else {
                          setEditPermissionScopes([...editPermissionScopes, scope.id]);
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                          : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <span className="text-[11px]">{scope.label}</span>
                      {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-[var(--line-2)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsEditPermissionsModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Permissions</span>
              </button>
            </div>
          </div>
        </div>
  );
}
