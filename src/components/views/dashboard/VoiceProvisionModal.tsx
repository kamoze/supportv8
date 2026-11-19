"use client";

import React from "react";
import { CheckCircle2, PhoneCall, X } from "@/components/ui/FlatIcon";

export interface VoiceProvisionModalProps {
  handleProvisionVoiceBot: () => Promise<void>;
  isProvisioningVoice: boolean;
  provEmployeeId: string;
  provFirstMessage: string;
  provMinVerification: string;
  provPermissionScopes: string[];
  provPhoneNumber: string;
  provProvider: "vapi" | "twilio";
  provSystemPrompt: string;
  setIsVoiceProvisionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProvEmployeeId: React.Dispatch<React.SetStateAction<string>>;
  setProvFirstMessage: React.Dispatch<React.SetStateAction<string>>;
  setProvMinVerification: React.Dispatch<React.SetStateAction<string>>;
  setProvPermissionScopes: React.Dispatch<React.SetStateAction<string[]>>;
  setProvPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  setProvProvider: React.Dispatch<React.SetStateAction<"vapi" | "twilio">>;
  setProvSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  workforce: any[];
}

export function VoiceProvisionModal({
  handleProvisionVoiceBot,
  isProvisioningVoice,
  provEmployeeId,
  provFirstMessage,
  provMinVerification,
  provPermissionScopes,
  provPhoneNumber,
  provProvider,
  provSystemPrompt,
  setIsVoiceProvisionModalOpen,
  setProvEmployeeId,
  setProvFirstMessage,
  setProvMinVerification,
  setProvPermissionScopes,
  setProvPhoneNumber,
  setProvProvider,
  setProvSystemPrompt,
  workforce,
}: VoiceProvisionModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Provision Voice</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">Vapi AI &amp; Twilio Voice Telephony Matching</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceProvisionModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Step 1: Match Local AI Employee */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  1. Match to Local AI Employee Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workforce
                    .filter((w) => w.level === "ai_employee")
                    .map((emp) => {
                      const isSelected = provEmployeeId === emp.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setProvEmployeeId(emp.id);
                            setProvSystemPrompt(
                              `You are ${emp.name}, enterprise support voice agent for Acme Cloud. Answer questions concisely, query pgvector knowledge base, and execute authorized tools.`
                            );
                            setProvFirstMessage(
                              `Thank you for calling Acme Support. I am ${emp.name.split("—")[0].trim()}. How can I assist you today?`
                            );
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                              : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                          }`}
                        >
                          <img
                            src={emp.avatarUrl || "/avatars/beaver-sophia.jpg"}
                            alt={emp.name}
                            className="w-8 h-8 rounded-lg object-cover border border-[#2ED8B6]/40 shrink-0"
                          />
                          <div className="truncate">
                            <div className="font-bold text-[11px] text-[#EAF1F8] truncate">{emp.name}</div>
                            <div className="text-[9.5px] opacity-75 font-mono truncate">{emp.role}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Step 2: Telephony Provider & Number Binding */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    2. Telephony Provider
                  </label>
                  <select
                    value={provProvider}
                    onChange={(e) => setProvProvider(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="vapi">Vapi.ai (Autonomous Voice)</option>
                    <option value="twilio">Twilio Voice (SIP Trunk / TwiML)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={provPhoneNumber}
                    onChange={(e) => setProvPhoneNumber(e.target.value)}
                    placeholder="+1 (800) 555-0199"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Min Auth Gate
                  </label>
                  <select
                    value={provMinVerification}
                    onChange={(e) => setProvMinVerification(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="phone_match">Phone Match (Tier 1)</option>
                    <option value="otp_verified">OTP Verified (Tier 2)</option>
                    <option value="authenticated">Full Authenticated</option>
                    <option value="anonymous">Anonymous Ingress</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Granular Permission Scopes Multi-Select */}
              <div>
                <label className="text-[#6B7C8D] block mb-1.5 uppercase text-[10px] font-bold">
                  3. Granted Tool Permission Scopes (Constrained Execution)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "support.problem.status", label: "Outage & Problem Status" },
                    { id: "support.ticket.lookup", label: "Ticket Search & Lookup" },
                    { id: "support.ticket.create", label: "Create & Escalate Ticket" },
                    { id: "support.account.unlock_request", label: "Account MFA Unlock" },
                    { id: "knowledge.rag.search", label: "Knowledge RAG Retrieval" },
                    { id: "orderv8.refund", label: "Autonomous Refund (<$500)" },
                  ].map((scope) => {
                    const isChecked = provPermissionScopes.includes(scope.id);
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setProvPermissionScopes(provPermissionScopes.filter((s) => s !== scope.id));
                          } else {
                            setProvPermissionScopes([...provPermissionScopes, scope.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                            : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <span className="text-[10.5px] font-mono">{scope.label}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: First Message Spoken Greeting */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  4. Initial Spoken Greeting (First Message)
                </label>
                <input
                  type="text"
                  value={provFirstMessage}
                  onChange={(e) => setProvFirstMessage(e.target.value)}
                  placeholder="Thank you for calling Acme Support. How can I assist you today?"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* Step 5: System Prompt */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  5. System Prompt &amp; Conversational Guardrails
                </label>
                <textarea
                  rows={2}
                  value={provSystemPrompt}
                  onChange={(e) => setProvSystemPrompt(e.target.value)}
                  placeholder="You are Sophia, frontline conversational support specialist. Triage inbound callers..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsVoiceProvisionModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProvisionVoiceBot}
                disabled={isProvisioningVoice}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{isProvisioningVoice ? "Provisioning via API..." : "Provision Voice Bot via API"}</span>
              </button>
            </div>
          </div>
        </div>
  );
}
