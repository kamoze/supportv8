"use client";

import React from "react";
import { Bot, Box, Briefcase, Cpu, Lock, MessageSquare, Plus, Shield, ShoppingBag, Sparkles, Users } from "@/components/ui/FlatIcon";

export interface WorkforceDirectoryViewProps {
  handleOpenAssignWorkModal: (emp: any) => void;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedEmployeeId: React.Dispatch<React.SetStateAction<string>>;
  setStudioEmployeeId: React.Dispatch<React.SetStateAction<string>>;
  setStudioSubTab: React.Dispatch<React.SetStateAction<"workflows" | "templates" | "simulator" | "sweeps" | "setup" | "fleet">>;
  setWorkforceFilter: React.Dispatch<React.SetStateAction<"all" | "employees" | "interns" | "catalog">>;
  workforce: any[];
  workforceFilter: "all" | "employees" | "interns" | "catalog";
}

export function WorkforceDirectoryView({
  handleOpenAssignWorkModal,
  setActiveTab,
  setIsChatOpen,
  setSelectedEmployeeId,
  setStudioEmployeeId,
  setStudioSubTab,
  setWorkforceFilter,
  workforce,
  workforceFilter,
}: WorkforceDirectoryViewProps) {
  return (
<div className="space-y-6">
            {/* Top Overview & Roster Header */}
            <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                    <Users className="w-5 h-5" />
                  </span>
                  <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">AI Workforce</h1>
                </div>
              </div>

              {/* Roster Controls: Onboard Button + Filter Strip */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStudioSubTab("setup");
                    setActiveTab("studio");
                  }}
                  className="btn btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard AI Employee</span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#18222E] border border-[var(--line)]">
                  {[
                    { id: "all", label: "All Workforce", count: workforce.length },
                    {
                      id: "employees",
                      label: "Hired AI Employees",
                      count: workforce.filter((w) => w.level === "ai_employee" && (w.hired === undefined || w.hired)).length,
                    },
                    {
                      id: "interns",
                      label: "Paired Sub-Agents",
                      count: workforce.filter((w) => w.level === "ai_intern").length,
                    },
                    {
                      id: "catalog",
                      label: "Onboard via Marketplace",
                      count: workforce.filter((w) => w.level === "ai_employee" && w.hired === false).length,
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setWorkforceFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        workforceFilter === f.id
                          ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                          : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        workforceFilter === f.id ? "bg-[#04201C]/20 text-[#04201C]" : "bg-[#121A24] text-[#8E9AA8]"
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Architectural Policy Banner */}
            <div className="card p-4 bg-[#121A24] border border-[#2ED8B6]/30 rounded-2xl flex items-start gap-3.5 shadow-sm">
              <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#EAF1F8] font-mono">
                    Workforce Hierarchy
                  </h4>
                  <span className="pill ok text-[9px] font-mono">SERVICEV8 SPEC</span>
                </div>
                <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                  <strong>1. Hiring Precedence:</strong> AI Employees must first be <strong>hired / provisioned</strong> before they can be assigned customer tickets or execute workflows.
                  <br />
                  <strong>2. Intern Pairing Constraint:</strong> Specialized Interns are <strong>paired to AI Employees</strong> and execute delegated micro-tasks (auto-tagging, sweeps, transcriptions, OCR). <strong>Interns cannot work or be assigned work directly</strong> by users or external systems.
                </p>
              </div>
            </div>

            {/* SECTION 1: Hired AI Employees (Supervisors & Work Assignees) */}
            {(workforceFilter === "all" || workforceFilter === "employees") && (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase truncate">
                      AI Employees
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7C8D] shrink-0">
                    Direct Assignment
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {workforce
                    .filter((w) => w.level === "ai_employee" && (w.hired === undefined || w.hired))
                    .map((emp) => {
                      const pairedInterns = workforce.filter(
                        (i) => i.level === "ai_intern" && i.supervisorId === emp.id
                      );
                      return (
                        <div
                          key={emp.id}
                          className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-md flex flex-col justify-between"
                        >
                          <div className="space-y-3.5">
                            {/* Employee Header */}
                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--line)]">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img
                                  src={emp.avatarUrl || "/avatars/beaver-manager.jpg"}
                                  alt={emp.name}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#2ED8B6]/50 shadow-md shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight truncate">
                                    {emp.name}
                                  </h4>
                                  <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5 truncate">
                                    {emp.role}
                                  </span>
                                </div>
                              </div>
                              <span className="pill ok text-[9px] font-mono uppercase shrink-0">
                                <i className="dot"></i>
                                HIRED &amp; ACTIVE
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="pill text-[9.5px] font-mono bg-[#18222E] text-[#2ED8B6] border border-[#2ED8B6]/30">
                                $59/mo Voice &bull; 100 mins
                              </span>
                              <span className="pill text-[9.5px] font-mono bg-[#18222E] text-[#B4C2D0] border border-[var(--line-2)]">
                                Two-Tier SSM Bound
                              </span>
                            </div>

                            <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                              {emp.description}
                            </p>

                            {/* Performance Grid */}
                            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#18222E] p-2.5 rounded-xl border border-[var(--line)]">
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">VARR</span>
                                <span className="font-bold text-[#2ED8B6]">{emp.varr}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">CSAT</span>
                                <span className="font-bold text-[#EAF1F8]">{emp.csat}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">ASSIGNED</span>
                                <span className="font-bold text-[#4D9FFF]">{emp.assignedCount}</span>
                              </div>
                            </div>

                            {/* Nested Paired Interns Strip */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                                <span className="uppercase font-bold text-[#2ED8B6] flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Paired Specialized Interns ({pairedInterns.length}):</span>
                                </span>
                                <span>Sub-Agents</span>
                              </div>

                              {pairedInterns.length > 0 ? (
                                <div className="space-y-1.5">
                                  {pairedInterns.map((intern) => (
                                    <div
                                      key={intern.id}
                                      className="p-2 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-between text-xs font-mono"
                                    >
                                      <div className="flex items-center gap-2">
                                        <img
                                          src={intern.avatarUrl || "/avatars/beaver-intern.jpg"}
                                          alt={intern.name}
                                          className="w-5 h-5 rounded-lg object-cover border border-[#2ED8B6]/30 shrink-0"
                                        />
                                        <span className="text-[#EAF1F8] text-[11px] font-bold">
                                          {intern.name.split(" — ")[0]}
                                        </span>
                                      </div>
                                      <span className="pill text-[8.5px] py-0 px-1.5 bg-[#121A24]">
                                        {intern.role.split(" ")[0]}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-[#18222E]/50 border border-[var(--line)] text-[10px] font-mono text-[#6B7C8D] text-center">
                                  No specialized interns currently paired
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Footer */}
                          <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignWorkModal(emp)}
                              className="btn btn-primary py-1.5 px-2 text-xs font-bold flex-1 min-w-[75px] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Briefcase className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Assign</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setIsChatOpen(true);
                              }}
                              className="btn btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#2ED8B6] shrink-0" />
                              <span>Chat</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStudioSubTab("setup");
                                setStudioEmployeeId(emp.id);
                                setActiveTab("studio");
                              }}
                              className="btn btn-secondary py-1.5 px-2 text-xs flex-1 min-w-[90px] flex items-center justify-center gap-1.5 cursor-pointer hover:text-[#2ED8B6]"
                              title="Configure Voice, Connections, and Activation in Studio Setup Wizard"
                            >
                              <Cpu className="w-3.5 h-3.5 text-[#2ED8B6] shrink-0" />
                              <span className="whitespace-nowrap">Onboard</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {workforce.filter((w) => w.level === "ai_employee" && (w.hired === undefined || w.hired)).length === 0 && (
                  <div className="card p-6 rounded-2xl border border-dashed border-[var(--line-2)] bg-[#121A24] text-center space-y-3">
                    <div className="mx-auto w-10 h-10 rounded-xl bg-[#2ED8B6]/10 text-[#2ED8B6] flex items-center justify-center border border-[#2ED8B6]/20">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#EAF1F8]">Empty Workforce</h4>
                      <p className="text-xs text-[#8E9AA8] max-w-md mx-auto">
                        No AI employees are provisioned. Onboard specialized AI employees from Marketplace.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("market_workforce")}
                      className="btn btn-primary text-xs py-2 px-4 font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Open Marketplace</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: Specialized Interns Matrix (Paired Sub-Agents) */}
            {(workforceFilter === "all" || workforceFilter === "interns") && (
              <div className="space-y-3.5 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-[#F5A623] shrink-0" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase truncate">
                      AI Interns
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#E5484D] flex items-center gap-1 shrink-0">
                    <Shield className="w-3 h-3" />
                    <span>Sub-Agents Only</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {workforce
                    .filter((w) => w.level === "ai_intern")
                    .map((intern) => {
                      const supervisor = workforce.find((w) => w.id === intern.supervisorId);
                      return (
                        <div
                          key={intern.id}
                          className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[var(--line-2)] transition-all shadow-md flex flex-col justify-between"
                        >
                          <div className="space-y-3.5">
                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--line)]">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img
                                  src={intern.avatarUrl || "/avatars/beaver-intern.jpg"}
                                  alt={intern.name}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#F5A623]/40 shadow-md shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight truncate">
                                    {intern.name}
                                  </h4>
                                  <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5 truncate">
                                    {intern.role}
                                  </span>
                                </div>
                              </div>
                              <span className="pill warn text-[9px] font-mono uppercase shrink-0">
                                PAIRED SUB-AGENT
                              </span>
                            </div>

                            <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                              {intern.description}
                            </p>

                            {/* Supervisor Pairing Badge */}
                            <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                              <span className="text-[9px] text-[#6B7C8D] uppercase font-mono block font-bold">
                                Supervising AI Employee:
                              </span>
                              <div className="flex items-center gap-2 text-xs font-mono text-[#2ED8B6] font-bold">
                                <Bot className="w-3.5 h-3.5" />
                                <span>{supervisor?.name || "Alex — Support Lead"}</span>
                              </div>
                            </div>

                            {/* Micro-Action Grants */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-[#6B7C8D] uppercase font-mono block">
                                Sub-Task Grants:
                              </span>
                              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                                {intern.grants?.length > 0 ? (
                                  intern.grants.map((g: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[#B4C2D0]">
                                      {g}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[#6B7C8D] text-[10px]">Read-only transcription stream</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Disabled Direct Work Badge */}
                          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                            <span className="text-[#E5484D] flex items-center gap-1 font-bold">
                              <Lock className="w-3 h-3" />
                              <span>No Direct Assignment</span>
                            </span>
                            <span>Delegated Runs: <strong className="text-[#EAF1F8]">{intern.assignedCount}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SECTION 3: ServiceV8 Architecture Handoff - Onboard in Marketplace, Manage in Studio */}
            {(workforceFilter === "all" || workforceFilter === "catalog") && (
              <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border border-[var(--line)] rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                      <ShoppingBag className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                        Hire Workforce
                      </h4>
                      <span className="text-[10px] font-mono text-[#2ED8B6]">SERVICEV8 STANDARD: ONBOARD IN MARKETPLACE • MANAGE IN STUDIO</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#B4C2D0] leading-relaxed">
                    Workforce operates active hired employees and sub-agents. Per ServiceV8 architecture, all AI employee hiring, capability packages, and connectors are onboarded from the <strong>Marketplace</strong> and orchestrated in <strong>Autonomous Studio</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab("studio_marketplace")}
                    className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Onboard in Marketplace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("market_workforce")}
                    className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Installed Products</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudioSubTab("workflows");
                      setActiveTab("studio");
                    }}
                    className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Manage in Studio</span>
                  </button>
                </div>
              </div>
            )}
          </div>
  );
}
