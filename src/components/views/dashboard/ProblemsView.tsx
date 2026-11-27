"use client";

import React from "react";
import { Activity, ArrowRight, Briefcase, CheckCircle2, Flame, Layers, Send, ShieldCheck, Target, Zap } from "@/components/ui/FlatIcon";
import type { Issue, Problem } from "@/lib/types";

export interface ProblemsViewProps {
  currentTenantSlug: string;
  fetchData: (overrideTenant?: string) => Promise<void>;
  handleSimulateProblems: () => Promise<void>;
  issues: Issue[];
  notify: (text: string, type?: "success" | "error" | "info") => void;
  openBroadcastModal: (problem: Problem) => void;
  openWorkspaceTicket: (id: string) => void;
  problems: Problem[];
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  setIsEscalateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTicketForEscalation: React.Dispatch<any>;
}

export function ProblemsView({
  currentTenantSlug,
  fetchData,
  handleSimulateProblems,
  issues,
  notify,
  openBroadcastModal,
  openWorkspaceTicket,
  problems,
  setActiveTab,
  setIsEscalateModalOpen,
  setSelectedTicketForEscalation,
}: ProblemsViewProps) {
  return (
<div className="space-y-6">
            <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#EAF1F8]">Problem Matrix</h2>
                  <span className="pill ok text-[9px] font-mono uppercase"><i className="dot"></i> WORK DESK HUB</span>
                  {problems.filter((p) => p.status !== "resolved").length > 0 ? (
                    <span className="pill err text-[9px] font-mono uppercase">
                      <i className="dot"></i> {problems.filter((p) => p.status !== "resolved").length} ACTIVE CLUSTER{problems.filter((p) => p.status !== "resolved").length > 1 ? "S" : ""}
                    </span>
                  ) : (
                    <span className="pill ok text-[9px] font-mono uppercase">
                      <i className="dot"></i> ALL SYSTEMS HEALTHY
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSimulateProblems}
                  className="btn btn-secondary text-xs cursor-pointer flex items-center gap-1.5 font-mono hover:text-[#2ED8B6] hover:border-[#2ED8B6]"
                  title="Simulate or reload demo systemic incident clusters"
                >
                  <Flame className="w-3.5 h-3.5 text-[#FF6B6B]" />
                  <span>{problems.length === 0 ? "Simulate Incident Cluster" : "Reload Demo Clusters"}</span>
                </button>
                <button
                  onClick={() => setActiveTab("workspace")}
                  className="btn btn-secondary text-xs cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Open Work Desk Stream</span>
                </button>
                <button
                  onClick={() => setActiveTab("cx_cockpit")}
                  className="btn btn-primary text-xs cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>CX Cockpit</span>
                </button>
              </div>
            </div>

            {problems.length === 0 ? (
              <div className="card p-8 rounded-2xl bg-[#121A24] border border-[var(--line)] shadow-xl text-center sm:text-left space-y-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#182635] border border-[#2ED8B6]/30 flex items-center justify-center text-[#2ED8B6] shadow-[0_0_24px_rgba(46,216,182,0.15)] shrink-0">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-[#EAF1F8]">Systems Nominal</h3>
                      <span className="pill ok text-[9px] font-mono uppercase"><i className="dot"></i> 0 CLUSTERS</span>
                      <span className="pill text-[9px] font-mono uppercase bg-[#18222E] text-[#6B7C8D] border border-[var(--line)]">
                        PIPELINE ONLINE (10m SLIDING WINDOW)
                      </span>
                    </div>
                    <p className="text-xs text-[#B4C2D0] max-w-2xl leading-relaxed">
                      {currentTenantSlug === "meridian"
                        ? "Meridian Logistics field dispatch and contractor pipelines are running normally. When 3+ contractors report matching lockbox or dispatch failures, SupportV8 correlates them here."
                        : `All customer touchpoints for '${currentTenantSlug || "this workspace"}' are operating within normal parameters. Inbound customer tickets from web chat, Zendesk, Intercom, and voice are continuously vectorized (1536-dim embeddings) and evaluated for systemic patterns.`}
                    </p>
                  </div>
                </div>

                {/* 3 Architecture Spec Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[var(--line)]">
                  <div className="p-4 rounded-xl bg-[#18222E]/80 border border-[var(--line)] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#2ED8B6]">
                      <Layers className="w-4 h-4" />
                      <span>Vector Symptom Clustering</span>
                    </div>
                    <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                      Aggregates related customer tickets across all ingress channels into root-cause clusters using pgvector 1536-dimensional embeddings.
                    </p>
                    <div className="text-[10px] font-mono text-[#6B7C8D]">Trigger: 3+ tickets / 10m sliding window</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#18222E]/80 border border-[var(--line)] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F5A623]">
                      <Activity className="w-4 h-4" />
                      <span>Business Impact Engine</span>
                    </div>
                    <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                      Quantifies real-time dollar revenue exposure, affected enterprise accounts, and SLA risk score to prioritize engineering mitigation.
                    </p>
                    <div className="text-[10px] font-mono text-[#6B7C8D]">Calculation: ARR weight + Tier blast radius</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#18222E]/80 border border-[var(--line)] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#00F2FE]">
                      <Zap className="w-4 h-4" />
                      <span>Terminal Operations</span>
                    </div>
                    <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                      SRE AI Employees (Barnaby) and operators trigger failover circuit breakers, launch proactive broadcasts, or 1-click mass-resolve all linked cases.
                    </p>
                    <div className="text-[10px] font-mono text-[#6B7C8D]">Actions: Broadcast • Escalate • Mass Resolve</div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--line)]">
                  <div className="text-xs text-[#6B7C8D] font-mono">
                    Want to test incident clustering and resolution workflows?
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSimulateProblems}
                      className="btn btn-primary text-xs flex items-center gap-2 cursor-pointer font-semibold shadow-md"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#FF6B6B]" />
                      <span>Simulate Incident Cluster (Load Demo Problems)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("workspace")}
                      className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Open Work Desk</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cx_cockpit")}
                      className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>CX Cockpit</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {problems.map((prob) => (
                  <div key={prob.id} className="card p-5 space-y-4 rounded-2xl bg-[#121A24] border-[var(--line)] shadow-lg">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2ED8B6]">{prob.id}</span>
                          <span
                            className={`pill ${
                              prob.impact === "critical" || prob.severity === "critical" ? "err" : "warn"
                            }`}
                          >
                            <i className="dot"></i>
                            {prob.impact || prob.severity || "HIGH"} IMPACT
                          </span>
                          <span className="text-xs text-[#6B7C8D] font-mono">
                            {((prob.confidence || 0.94) * 100).toFixed(0)}% Confidence
                          </span>
                          {prob.status === "resolved" && (
                            <span className="pill ok text-[9px] font-mono uppercase">RESOLVED</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[#EAF1F8] mt-1">{prob.title}</h3>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        <div className="bg-[#18222E] px-3.5 py-1.5 rounded-xl border border-[var(--line)] text-right">
                          <span className="text-[#6B7C8D] block text-[10px]">REVENUE EXPOSURE</span>
                          <span className="font-bold text-[#F5A623]">${(prob.estimatedRevenueExposure || 142000).toLocaleString()}</span>
                        </div>
                        <div className="bg-[#18222E] px-3.5 py-1.5 rounded-xl border border-[var(--line)] text-right">
                          <span className="text-[#6B7C8D] block text-[10px]">AFFECTED ACCOUNTS</span>
                          <span className="font-bold text-[#EAF1F8]">{prob.affectedCustomerCount || 12}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#B4C2D0] bg-[#18222E] p-3.5 rounded-xl border border-[var(--line)] leading-relaxed">
                      <strong className="text-[#EAF1F8] font-mono">Root Cause Diagnostic:</strong> {prob.suspectedCause}
                    </p>

                    <div className="flex flex-wrap items-center justify-between pt-2 gap-3 text-xs border-t border-[var(--line)]">
                      <span className="text-[#6B7C8D] font-mono text-xs">
                        Incident Lead: <strong className="text-[#EAF1F8]">{prob.owner || "Barnaby (SRE AI)"}</strong>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const linked = issues.find((i) => i.problemId === prob.id);
                            if (linked) openWorkspaceTicket(linked.id);
                            setActiveTab("workspace");
                            notify(`Inspecting cases linked to ${prob.id} in Work Desk`, "info");
                          }}
                          className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#2ED8B6] hover:border-[#2ED8B6]"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Inspect Desk</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTicketForEscalation({
                              ticketId: prob.id,
                              externalId: prob.id,
                              customerName: `${prob.title} (${prob.affectedCustomerCount || 12} Affected Accounts)`,
                              assignedAgent: prob.owner || "Barnaby (SRE AI)",
                              remainingMinutes: 30,
                              status: "at_risk",
                            });
                            setIsEscalateModalOpen(true);
                          }}
                          className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#F5A623] hover:border-[#F5A623]"
                        >
                          <Zap className="w-3.5 h-3.5 text-[#F5A623]" />
                          <span>Escalate Incident</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openBroadcastModal(prob)}
                          className="btn btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Proactive Broadcast</span>
                        </button>

                        {prob.status !== "resolved" && (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/problems", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "update_status", problemId: prob.id, status: "resolved" }),
                              });
                              notify(`Marked ${prob.id} as Root Cause Resolved!`, "success");
                              fetchData();
                            }}
                            className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#4CC38A] hover:border-[#4CC38A]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#4CC38A]" />
                            <span>Mark Resolved</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  );
}
