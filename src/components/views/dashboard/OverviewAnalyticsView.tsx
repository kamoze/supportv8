"use client";

import React from "react";
import { Activity, AlertTriangle, Award, Bot, CheckCircle2, ChevronRight, DollarSign, Flame, Globe, HeartPulse, Layers, LayoutDashboard, MessageSquare, MessagesSquare, PhoneCall, Plug, ShieldCheck, Target, TrendingUp, Users, Zap } from "@/components/ui/FlatIcon";
import type { Issue, OverviewMetrics, Problem, SourceConnector } from "@/lib/types";

export interface OverviewAnalyticsViewProps {
  customerHealthData: { avgHealthScore: number; totalArrAtRisk: number; criticalCount: number; concerningCount: number; healthyCount: number; activeVipChurnAlerts: any[]; accounts: any[]; };
  hasOperationalAnalytics: boolean;
  issues: Issue[];
  notify: (text: string, type?: "success" | "error" | "info") => void;
  overview: OverviewMetrics;
  problems: Problem[];
  qaData: { overallQaAverage: number; aiEmployeeAverage: number; humanAgentAverage: number; hallucinationRate: number; fcrAverage: number; scorecards: any[]; };
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  slaData: { attainmentRate: number; totalTracked: number; healthyCount: number; atRiskCount: number; breachedCount: number; tickets: any[]; };
  sources: SourceConnector[];
  voiceData: { phoneConfigs: any[]; sessions: any[]; };
  workforce: any[];
}

export function OverviewAnalyticsView({
  customerHealthData,
  hasOperationalAnalytics,
  issues,
  notify,
  overview,
  problems,
  qaData,
  setActiveTab,
  slaData,
  sources,
  voiceData,
  workforce,
}: OverviewAnalyticsViewProps) {
          const activeProblemsList = problems.filter((p) => p.status !== "resolved");
          const liveActiveProblems = activeProblemsList.length > 0 ? activeProblemsList.length : overview.activeProblems;
          const totalAffectedCustomers = activeProblemsList.reduce((s, p) => s + (p.affectedCustomerCount || 0), 0);

          // Live CSAT calculation
          const positiveIssueCount = issues.filter(
            (i) => (i.sentimentScore ?? 0) >= -0.3 && i.sentiment !== "frustrated"
          ).length;
          const liveCsat = overview.csat > 0
            ? overview.csat
            : (qaData?.overallQaAverage && qaData.overallQaAverage > 0)
            ? qaData.overallQaAverage
            : issues.length > 0
            ? parseFloat(((positiveIssueCount / issues.length) * 100).toFixed(1))
            : 0;

          // Live Ingress Volume
          const totalIngressEvents = sources.reduce((sum, s) => sum + (s.eventCountToday || 0), 0);
          const liveIssueVolume = overview.issueVolume > 0
            ? overview.issueVolume
            : totalIngressEvents > 0
            ? totalIngressEvents
            : issues.length;

          // Live VARR & Resolution Tiers
          const autonomousResolvedCount = issues.filter(
            (i) =>
              i.tags?.includes("autonomous_resolved") ||
              i.status === "resolved" ||
              (i.confidence >= 0.85 && (i.sourceStatus === "closed" || (i.resolutionRiskScore ?? 0) < 0.25))
          ).length;
          const liveVarr = overview.varrRate > 0
            ? overview.varrRate
            : issues.length > 0
            ? parseFloat(((autonomousResolvedCount / issues.length) * 100).toFixed(1))
            : 0;

          const copilotAssistedCount = issues.filter(
            (i) => (i.confidence ?? 0) >= 0.5 && (i.confidence ?? 0) < 0.85 && i.status !== "resolved"
          ).length;
          const copilotRate = issues.length > 0
            ? parseFloat(((copilotAssistedCount / issues.length) * 100).toFixed(1))
            : 0;
          const humanEscalatedRate = Math.max(0, parseFloat((100 - liveVarr - copilotRate).toFixed(1)));

          // Live Business Exposure
          const liveExposure = overview.businessExposure > 0
            ? overview.businessExposure
            : activeProblemsList.reduce((s, p) => s + (p.estimatedRevenueExposure || 0), 0) ||
              customerHealthData?.totalArrAtRisk ||
              0;

          // Sentiment Breakdown
          const sentimentPositiveCount = issues.filter((i) => (i.sentimentScore ?? 0) > 0.2 || i.sentiment === "positive" || i.sentiment === "happy").length;
          const sentimentNeutralCount = issues.filter((i) => ((i.sentimentScore ?? 0) >= -0.2 && (i.sentimentScore ?? 0) <= 0.2) || i.sentiment === "neutral").length;
          const sentimentFrustratedCount = issues.filter((i) => (i.sentimentScore ?? 0) < -0.2 || i.sentiment === "frustrated").length;
          const totalSentimentIssues = issues.length || (sentimentPositiveCount + sentimentNeutralCount + sentimentFrustratedCount) || 1;
          const positivePct = issues.length > 0 ? Math.round((sentimentPositiveCount / totalSentimentIssues) * 100) : 0;
          const neutralPct = issues.length > 0 ? Math.round((sentimentNeutralCount / totalSentimentIssues) * 100) : 0;
          const frustratedPct = issues.length > 0 ? Math.max(0, 100 - positivePct - neutralPct) : 0;

          // SLA & QA benchmarks
          const slaAttainment = slaData?.totalTracked > 0 ? slaData.attainmentRate : (slaData?.attainmentRate ?? 100.0);
          const fcrRate = qaData?.fcrAverage > 0 ? qaData.fcrAverage : 0;

          // Action Required Items
          const displayNeedsAttention = (overview.needsAttention && overview.needsAttention.length > 0)
            ? overview.needsAttention
            : [];

          // Channel Ingress Distribution Data (dynamically mapped from connected sources)
          const totalChannelEvents = sources.reduce((sum, s) => sum + (s.eventCountToday || 0), 0);
          const channelSources = sources.map((s) => {
            const vol = s.eventCountToday || 0;
            const share = totalChannelEvents > 0 ? `${((vol / totalChannelEvents) * 100).toFixed(1)}%` : "0.0%";
            return {
              id: s.id,
              name: s.name,
              protocol: s.type === "zendesk" ? "Email / IMAP" : s.type === "intercom" ? "Realtime WebSocket" : s.type === "twilio_voice" ? "WebRTC / SIP Trunk" : s.type === "stripe" ? "Stripe Webhooks" : "Vector RAG Sync",
              volume: vol,
              share,
              sla: s.status === "connected" ? "99.2%" : "0%",
              status: s.status === "connected" ? "Streaming" : "Disconnected",
              icon: s.type === "twilio_voice" ? PhoneCall : s.type === "intercom" ? MessagesSquare : s.type === "knowledgev8" ? Globe : MessageSquare,
              badgeColor: s.status === "connected" ? "ok" : "warn",
            };
          });

          // AI Workforce Employees (dynamically mapped from live workforce)
          const activeWorkforce = (workforce && workforce.length > 0)
            ? workforce.map((w: any) => {
                const resolvedCount = issues.filter(
                  (i) => (i.assignedTo && i.assignedTo.toLowerCase().includes(w.name?.toLowerCase())) && (i.status === "resolved" || i.sourceStatus === "closed")
                ).length;
                return {
                  id: w.id,
                  name: w.name,
                  title: w.role || w.title || "Autonomous Support AI",
                  tier: w.tier || (w.autonomousMode ? "Tier 1 Full Autonomy" : "Tier 2 Copilot"),
                  specialty: w.description || w.specialty || "Support Automation",
                  handled: resolvedCount,
                  accuracy: resolvedCount > 0 ? 98.4 : 100.0,
                  status: w.status === "disabled" ? "Inactive" : "Active",
                  avatarBg: w.id === "emp_sophia" || w.name?.toLowerCase().includes("sophia")
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30",
                };
              })
            : (overview.aiWorkforce && overview.aiWorkforce.length > 0)
            ? overview.aiWorkforce.map((w: any) => ({
                id: w.id || w.name,
                name: w.name,
                title: w.role || "Autonomous Support AI",
                tier: w.tier || "Tier 1 Full Autonomy",
                specialty: w.specialty || "Customer Support",
                handled: w.handled || 0,
                accuracy: w.accuracy || 100.0,
                status: w.status || "Active",
                avatarBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
              }))
            : [];

          // Live Event Feed (dynamically mapped from overview or live issues)
          const liveEvents = (overview.recentActivity && overview.recentActivity.length > 0)
            ? overview.recentActivity
            : issues && issues.length > 0
            ? issues.slice(0, 10).map((iss, idx) => ({
                id: iss.id || `EVT-00${idx + 1}`,
                type: iss.priority === "urgent" || iss.priority === "high" ? "sentiment_alert" : iss.status === "resolved" ? "action_executed" : "problem_detected",
                description: `${iss.customerName || "Customer"} — ${iss.summary || iss.title} (${(iss.status || "OPEN").toUpperCase()})`,
                timestamp: iss.createdAt ? new Date(iss.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : `${(idx + 1) * 3}m ago`,
              }))
            : [];

          // Check whether Sophia Voice Telephony is enabled for this workspace
          const isSophiaVoiceEnabled = Boolean(
            voiceData.phoneConfigs?.some(
              (cfg: any) =>
                (cfg.agentName?.toLowerCase().includes("sophia") ||
                  cfg.employeeName?.toLowerCase().includes("sophia") ||
                  cfg.employeeId === "emp_voice_specialist" ||
                  cfg.employeeId === "emp_sophia") &&
                cfg.isActive !== false
            ) ||
            (voiceData.phoneConfigs && voiceData.phoneConfigs.length > 0 && voiceData.phoneConfigs.some((c: any) => c.isActive !== false)) ||
            workforce.some(
              (w: any) =>
                (w.id === "emp_voice_specialist" || w.id === "emp_sophia" || w.name?.toLowerCase().includes("sophia")) &&
                w.hired !== false &&
                w.status !== "disabled"
            ) ||
            overview?.aiWorkforce?.some(
              (w: any) => w.name?.toLowerCase().includes("sophia") && w.status === "active"
            ) ||
            (hasOperationalAnalytics && activeWorkforce.some((w) => w.name.toLowerCase().includes("sophia") && w.status === "Active"))
          );

          return (
            <div className="space-y-6">
              {/* GrowthV8 Hero Banner */}
              <div className="card p-6 relative overflow-hidden bg-gradient-to-r from-[#121A24] via-[#121A24] to-[#18222E]">
                <div className="max-w-3xl space-y-1 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="pill ok text-[10px]"><i className="dot"></i> Live Stream</span>
                  </div>
                  <h1 className="text-2xl font-bold text-[#EAF1F8] tracking-tight">
                    Executive Overview
                  </h1>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 relative z-10">
                  <button
                    onClick={() => setActiveTab("cx_cockpit")}
                    className="btn btn-primary cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Open CX Cockpit</span>
                  </button>

                  {/* Launch Voice Telephony (Linked to Sophia if enabled) */}
                  {isSophiaVoiceEnabled ? (
                    <a
                      href="/api/voice/sophia/launch"
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) {
                          e.preventDefault();
                          setActiveTab("voice");
                        }
                      }}
                      className="btn btn-secondary cursor-pointer inline-flex items-center gap-2 border-[#2ED8B6]/30 hover:border-[#2ED8B6]"
                      title="Launch Sophia Voice Telephony &amp; Conversational AI"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Launch Voice Telephony</span>
                      <span className="pill ok text-[9px]"><i className="dot"></i> Sophia</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        notify("Sophia Voice Telephony is not enabled. Opening Marketplace to configure...", "info");
                        setActiveTab("studio_marketplace");
                      }}
                      className="btn btn-secondary cursor-pointer inline-flex items-center gap-2 opacity-75 hover:opacity-100"
                      title="Sophia Voice Telephony is not enabled for this workspace. Click to hire or configure in Marketplace."
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-[#6B7C8D]" />
                      <span>Launch Voice Telephony</span>
                      <span className="pill warn text-[9px]"><i className="dot"></i> Sophia Inactive</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab("studio")}
                    className="btn btn-secondary cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Autonomous Studio</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("workforce")}
                    className="btn btn-secondary cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-[#0091FF]" />
                    <span>AI Workforce ({activeWorkforce.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("problems")}
                    className="btn btn-secondary cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5 text-[#E5484D]" />
                    <span>Problem Matrix ({liveActiveProblems})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("workspace")}
                    className="btn btn-secondary cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-[#F5A623]" />
                    <span>Work Desk</span>
                  </button>
                </div>
              </div>

              {/* GrowthV8 Metric Strip */}
              <div className="metric-grid">
                <div className="metric">
                  <div className="flex items-center justify-between">
                    <span>Customer CSAT</span>
                    <span className={`pill ${overview.csatChange >= 0 ? "ok" : "err"}`}>
                      <i className="dot"></i> {overview.csatChange !== undefined && overview.csatChange !== 0 ? (overview.csatChange > 0 ? `+${overview.csatChange}%` : `${overview.csatChange}%`) : "+0.0%"}
                    </span>
                  </div>
                  <strong>{liveCsat}%</strong>
                  <small>Target 90% Attainment ({positivePct}% positive)</small>
                </div>

                <div className="metric">
                  <div className="flex items-center justify-between">
                    <span>Total Inbound Volume</span>
                    <span className={`pill ${overview.issueVolumeChange >= 0 ? "ok" : "warn"}`}>
                      <i className="dot"></i> {overview.issueVolumeChange !== undefined && overview.issueVolumeChange !== 0 ? (overview.issueVolumeChange > 0 ? `+${overview.issueVolumeChange}%` : `${overview.issueVolumeChange}%`) : "+0%"}
                    </span>
                  </div>
                  <strong>{liveIssueVolume.toLocaleString()}</strong>
                  <small>{channelSources.length} Connected Ingress Lines</small>
                </div>

                <div className="metric border-[#E5484D]/40 bg-[#E5484D]/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#E5484D]">Active Systemic Problems</span>
                    <span className="pill err"><i className="dot"></i> Critical</span>
                  </div>
                  <strong className="text-[#E5484D]">{liveActiveProblems}</strong>
                  <small className="text-[#E5484D]/80">
                    {totalAffectedCustomers} Linked Customer Exposures
                  </small>
                </div>

                <div className="metric">
                  <div className="flex items-center justify-between">
                    <span>North Star VARR</span>
                    <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  </div>
                  <strong className="text-[#2ED8B6]">{liveVarr}%</strong>
                  <small>Verified Autonomous Resolution</small>
                </div>

                <div className="metric">
                  <div className="flex items-center justify-between">
                    <span>At-Risk Revenue</span>
                    <DollarSign className="w-3.5 h-3.5 text-[#F5A623]" />
                  </div>
                  <strong className="text-[#F5A623]">${(liveExposure / 1000).toFixed(0)}k</strong>
                  <small>At-Risk Contract ARR</small>
                </div>
              </div>

              {/* RESOLUTION VELOCITY & AUTONOMY FUNNEL */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Autonomy Tier Funnel */}
                <div className="card p-5 lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--line)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                      <h3 className="text-sm font-bold text-[#EAF1F8] truncate">Resolution Funnel</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="pill ok text-[10px]"><i className="dot"></i> High Efficiency</span>
                      <span className="text-[11px] text-[#6B7C8D] font-mono">Avg Turnaround: 1.8 mins</span>
                    </div>
                  </div>

                  {/* Multi-segment Progress Bar */}
                  <div className="space-y-2">
                    <div className="h-3.5 rounded-full bg-[#18222E] overflow-hidden flex p-0.5 border border-[var(--line)]">
                      <div
                        style={{ width: `${liveVarr}%` }}
                        className="h-full bg-gradient-to-r from-[#2ED8B6] to-[#4CC38A] rounded-l-full transition-all duration-500"
                        title={`Autonomous: ${liveVarr}%`}
                      />
                      <div
                        style={{ width: `${copilotRate}%` }}
                        className="h-full bg-[#0091FF] transition-all duration-500"
                        title={`Copilot-Assisted: ${copilotRate}%`}
                      />
                      <div
                        style={{ width: `${humanEscalatedRate}%` }}
                        className="h-full bg-[#F5A623] rounded-r-full transition-all duration-500"
                        title={`Escalated: ${humanEscalatedRate}%`}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#B4C2D0]">
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#2ED8B6]"></span>
                        <span>Autonomous Tier 1 ({liveVarr}%)</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0091FF]"></span>
                        <span>Copilot Tier 2 ({copilotRate}%)</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]"></span>
                        <span>Specialist Tier 3 ({humanEscalatedRate}%)</span>
                      </span>
                    </div>
                  </div>

                  {/* Velocity Tiers Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-lg bg-[#18222E]/80 border border-[#2ED8B6]/20 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#EAF1F8] truncate">Tier 1: Autonomous AI</span>
                        <span className="pill ok text-[9px] shrink-0">0 Hand-offs</span>
                      </div>
                      <div className="text-xl font-bold font-mono text-[#2ED8B6]">1.2 mins</div>
                      <p className="text-[11px] text-[#6B7C8D]">Avg Resolution Turnaround</p>
                      <div className="text-[10px] text-[#4CC38A] font-medium pt-1 border-t border-[var(--line)]">
                        Cost: $0.42 / resolution
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#18222E]/80 border border-[#0091FF]/20 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#EAF1F8] truncate">Tier 2: Copilot-Assisted</span>
                        <span className="pill route text-[9px] shrink-0">HITL Review</span>
                      </div>
                      <div className="text-xl font-bold font-mono text-[#0091FF]">14.3 mins</div>
                      <p className="text-[11px] text-[#6B7C8D]">Avg Human-in-Loop Time</p>
                      <div className="text-[10px] text-[#0091FF] font-medium pt-1 border-t border-[var(--line)]">
                        Cost: $3.20 / resolution
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#18222E]/80 border border-[#F5A623]/20 space-y-1.5 min-w-0 sm:col-span-2 xl:col-span-1">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#EAF1F8] truncate">Tier 3: Specialist Escalation</span>
                        <span className="pill warn text-[9px] shrink-0">Senior Ops</span>
                      </div>
                      <div className="text-xl font-bold font-mono text-[#F5A623]">3.8 hrs</div>
                      <p className="text-[11px] text-[#6B7C8D]">Complex Incident Mean Time</p>
                      <div className="text-[10px] text-[#F5A623] font-medium pt-1 border-t border-[var(--line)]">
                        Cost: $18.50 / resolution
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations & Efficiency Scorecard */}
                <div className="card p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#2ED8B6]" />
                        <h3 className="text-sm font-bold text-[#EAF1F8]">SLA Efficiency</h3>
                      </div>
                      <span className="pill ok text-[9px]"><i className="dot"></i> Governed</span>
                    </div>

                    <div className="space-y-3.5 mt-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#B4C2D0]">First Contact Resolution (FCR)</span>
                        <span className="text-sm font-bold font-mono text-[#2ED8B6]">{fcrRate}%</span>
                      </div>
                      <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#2ED8B6] h-full rounded-full" style={{ width: `${fcrRate}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#B4C2D0]">SLA Attainment Rate</span>
                        <span className="text-sm font-bold font-mono text-[#4CC38A]">{slaAttainment}%</span>
                      </div>
                      <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#4CC38A] h-full rounded-full" style={{ width: `${slaAttainment}%` }}></div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#2ED8B6]/5 border border-[#2ED8B6]/20 mt-2 space-y-1">
                        <div className="text-xs font-semibold text-[#2ED8B6] flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Estimated Cost Savings</span>
                        </div>
                        <div className="text-lg font-extrabold font-mono text-[#EAF1F8]">
                          {autonomousResolvedCount > 0 ? `$${Math.round(autonomousResolvedCount * 18.08).toLocaleString()} / mo` : "$0 / mo"}
                        </div>
                        <p className="text-[10px] text-[#B4C2D0]">Saved through verified Tier 1 autonomous triage &amp; deflection.</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab("workflows")}
                    className="btn btn-secondary w-full text-xs cursor-pointer justify-center mt-2"
                  >
                    <span>View Autonomy Workflows</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  </button>
                </div>
              </div>

              {/* OMNICHANNEL INGRESS DISTRIBUTION */}
              <div className="card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-4 h-4 text-[#0091FF] shrink-0" />
                    <h3 className="text-sm font-bold text-[#EAF1F8] truncate">Omnichannel Ingress</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <span className="text-[11px] text-[#6B7C8D] font-mono">{channelSources.length} Active Ingress Lines</span>
                    <button
                      onClick={() => setActiveTab("market_connectors")}
                      className="btn btn-secondary text-xs cursor-pointer"
                    >
                      <Plug className="w-3.5 h-3.5 text-[#0091FF]" />
                      <span>Manage Connectors</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {channelSources.length === 0 ? (
                    <div className="col-span-full text-center py-6 text-xs text-[#6B7C8D]">
                      No active ingress channels connected. Configure channels in Manage Connectors.
                    </div>
                  ) : (
                    channelSources.map((ch) => {
                    const Icon = ch.icon;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => {
                          if (ch.id === "voice") {
                            if (isSophiaVoiceEnabled) {
                              setActiveTab("voice");
                            } else {
                              setActiveTab("studio_marketplace");
                            }
                          }
                        }}
                        className={`p-3.5 rounded-lg bg-[#18222E]/80 border border-[var(--line)] space-y-2 hover:border-[#2ED8B6]/40 transition-all ${
                          ch.id === "voice" ? "cursor-pointer" : ""
                        }`}
                        title={ch.id === "voice" ? (isSophiaVoiceEnabled ? "Launch Voice Telephony (Sophia)" : "Configure Voice in Marketplace") : undefined}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="p-1.5 rounded-md bg-[#121A24] border border-[var(--line)]">
                            <Icon className="w-3.5 h-3.5 text-[#2ED8B6]" />
                          </div>
                          <span className="pill ok text-[9px] shrink-0"><i className="dot"></i> {ch.status}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#EAF1F8] truncate">{ch.name}</div>
                          <div className="text-[10px] text-[#6B7C8D] font-mono truncate">{ch.protocol}</div>
                        </div>
                        <div className="pt-1.5 border-t border-[var(--line)] flex items-end justify-between">
                          <div>
                            <div className="text-base font-extrabold font-mono text-[#EAF1F8]">{ch.volume.toLocaleString()}</div>
                            <div className="text-[10px] text-[#6B7C8D]">events today ({ch.share})</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold font-mono text-[#4CC38A]">{ch.sla}</div>
                            <div className="text-[10px] text-[#6B7C8D]">SLA Health</div>
                          </div>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>

              {/* CUSTOMER SENTIMENT & REVENUE RISK RADAR + AI WORKFORCE SCORECARD */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Customer Sentiment & Risk Radar */}
                <div className="card p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-4 h-4 text-[#E5484D]" />
                        <h3 className="text-sm font-bold text-[#EAF1F8]">Sentiment Radar</h3>
                      </div>
                      <span className="pill ok text-[9px]"><i className="dot"></i> Real-time NLP</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <div className="p-3 rounded-lg bg-[#2ED8B6]/5 border border-[#2ED8B6]/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#2ED8B6] font-medium">Delighted &amp; Positive</span>
                          <span className="font-mono font-bold text-[#2ED8B6]">{positivePct}%</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-[#EAF1F8]">{sentimentPositiveCount}</div>
                        <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#2ED8B6] h-full rounded-full" style={{ width: `${positivePct}%` }}></div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0091FF]/5 border border-[#0091FF]/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#0091FF] font-medium">Neutral Inquiries</span>
                          <span className="font-mono font-bold text-[#0091FF]">{neutralPct}%</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-[#EAF1F8]">{sentimentNeutralCount}</div>
                        <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#0091FF] h-full rounded-full" style={{ width: `${neutralPct}%` }}></div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#E5484D]/5 border border-[#E5484D]/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#E5484D] font-medium">Frustrated / At-Risk</span>
                          <span className="font-mono font-bold text-[#E5484D]">{frustratedPct}%</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-[#EAF1F8]">{sentimentFrustratedCount}</div>
                        <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#E5484D] h-full rounded-full" style={{ width: `${frustratedPct}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Monitored Accounts */}
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-[#B4C2D0]">Monitored VIP Enterprise Accounts</div>
                      {customerHealthData?.accounts && customerHealthData.accounts.length > 0 ? (
                        <div className="space-y-1.5">
                          {customerHealthData.accounts.slice(0, 3).map((acc: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line)] flex items-center justify-between text-xs">
                              <div className="space-y-0.5">
                                <div className="font-bold text-[#EAF1F8]">{acc.accountName || acc.name}</div>
                                <div className="text-[10px] text-[#6B7C8D]">
                                  ${(acc.arrExposure || 0).toLocaleString()} ARR • Issue: {acc.primaryFrustrationDriver || "Normal Operations"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-[#B4C2D0]">Health: {acc.healthScore || 100}%</span>
                                <span className={`pill ${acc.riskLevel === "critical_at_risk" ? "err" : acc.riskLevel === "concerning" ? "warn" : "ok"}`}>
                                  <i className="dot"></i> {acc.riskLevel ? acc.riskLevel.replace("_", " ") : "Healthy"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-[#6B7C8D] bg-[#18222E]/40 rounded-lg border border-[var(--line)]">
                          No monitored enterprise accounts flagged with elevated churn risk.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab("cx_cockpit")}
                    className="btn btn-secondary w-full text-xs cursor-pointer justify-center mt-3"
                  >
                    <span>Inspect in 360° Customer Health Cockpit</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  </button>
                </div>

                {/* AI Workforce Productivity Scorecard */}
                <div className="card p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--line)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bot className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                        <h3 className="text-sm font-bold text-[#EAF1F8] truncate">Workforce Scorecard</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#6B7C8D] font-mono">{activeWorkforce.length} Hired Agents</span>
                        <span className="pill ok text-[9px] shrink-0"><i className="dot"></i> All Active</span>
                      </div>
                    </div>

                    <div className="space-y-2.5 mt-4">
                      {activeWorkforce.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[#6B7C8D]">
                          No AI workforce agents provisioned. Configure agents in the Workforce tab.
                        </div>
                      ) : (
                        activeWorkforce.map((emp) => (
                        <div
                          key={emp.id}
                          className="p-3 rounded-lg bg-[#18222E] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs hover:border-[#2ED8B6]/30 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border ${emp.avatarBg}`}>
                              {emp.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#EAF1F8] truncate">{emp.name}</span>
                                <span className="text-[10px] text-[#6B7C8D] font-mono shrink-0">({emp.tier})</span>
                                {emp.name.toLowerCase().includes("sophia") && isSophiaVoiceEnabled && (
                                  <a
                                    href="/api/voice/sophia/launch"
                                    onClick={(e) => {
                                      if (!e.metaKey && !e.ctrlKey) {
                                        e.preventDefault();
                                        setActiveTab("voice");
                                      }
                                    }}
                                    className="pill ok text-[9px] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Launch Sophia Voice Telephony"
                                  >
                                    <PhoneCall className="w-2.5 h-2.5" />
                                    <span>Voice Live</span>
                                  </a>
                                )}
                              </div>
                              <p className="text-[11px] text-[#B4C2D0] leading-tight truncate">{emp.specialty}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right whitespace-nowrap shrink-0 pl-11 sm:pl-0">
                            <div className="font-bold font-mono text-[#2ED8B6]">{emp.handled} resolved</div>
                            <div className="text-[10px] text-[#4CC38A]">{emp.accuracy}% QA Score</div>
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setActiveTab("workforce")}
                      className="btn btn-secondary flex-1 text-xs cursor-pointer justify-center"
                    >
                      <Users className="w-3.5 h-3.5 text-[#0091FF]" />
                      <span>Manage AI Workforce</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("approvals")}
                      className="btn btn-secondary flex-1 text-xs cursor-pointer justify-center"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Autonomy Approvals</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Required: Operations & Incidents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Action Required</h3>
                  </div>
                  <span className="pill warn"><i className="dot"></i> {displayNeedsAttention.length} High Priority</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayNeedsAttention.length === 0 ? (
                    <div className="card p-6 text-center text-[#6B7C8D] space-y-1 col-span-full border border-[var(--line)]">
                      <CheckCircle2 className="w-6 h-6 text-[#2ED8B6]/60 mx-auto" />
                      <h4 className="text-xs font-bold text-[#EAF1F8]">All Clear</h4>
                      <p className="text-[11px] text-[#6B7C8D]">All systemic incidents are stabilized and queues are nominal.</p>
                    </div>
                  ) : (
                    displayNeedsAttention.map((item) => (
                    <div
                      key={item.id}
                      className={`card p-4 space-y-3 border ${
                        item.severity === "critical"
                          ? "border-[#E5484D]/40 bg-[#E5484D]/5"
                          : item.severity === "warning"
                          ? "border-[#F5A623]/40 bg-[#F5A623]/5"
                          : "border-[#0091FF]/40 bg-[#0091FF]/5"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`pill ${
                            item.severity === "critical" ? "err" : item.severity === "warning" ? "warn" : "route"
                          }`}
                        >
                          <i className="dot"></i>
                          {item.impactText}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#EAF1F8]">{item.title}</h4>
                        <p className="text-[11px] text-[#B4C2D0] mt-1 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (item.targetTab) {
                            setActiveTab(item.targetTab as any);
                          }
                        }}
                        className="btn btn-secondary w-full text-xs cursor-pointer justify-center"
                      >
                        <span>{item.actionText}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      </button>
                    </div>
                  )))}
                </div>
              </div>

              {/* Live Support & Incident Operations Feed (Full Width) */}
              <div className="card p-5 space-y-4 w-full">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Operations Feed</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6B7C8D] font-mono">{liveEvents.length} events logged</span>
                    <span className="pill ok"><i className="dot"></i> Real-time Feed</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {liveEvents.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#6B7C8D]">
                      No support or incident events logged yet for this workspace.
                    </div>
                  ) : (
                    liveEvents.map((evt, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#18222E] border border-[var(--line)] flex items-start justify-between gap-3 text-xs hover:border-[#2ED8B6]/30 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#EAF1F8]">{evt.id}</span>
                          <span className={`pill ${evt.type === "problem_detected" || evt.type === "sentiment_alert" ? "err" : evt.type === "action_executed" ? "ok" : "warn"}`}>
                            <i className="dot"></i>
                            {evt.type.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[#B4C2D0] leading-relaxed">{evt.description}</p>
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7C8D] whitespace-nowrap">{evt.timestamp}</span>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          );
        }
