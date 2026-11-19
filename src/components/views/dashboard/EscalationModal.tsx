"use client";

import React from "react";
import { Bot, CheckCircle2, User, X, Zap } from "@/components/ui/FlatIcon";
import type { AuthSession } from "@/lib/auth-service";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

export interface EscalationModalProps {
  currentRole: "superadmin" | "operator" | "cx_lead" | "contractor_lead" | "technician" | "contractor" | "observer";
  escalateAssignee: string;
  escalateAssigneeType: "ai" | "human";
  escalatePriority: string;
  escalateReason: string;
  fetchData: (overrideTenant?: string) => Promise<void>;
  isSubmittingEscalation: boolean;
  marketplaceWorkforce: MarketplaceWorkforceItem[];
  notify: (text: string, type?: "success" | "error" | "info") => void;
  operatorSession: AuthSession | null;
  selectedTicketForEscalation: any;
  setEscalateAssignee: React.Dispatch<React.SetStateAction<string>>;
  setEscalateAssigneeType: React.Dispatch<React.SetStateAction<"ai" | "human">>;
  setEscalatePriority: React.Dispatch<React.SetStateAction<string>>;
  setEscalateReason: React.Dispatch<React.SetStateAction<string>>;
  setIsEscalateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSubmittingEscalation: React.Dispatch<React.SetStateAction<boolean>>;
}

export function EscalationModal({
  currentRole,
  escalateAssignee,
  escalateAssigneeType,
  escalatePriority,
  escalateReason,
  fetchData,
  isSubmittingEscalation,
  marketplaceWorkforce,
  notify,
  operatorSession,
  selectedTicketForEscalation,
  setEscalateAssignee,
  setEscalateAssigneeType,
  setEscalatePriority,
  setEscalateReason,
  setIsEscalateModalOpen,
  setIsSubmittingEscalation,
}: EscalationModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-6 space-y-5 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Escalate Priority</h3>
                  <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                    Ticket: {selectedTicketForEscalation.externalId} • {selectedTicketForEscalation.customerName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Ticket SLA Health Snapshot */}
            <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-between text-xs font-mono">
              <div className="space-y-0.5">
                <span className="text-[#6B7C8D] text-[10px]">CURRENT ASSIGNEE</span>
                <div className="font-bold text-[#EAF1F8]">{selectedTicketForEscalation.assignedAgent}</div>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[#6B7C8D] text-[10px]">TIME REMAINING</span>
                <div className={`font-bold ${selectedTicketForEscalation.remainingMinutes <= 0 ? "text-[#E5484D]" : "text-[#F5A623]"}`}>
                  {selectedTicketForEscalation.remainingMinutes <= 0 ? "BREACHED" : `${selectedTicketForEscalation.remainingMinutes}m buffer`}
                </div>
              </div>
            </div>

            {/* Support Personnel Category Switcher */}
            <div className="space-y-2">
              <label className="text-[#6B7C8D] block font-mono text-[10px] uppercase font-bold">
                Target Support Personnel Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#18222E] p-1 rounded-xl border border-[var(--line)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEscalateAssigneeType("ai");
                    setEscalateAssignee(marketplaceWorkforce.find((employee) => employee.isHired)?.name || "");
                  }}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    escalateAssigneeType === "ai"
                      ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>AI Employee Workforce</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEscalateAssigneeType("human");
                    setEscalateAssignee(operatorSession?.name || operatorSession?.email || "Authenticated operator");
                  }}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    escalateAssigneeType === "human"
                      ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Human Support Personnel</span>
                </button>
              </div>
            </div>

            {/* Personnel Selection Grid */}
            <div className="space-y-2">
              <label className="text-[#6B7C8D] block font-mono text-[10px] uppercase font-bold">
                Select Escalation Assignee
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {escalateAssigneeType === "ai" && !marketplaceWorkforce.some((employee) => employee.isHired) && (
                  <div className="sm:col-span-2 rounded-xl border border-[var(--line)] bg-[#18222E] p-3 text-[#8E9AA8]">
                    No AI employees are hired for this tenant. Choose the authenticated operator or hire an employee first.
                  </div>
                )}
                {(escalateAssigneeType === "ai"
                  ? marketplaceWorkforce
                      .filter((employee) => employee.isHired)
                      .map((employee) => ({ id: employee.name, role: employee.role, icon: Bot }))
                  : [
                      {
                        id: operatorSession?.name || operatorSession?.email || "Authenticated operator",
                        role: currentRole === "cx_lead" ? "CX Lead" : "Operator",
                        icon: User,
                      },
                    ]
                ).map((person) => {
                  const isSelected = escalateAssignee === person.id;
                  const Icon = person.icon;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setEscalateAssignee(person.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                          : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-[11px] text-[#EAF1F8]">{person.id.split(" — ")[0]}</div>
                        <div className="text-[10px] opacity-75 font-mono">{person.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escalation Urgency & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Escalation Urgency Level</label>
                <select
                  value={escalatePriority}
                  onChange={(e) => setEscalatePriority(e.target.value)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] font-mono focus:outline-none focus:border-[#2ED8B6]"
                >
                  <option value="urgent">P1 Urgent (Executive Override)</option>
                  <option value="high">P2 High (Fast-Track Queue)</option>
                  <option value="critical">Critical (SLA Hazard Protection)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Escalation Trigger Reason</label>
                <select
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] font-mono focus:outline-none focus:border-[#2ED8B6]"
                >
                  <option value="SLA Pre-breach Hazard & Executive VIP Priority">SLA Pre-breach Hazard (Imminent Timeout)</option>
                  <option value="High Sentiment Frustration & Churn Exposure">Frustrated Sentiment & Churn Exposure</option>
                  <option value="Complex Root Cause Investigation Required">Complex Root Cause Investigation Required</option>
                  <option value="Executive VIP Account Escalation">Executive VIP Account Escalation</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Auto-Extends SLA Target by 45 mins
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEscalateModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingEscalation || !escalateAssignee}
                  onClick={async () => {
                    setIsSubmittingEscalation(true);
                    try {
                      const res = await fetch("/api/cx/sla", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ticketId: selectedTicketForEscalation.ticketId,
                          assignee: escalateAssignee,
                          assigneeType: escalateAssigneeType,
                          escalationReason: escalateReason,
                          priority: escalatePriority,
                        }),
                      }).then((r) => r.json());

                      if (res.success) {
                        notify(res.message, "success");
                        setIsEscalateModalOpen(false);
                        fetchData();
                      } else {
                        notify(res.error || "Failed to escalate ticket", "error");
                      }
                    } catch (err) {
                      notify("Failed to escalate ticket", "error");
                    } finally {
                      setIsSubmittingEscalation(false);
                    }
                  }}
                  className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Confirm Escalation &amp; Re-Assign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
