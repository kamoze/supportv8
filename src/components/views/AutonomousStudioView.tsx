"use client";

import React, { useState } from "react";
import {
  Cpu,
  Zap,
  Play,
  Bot,
  Sliders,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
  RefreshCw,
  Plus,
  Copy,
} from "lucide-react";
import type { OperatingMode } from "@/lib/types";

interface AutonomousStudioViewProps {
  onNotify: (text: string, type: "success" | "error" | "info") => void;
}

export function AutonomousStudioView({ onNotify }: AutonomousStudioViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"workflows" | "templates" | "simulator">("workflows");

  // Workflow Automations List
  const [workflows, setWorkflows] = useState([
    {
      id: "wf_001",
      name: "VIP Churn & Frustration Fast-Track",
      trigger: "Sentiment == Frustrated AND CustomerTier == Enterprise",
      action: "Auto-Escalate to Tier 2 Lead + Broadcast Slack #cx-oncall",
      status: "active",
      executionsToday: 24,
      varrImpact: "+14.2%",
    },
    {
      id: "wf_002",
      name: "E-Commerce Checkout Glitch Auto-Refund",
      trigger: "Intent == Refund AND Problem == PRB-401 AND Amount <= $50",
      action: "Execute OrderV8 Refund API + Send Confirmation Macro",
      status: "active",
      executionsToday: 68,
      varrImpact: "+22.5%",
    },
    {
      id: "wf_003",
      name: "Dormant Ticket Backlog Sweeper",
      trigger: "LastCustomerMessageAge > 72h AND Status == Pending",
      action: "Send Polite Follow-Up Macro -> Auto-Close after 24h",
      status: "active",
      executionsToday: 142,
      varrImpact: "+9.8%",
    },
    {
      id: "wf_004",
      name: "Knowledge Deficit Resolution Mining",
      trigger: "InteractionStatus == Resolved AND FCR == True AND UnlinkedKnowledge",
      action: "Jordan Authors Draft Knowledge Proposal in KV8",
      status: "active",
      executionsToday: 18,
      varrImpact: "+6.4%",
    },
  ]);

  // Scenario Templates (Default Deploy)
  const [templates] = useState([
    {
      id: "tmpl_ecom",
      name: "E-Commerce Order & Refund Auto-Resolution",
      category: "Commerce",
      description: "End-to-end pipeline connecting OrderV8 with Zendesk & Intercom to automatically verify order delivery status and execute instant refunds under $50.",
      icon: "fi fi-rr-shopping-cart",
      aiEmployee: "Alex (Support Lead)",
      triggers: ["Order Status Inquiry", "Duplicate Charge Claim", "Return Label Request"],
      isDeployed: true,
    },
    {
      id: "tmpl_saas",
      name: "SaaS Outage Blast Radius & Proactive Broadcast",
      category: "SRE & Incident",
      description: "Correlates telemetry spikes from Dominion AIOps, computes affected customer ARR blast radius, and auto-dispatches in-app banners and emails.",
      icon: "fi fi-rr-cloud",
      aiEmployee: "Maya (Incident Analyst)",
      triggers: ["504 Gateway Timeout Spike", "Database Degraded Event"],
      isDeployed: true,
    },
    {
      id: "tmpl_voice",
      name: "Twilio IVR Voice Self-Service & SIP Handoff",
      category: "Telephony",
      description: "Streamlined voice contact center flow with real-time transcription by Echo and automated voice biometrics validation.",
      icon: "fi fi-rr-headset",
      aiEmployee: "Echo (Voice Intern)",
      triggers: ["Inbound SIP Trunk Call", "PIN Phone Verification"],
      isDeployed: false,
    },
    {
      id: "tmpl_kb",
      name: "Autonomous Knowledge Base Deficit Mining",
      category: "Knowledge",
      description: "Continuously monitors unassisted resolution threads and generates vector embeddings to maintain zero knowledge deficit gaps.",
      icon: "fi fi-rr-brain",
      aiEmployee: "Jordan (Knowledge Specialist)",
      triggers: ["High Customer Effort Score", "New Undocumented Resolution"],
      isDeployed: true,
    },
  ]);

  // Simulator State
  const [simMessage, setSimMessage] = useState<string>("I was double-charged $49.00 on checkout step 3 and need an immediate refund.");
  const [simTier, setSimTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [simMode, setSimMode] = useState<OperatingMode>("autonomous");
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const handleRunSimulator = async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_and_execute",
          message: simMessage,
          customerTier: simTier,
          operatingMode: simMode,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSimResult(res.data);
        onNotify("Agentic loop evaluated successfully", "success");
      }
    } catch (err) {
      onNotify("Simulation failed", "error");
    } finally {
      setSimLoading(false);
    }
  };

  const handleDeployTemplate = (templateName: string) => {
    onNotify(`Scenario template "${templateName}" deployed to active workflows!`, "success");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Cpu className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Autonomous Studio &amp; Automations</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Unified engine consolidating Workflow DAGs, Autonomy Safety Guards, and Default Deploy Scenario Templates.
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-[#18222E] border border-[var(--line)]">
          {[
            { id: "workflows", label: "Active Workflows" },
            { id: "templates", label: "Scenario Templates" },
            { id: "simulator", label: "Autonomy Simulator" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: Active Workflows & Automations */}
      {activeSubTab === "workflows" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-[#EAF1F8] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Configured Triggers &amp; Action Pipelines</span>
            </span>
            <button
              type="button"
              onClick={() => onNotify("New workflow builder opened", "info")}
              className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Automation</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((wf) => (
              <div key={wf.id} className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#2ED8B6]">{wf.id}</span>
                    <h3 className="text-xs font-bold text-[#EAF1F8]">{wf.name}</h3>
                  </div>
                  <span className="pill ok text-[9px] font-mono uppercase">
                    <i className="dot"></i>
                    {wf.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line-2)] space-y-1">
                    <span className="text-[10px] text-[#F5A623] block font-bold">WHEN (Trigger):</span>
                    <p className="text-[11px] text-[#EAF1F8]">{wf.trigger}</p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line-2)] space-y-1">
                    <span className="text-[10px] text-[#4CC38A] block font-bold">THEN (Action):</span>
                    <p className="text-[11px] text-[#EAF1F8]">{wf.action}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[10px] font-mono text-[#6B7C8D]">
                  <span>Executions Today: <strong className="text-[#EAF1F8]">{wf.executionsToday}</strong></span>
                  <span className="text-[#2ED8B6] font-bold">VARR Impact: {wf.varrImpact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Default Deploy Scenario Templates */}
      {activeSubTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Default Deploy Industry Blueprints</h3>
              <p className="text-[11px] text-[#6B7C8D]">
                Pre-configured autonomous workflows ready for 1-click deployment to your tenant workspace.
              </p>
            </div>
            <span className="pill ok text-[10px] font-mono">TEMPORAL ORCHESTRATED</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-center text-lg text-[#2ED8B6]">
                        <i className={tmpl.icon} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#EAF1F8]">{tmpl.name}</h4>
                        <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                          {tmpl.category} • Lead: {tmpl.aiEmployee}
                        </span>
                      </div>
                    </div>

                    <span className="pill text-[9px] font-mono">
                      {tmpl.isDeployed ? "DEPLOYED" : "AVAILABLE"}
                    </span>
                  </div>

                  <p className="text-xs text-[#B4C2D0] leading-relaxed">
                    {tmpl.description}
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#6B7C8D] uppercase block">
                      Active Ingress Triggers:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tmpl.triggers.map((trig, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[10px] text-[#2ED8B6] font-mono"
                        >
                          {trig}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#4CC38A] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Production Ready
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeployTemplate(tmpl.name)}
                    className="btn btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{tmpl.isDeployed ? "Re-Deploy" : "Deploy Scenario"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Autonomy Simulator & Safety Policy Gates */}
      {activeSubTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 space-y-4 bg-[#121A24] rounded-2xl border-[var(--line)]">
            <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#2ED8B6]" />
              <span>Simulate Customer Interaction</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1">Customer Input Message</label>
                <textarea
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Customer Tier</label>
                <select
                  value={simTier}
                  onChange={(e) => setSimTier(e.target.value as any)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="standard">Standard Tier ($1,200 ARR)</option>
                  <option value="pro">Pro Tier ($14,400 ARR)</option>
                  <option value="enterprise">Enterprise Tier ($120,000 ARR)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Autonomy Gate Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["observe", "copilot", "autonomous"] as OperatingMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSimMode(m)}
                      className={`btn text-xs font-semibold capitalize cursor-pointer transition-all ${
                        simMode === m ? "btn-primary shadow-sm" : "btn-secondary"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSimulator}
                disabled={simLoading}
                className="btn btn-primary w-full py-2.5 text-xs font-bold cursor-pointer mt-2 flex items-center justify-center gap-2"
              >
                <Bot className="w-4 h-4" />
                <span>{simLoading ? "Evaluating Autonomy Loop..." : "Run Agentic Loop"}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 card p-5 space-y-4 bg-[#121A24] rounded-2xl border-[var(--line)]">
            <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-1.5 font-mono">
              <Shield className="w-4 h-4 text-[#2ED8B6]" />
              <span>Gated Execution &amp; Reasoning Results</span>
            </h3>

            {simResult ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] leading-relaxed">
                  <div className="text-[10px] text-[#2ED8B6] font-bold uppercase mb-1">AI Recommendation:</div>
                  {simResult.resolution.recommendation}
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-[#6B7C8D] uppercase block">Action Gateway Proposals:</span>
                  {simResult.evaluatedProposals?.map((ep: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#2ED8B6]">{ep.proposal.operationId}</span>
                        <span className="pill ok text-[10px] uppercase font-mono">{ep.risk} Risk</span>
                      </div>
                      <p className="text-[11px] text-[#B4C2D0]">{ep.proposal.reason}</p>
                      <div className="text-[10px] pt-1 text-[#4CC38A] font-bold uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Decision: {ep.decision.outcome} ({ep.decision.basis || "safety-pass"})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[#6B7C8D] text-xs font-mono">
                Click &ldquo;Run Agentic Loop&rdquo; to test runtime reasoning, proposal evaluation, and Action Gateway gating.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
