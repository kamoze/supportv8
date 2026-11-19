"use client";

import React from "react";
import { Check, CheckCircle2, Edit3, Trash2, X } from "@/components/ui/FlatIcon";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";

export interface VoiceAgentEditModalProps {
  editVoiceAgentName: string;
  editVoiceEmployeeId: string;
  editVoiceFirstMessage: string;
  editVoiceIsActive: boolean;
  editVoiceMinVerification: string;
  editVoicePhoneNumber: string;
  editVoiceProvider: "vapi" | "twilio" | "retell" | "bland";
  editVoiceScopes: string[];
  editVoiceServiceMode: "customer" | "official";
  editVoiceSystemPrompt: string;
  handleDeleteVoiceAgent: (configId: string, phone: string) => Promise<void>;
  handleSaveEditVoiceAgent: () => Promise<void>;
  isSavingVoiceEdit: boolean;
  selectedConfigForEdit: any;
  setEditVoiceAgentName: React.Dispatch<React.SetStateAction<string>>;
  setEditVoiceEmployeeId: React.Dispatch<React.SetStateAction<string>>;
  setEditVoiceFirstMessage: React.Dispatch<React.SetStateAction<string>>;
  setEditVoiceIsActive: React.Dispatch<React.SetStateAction<boolean>>;
  setEditVoiceMinVerification: React.Dispatch<React.SetStateAction<string>>;
  setEditVoicePhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  setEditVoiceProvider: React.Dispatch<React.SetStateAction<"vapi" | "twilio" | "retell" | "bland">>;
  setEditVoiceScopes: React.Dispatch<React.SetStateAction<string[]>>;
  setEditVoiceServiceMode: React.Dispatch<React.SetStateAction<"customer" | "official">>;
  setEditVoiceSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  setIsVoiceEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  workforce: any[];
}

export function VoiceAgentEditModal({
  editVoiceAgentName,
  editVoiceEmployeeId,
  editVoiceFirstMessage,
  editVoiceIsActive,
  editVoiceMinVerification,
  editVoicePhoneNumber,
  editVoiceProvider,
  editVoiceScopes,
  editVoiceServiceMode,
  editVoiceSystemPrompt,
  handleDeleteVoiceAgent,
  handleSaveEditVoiceAgent,
  isSavingVoiceEdit,
  selectedConfigForEdit,
  setEditVoiceAgentName,
  setEditVoiceEmployeeId,
  setEditVoiceFirstMessage,
  setEditVoiceIsActive,
  setEditVoiceMinVerification,
  setEditVoicePhoneNumber,
  setEditVoiceProvider,
  setEditVoiceScopes,
  setEditVoiceServiceMode,
  setEditVoiceSystemPrompt,
  setIsVoiceEditModalOpen,
  workforce,
}: VoiceAgentEditModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl max-h-[90vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8] font-sans">Voice Agent</h3>
                  <span className="text-[10px] text-[#6B7C8D]">
                    ID: {selectedConfigForEdit.id} • Provider: {selectedConfigForEdit.provider.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceEditModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Local AI Employee Mapping */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  1. Match Local AI Employee Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workforce
                    .filter((w) => w.level === "ai_employee")
                    .map((emp) => {
                      const isSelected = editVoiceEmployeeId === emp.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setEditVoiceEmployeeId(emp.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                              : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                          }`}
                        >
                          <EmployeeAvatar
                            src={emp.avatarUrl}
                            name={emp.name}
                            role={emp.role}
                            size={32}
                            className="w-8 h-8 rounded-lg object-cover border border-[#2ED8B6]/40 shrink-0"
                          />
                          <div className="truncate">
                            <div className="font-bold text-[11px] text-[#EAF1F8] font-sans truncate">{emp.name}</div>
                            <div className="text-[9.5px] opacity-75 font-mono truncate">{emp.role}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Agent Name & Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Agent Name</label>
                  <input
                    type="text"
                    value={editVoiceAgentName}
                    onChange={(e) => setEditVoiceAgentName(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Phone Number</label>
                  <input
                    type="text"
                    value={editVoicePhoneNumber}
                    onChange={(e) => setEditVoicePhoneNumber(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              {/* Telephony Provider, Service Mode & Voice ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Provider</label>
                  <select
                    value={editVoiceProvider}
                    onChange={(e) => setEditVoiceProvider(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="vapi">Vapi.ai</option>
                    <option value="twilio">Twilio Voice</option>
                    <option value="retell">Retell AI</option>
                    <option value="bland">Bland AI</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Service Mode</label>
                  <select
                    value={editVoiceServiceMode}
                    onChange={(e) => setEditVoiceServiceMode(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="customer">Customer Inbound</option>
                    <option value="official">Official Staff &amp; Field</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Min Auth Gate</label>
                  <select
                    value={editVoiceMinVerification}
                    onChange={(e) => setEditVoiceMinVerification(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="phone_match">Phone Match (Tier 1)</option>
                    <option value="otp_verified">OTP Verified (Tier 2)</option>
                    <option value="authenticated">Full Authenticated</option>
                    <option value="anonymous">Anonymous Ingress</option>
                  </select>
                </div>
              </div>

              {/* Granted Scopes */}
              <div>
                <label className="text-[#6B7C8D] block mb-1.5 uppercase text-[10px] font-bold">
                  Granted Tool Permissions
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "support.problem.status", label: "Problem Status" },
                    { id: "support.ticket.lookup", label: "Ticket Search" },
                    { id: "support.ticket.create", label: "Ticket Create" },
                    { id: "support.account.unlock_request", label: "MFA Unlock" },
                    { id: "knowledge.rag.search", label: "Knowledge RAG" },
                    { id: "orderv8.refund", label: "Refund (<$500)" },
                  ].map((scope) => {
                    const isChecked = editVoiceScopes.includes(scope.id);
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setEditVoiceScopes(editVoiceScopes.filter((s) => s !== scope.id));
                          } else {
                            setEditVoiceScopes([...editVoiceScopes, scope.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                            : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <span className="text-[10px]">{scope.label}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spoken Greeting */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Initial Spoken Greeting</label>
                <input
                  type="text"
                  value={editVoiceFirstMessage}
                  onChange={(e) => setEditVoiceFirstMessage(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">System Prompt</label>
                <textarea
                  rows={3}
                  value={editVoiceSystemPrompt}
                  onChange={(e) => setEditVoiceSystemPrompt(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#18222E] border border-[var(--line)]">
                <div>
                  <span className="text-[11px] font-bold text-[#EAF1F8] block">Voice Line Active Status</span>
                  <span className="text-[9.5px] text-[#6B7C8D]">When active, inbound telephony routes through this agent.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditVoiceIsActive(!editVoiceIsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors ${
                    editVoiceIsActive ? "bg-[#2ED8B6] text-[#04201C]" : "bg-[#223040] text-[#8E9AA8]"
                  }`}
                >
                  {editVoiceIsActive ? "ACTIVE" : "PAUSED"}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => {
                  handleDeleteVoiceAgent(selectedConfigForEdit.id, selectedConfigForEdit.phoneNumber);
                  setIsVoiceEditModalOpen(false);
                }}
                className="btn bg-[#E5484D]/15 hover:bg-[#E5484D]/30 border border-[#E5484D]/40 text-[#FF7575] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Agent</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsVoiceEditModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditVoiceAgent}
                  disabled={isSavingVoiceEdit}
                  className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingVoiceEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
