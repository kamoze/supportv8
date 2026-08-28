"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HelpCircle,
  X,
  Sparkles,
  CheckCircle2,
  Bug,
  Lightbulb,
  AlertCircle,
  Send,
  ExternalLink,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

export interface GuideEntry {
  label: string;
  what: string;
  actions: string[];
  tip: string;
}

export const GUIDE_CONTENT: Record<string, GuideEntry> = {
  overview: {
    label: "Executive Overview",
    what: "Your enterprise support posture at a glance: real-time Autonomous Resolution Rate (VARR), active incident clusters, SLA risk breakdown, and quick action shortcuts.",
    actions: [
      "Monitor the Autonomous Resolution percentage — healthy baseline is > 70%.",
      "Watch active problem clusters to identify upstream outage blast radii.",
      "Jump straight to the Workspace or CX Cockpit using top action cards.",
    ],
    tip: "A sharp drop in sentiment across multiple tickets usually precedes major webhook or gateway outages.",
  },
  workspace: {
    label: "Workspace",
    what: "High-velocity 3-pane agentic workstation: live queue triage, multi-turn customer thread, Customer 360 ARR context, and AI 1-click action dispatcher.",
    actions: [
      "Review AI-suggested confidence match and 1-click resolve routine inquiries.",
      "Dispatch direct OrderV8 refund tokens and trigger idempotent reversals.",
      "Generate cross-vertical handoff tokens to bridge support and engineering.",
    ],
    tip: "Press Shift + Enter inside the editor for new lines, or drag the bottom-right corner to expand the resolution box.",
  },
  cx_cockpit: {
    label: "CX Cockpit & Performance Funnel",
    what: "Executive customer experience command: Involvement rate, resolution funnel stages, Voice of the Customer (VoC) sentiment, and automated QA scorecards.",
    actions: [
      "Inspect the 4-stage resolution funnel (Ingress → Triage → Autonomous → Escalated).",
      "Review Eleanor's automated QA scorecards scoring empathy, accuracy, and tone.",
      "Export executive CX PDF/CSV summary reports with 1-click.",
    ],
    tip: "VoC digests are refreshed continuously every 15 minutes by synthesizing conversation sentiment drifts.",
  },
  issues: {
    label: "Derived Issues",
    what: "Raw customer tickets ingested from Zendesk, Intercom, Slack, and email, normalized with sentiment scores and urgency triage tags.",
    actions: [
      "Filter by sentiment (Frustrated, Neutral, Positive) and priority tier.",
      "Click any issue row to inspect customer history and auto-assigned AI employee.",
      "Directly trigger immediate auto-triage or manual human override.",
    ],
    tip: "Frustrated sentiment tickets (< 0.35) are prioritized at the top of the queue automatically.",
  },
  problems: {
    label: "Problem Matrix",
    what: "Automated problem correlation hub: groups related tickets into systemic root cause clusters with blast radius assessments.",
    actions: [
      "Inspect active incidents (e.g. Stripe 504 Timeout, Okta SAML Drift).",
      "View linked ticket counts, affected customer ARR, and probable root causes.",
      "Trigger 1-click mass resolution once the upstream root cause is fixed.",
    ],
    tip: "Problems automatically correlate when 3+ tickets share similar vector embeddings within a 10-minute sliding window.",
  },
  ask: {
    label: "Ask supportV8 Copilot",
    what: "Enterprise conversational AI copilot: ask complex questions grounded in your 1536-dim pgvector knowledge vault and corporate beaver personas.",
    actions: [
      "Select an AI Employee persona (Alex Lead, Maya Analyst, Jordan Curator) to tailor response focus.",
      "Ask diagnostic queries (e.g. 'How do I resolve SAML clock skew errors?').",
      "Inspect cited runbook chunks and source document provenance links.",
    ],
    tip: "Use the prompt suggestions pill bar for quick one-click diagnostics, and drag the text area corner to expand for long queries.",
  },
  studio: {
    label: "Autonomous Studio",
    what: "Visual workflow orchestrator: build event trigger pipelines, enforce autonomy safety policy gates, and deploy pre-built scenario templates.",
    actions: [
      "Deploy 1-click scenario templates (E-Commerce Auto-Refund, SaaS Outage Broadcast).",
      "Configure safety policy gates to enforce human sign-off on risky mutations.",
      "Test end-to-end trigger-to-action simulation runs.",
    ],
    tip: "Workflows with confidence threshold < 85% automatically downgrade to Copilot mode for human review.",
  },
  workforce: {
    label: "AI Workforce",
    what: "Directory of specialized autonomous AI Employees and Interns with individual skill grants, active shift statuses, and throughput metrics.",
    actions: [
      "Inspect Alex, Maya, Jordan, Eleanor, Vivian, Chip, Rusty, and Echo.",
      "Adjust autonomous execution permissions and skill entitlements.",
      "View live task throughput, resolution velocity, and active tickets.",
    ],
    tip: "AI Interns (Chip, Rusty, Echo) handle high-volume triage, while AI Leads (Alex, Eleanor) enforce governance.",
  },
  voice: {
    label: "Voice Telephony Hub",
    what: "Real-time WebRTC and SIP voice assistance: live inbound/outbound customer phone calls with instant AI speech synthesis and transcript generation.",
    actions: [
      "Launch live interactive WebRTC voice sessions with Vivian Concierge.",
      "Inspect live audio waveform visualizations and real-time sentiment meters.",
      "View automated call summaries, extracted action items, and CRM sync status.",
    ],
    tip: "Echo automatically generates structured call bullet points within 2 seconds of call termination.",
  },
  trends: {
    label: "Trend Radar",
    what: "Predictive analytics: topic cluster growth, emerging customer friction points, and weekly inquiry velocity trends.",
    actions: [
      "Identify rapidly accelerating inquiry topics before they become widespread outages.",
      "Analyze sentiment distribution across product modules and release versions.",
      "Export trend charts for product management and engineering reviews.",
    ],
    tip: "A rising topic with low sentiment is a prime candidate for a new Knowledge Base runbook.",
  },
  insights: {
    label: "Action Insights",
    what: "Proactive AI-mined intelligence: detected customer friction points, process optimization recommendations, and knowledge gap proposals.",
    actions: [
      "Review prioritized insight cards scored by confidence and estimated impact.",
      "Execute 1-click recommended actions (e.g. Broadcast Advisory, Update Runbook).",
      "Dismiss or archive reviewed insights.",
    ],
    tip: "Insights are updated by Maya and Jordan as new ticket patterns are processed.",
  },
  knowledge: {
    label: "Knowledge Suite",
    what: "Enterprise knowledge hub: direct document upload dropzone, S3 vault ingestion, curation & tagging pipeline, RAG chunk editor, and 2D topology graph.",
    actions: [
      "Directly drag and drop PDF, DOCX, Markdown, or CSV files to ingest into S3 Vault.",
      "Curate raw documents into verified articles with RBAC group visibility and tag chips.",
      "Inspect and edit live vector retrieval chunks and boost similarity weights.",
      "Explore the 2D cluster force graph and columnar lifecycle trace flow.",
    ],
    tip: "Curating a document immediately updates the pgvector index so Ask and AI Employees cite the latest steps.",
  },
  stale_work: {
    label: "Stale Work Sweep",
    what: "Autonomous sweep queue managed by Rusty: surfaces abandoned tickets, stalled customer replies, and unassigned escalations.",
    actions: [
      "Review tickets inactive for > 24 hours.",
      "Trigger autonomous gentle follow-up nudges or auto-closure reminders.",
      "Reassign stalled tickets to available human agents or active AI Employees.",
    ],
    tip: "Rusty's automated sweep runs continuously to keep resolution velocity high and queue size low.",
  },
  sources: {
    label: "Vertical Mesh",
    what: "Ingress connectors & webhook network: tracks live event throughput across Zendesk, Intercom, Salesforce, Twilio, Stripe, and AWS S3.",
    actions: [
      "Check connection health, latency, and events processed per minute.",
      "Add new ingress webhook endpoints or configure marketplace subscriptions.",
      "Verify payload schemas and delivery retry queues.",
    ],
    tip: "Subscribed marketplace connectors appear automatically in the Vertical Mesh.",
  },
  market_connectors: {
    label: "Marketplace Connectors",
    what: "Catalog of ready-to-use integrations: Helpdesk (Zendesk, Intercom, Slack), CRM (Salesforce), Telephony (Twilio), Commerce (OrderV8), and S3 Vault.",
    actions: [
      "Subscribe to connectors with 1 click.",
      "Configure API credentials, webhook URLs, and sync polling intervals.",
      "Toggle connectors between active, syncing, and paused states.",
    ],
    tip: "Activating a connector immediately provisions its webhook ingestion listener in the Vertical Mesh.",
  },
  market_workforce: {
    label: "Marketplace Workforce",
    what: "Hire specialized autonomous AI Employees and Interns tailored for CX triage, incident analysis, governance, and telephony.",
    actions: [
      "Browse full persona profiles, skill ratings, and monthly compute rates.",
      "Deploy 1-click hires directly into your active workspace workforce.",
      "Review skill entitlements and autonomous authorization levels.",
    ],
    tip: "All AI Employees are bundled with corporate Beaver avatars and specialized system prompts.",
  },
  market_plans: {
    label: "Plans & Subscriptions",
    what: "Enterprise compute licensing: Growth ($499/mo), Scale ($1,299/mo), and Enterprise ($3,499/mo) tiers with compute unit allocations and SLA guarantees.",
    actions: [
      "Toggle between Monthly and Annual billing (20% discount).",
      "Upgrade or modify plan tiers with 1-click instant provisioning.",
      "Inspect dedicated computing units, concurrency limits, and custom SSO features.",
    ],
    tip: "Annual billing includes priority 24/7 dedicated support and custom LLM fine-tuning.",
  },
  gov_settings: {
    label: "Governance Settings",
    what: "Tenant infrastructure controls: BYOM custom LLMs (Claude, OpenAI, Gemini, Groq, Ollama), vector embedding dimensions, and ForgeGW action gateway security keys.",
    actions: [
      "Configure your own enterprise LLM provider API key, base URL, and temperature.",
      "Select vector embedding provider (OpenAI 1536-dim, Voyage, FastEmbed 384-dim).",
      "Manage ForgeGW zero-trust Action Gateway secret tokens and rate limits.",
      "Test BYOM and ForgeGW connections with real-time latency pingers.",
    ],
    tip: "Keep temperature at 0.2 for deterministic support runbook execution, or raise to 0.5 for creative drafts.",
  },
  gov_members: {
    label: "Governance Members",
    what: "Team member directory and RBAC access roles (Owner, CX Lead, Tier 2 Agent, Compliance Auditor) with 2FA enforcement.",
    actions: [
      "Invite new team members with specific workspace role grants.",
      "Audit 2FA security compliance across all active administrators.",
      "Revoke or modify member permissions on the fly.",
    ],
    tip: "RBAC roles gate actions, while Group tags gate knowledge visibility across the team.",
  },
  gov_audit: {
    label: "Governance Audit Logs",
    what: "Immutable append-only audit trail: every AI decision, external tool execution, policy evaluation, and cryptographic SHA-256 stamp.",
    actions: [
      "Filter audit entries by Actor Type, Category, Risk Level, and Status.",
      "Inspect slide-out drawers showing exact input payloads, duration ms, and IP addresses.",
      "Export audit logs to CSV/JSON and run 1-click 'Verify Hash Chain' cryptographic tests.",
    ],
    tip: "Audit logs are cryptographically sealed with SHA-256 chaining to ensure SOC 2 Type II compliance.",
  },
  gov_reports: {
    label: "Governance Reports",
    what: "Executive compliance digests: autonomous resolution velocity (VARR), AI hallucination drift metrics, and financial cost savings exports.",
    actions: [
      "Review monthly resolution velocity and human escalation ratios.",
      "Inspect hallucination drift scores audited by Eleanor (Compliance Lead).",
      "Export official compliance reports for stakeholders and auditors.",
    ],
    tip: "The hallucination drift score is calculated by cross-verifying citations against grounded knowledge documents.",
  },
  policies: {
    label: "Autonomy Policies",
    what: "Safety guardrails and confidence thresholds: define when AI Employees can execute autonomously versus requiring human supervisor sign-off.",
    actions: [
      "Configure confidence gating thresholds (e.g. 85% for refunds, 90% for broadcasts).",
      "Set prohibited action keywords and maximum autonomous refund dollar caps ($50.00).",
      "Review blocked actions and policy violations.",
    ],
    tip: "Mutations exceeding $50.00 automatically trigger a mandatory human approval request.",
  },
};

interface FloatingPageGuideProps {
  activeTab: string;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
}

export function FloatingPageGuide({ activeTab, onNotify }: FloatingPageGuideProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [panelView, setPanelView] = useState<"guide" | "feedback">("guide");
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "confusing" | "idea">("bug");
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [feedbackEmailMe, setFeedbackEmailMe] = useState<boolean>(true);
  const [isSendingFeedback, setIsSendingFeedback] = useState<boolean>(false);

  const dockRef = useRef<HTMLDivElement | null>(null);

  // Close on click away
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (isOpen && dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [isOpen]);

  const currentGuide = GUIDE_CONTENT[activeTab] || {
    label: "supportV8 Workspace",
    what: "Autonomous customer experience platform powered by multi-channel AI Employees, 1536-dim vector knowledge, and zero-trust action governance.",
    actions: [
      "Navigate through the sidebar to explore intelligence, workforce, and governance suites.",
      "Use Ask supportV8 for interactive conversational Q&A.",
      "Review real-time metrics in the Overview and CX Cockpit.",
    ],
    tip: "Hover or click this floating ? guide on any screen to learn key actions and pro tips.",
  };

  const handleSendFeedback = () => {
    if (!feedbackMessage.trim()) {
      onNotify("Please enter a short description before submitting", "error");
      return;
    }
    setIsSendingFeedback(true);
    setTimeout(() => {
      setIsSendingFeedback(false);
      onNotify(
        `Feedback report for [${currentGuide.label}] received! Our engineering team has been notified.`,
        "success"
      );
      setFeedbackMessage("");
      setPanelView("guide");
      setIsOpen(false);
    }, 600);
  };

  return (
    <div ref={dockRef} className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-2.5 select-none font-sans">
      {/* Floating Flyout Panel */}
      {isOpen && (
        <div className="w-[360px] max-w-[calc(100vw-36px)] max-h-[min(580px,calc(100vh-100px))] overflow-y-auto bg-[#0C121A] border-2 border-[#2ED8B6] rounded-2xl p-5 shadow-[0_15px_45px_rgba(0,0,0,0.65),0_0_25px_rgba(46,216,182,0.2)] ring-1 ring-[#2ED8B6]/40 flex flex-col gap-3.5 animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          {panelView === "guide" ? (
            /* Guide View */
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6]">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-sm text-[#EAF1F8]">{currentGuide.label} &bull; Guide</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-full border border-[var(--line-2)] text-[#6B7C8D] hover:text-[#EAF1F8] hover:border-[#2ED8B6] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* What is this page */}
              <p className="text-xs text-[#B4C2D0] leading-relaxed">{currentGuide.what}</p>

              {/* Key Actions */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono font-bold text-[#6B7C8D] uppercase tracking-wider">
                  Key Actions
                </div>
                <ul className="space-y-1.5 text-xs text-[#EAF1F8] pl-1">
                  {currentGuide.actions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#2ED8B6] font-bold mt-0.5">&bull;</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro Tip Callout */}
              <div className="p-3 rounded-xl bg-[#2ED8B6]/10 border border-[#2ED8B6]/30 text-[#EAF1F8] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#2ED8B6] text-[11px] font-mono uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pro Tip</span>
                </div>
                <p className="text-[11px] text-[#B4C2D0] leading-relaxed">{currentGuide.tip}</p>
              </div>

              {/* Footer Links */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => {
                    onNotify("Opening supportV8 enterprise documentation manual", "info");
                  }}
                  className="text-xs text-[#2ED8B6] hover:text-[#4CC38A] flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>Full manual</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => setPanelView("feedback")}
                  className="text-xs text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer underline underline-offset-2"
                >
                  Report an issue
                </button>
              </div>
            </div>
          ) : (
            /* Report Issue / Feedback View */
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#E5484D]/15 text-[#E5484D]">
                    <Bug className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-sm text-[#EAF1F8]">Report an Issue</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelView("guide")}
                  className="w-6 h-6 rounded-full border border-[var(--line-2)] text-[#6B7C8D] hover:text-[#EAF1F8] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Category Switcher */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "bug", label: "Bug", icon: Bug },
                  { id: "confusing", label: "Confusing", icon: AlertCircle },
                  { id: "idea", label: "Idea", icon: Lightbulb },
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFeedbackCategory(cat.id as any)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        feedbackCategory === cat.id
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                          : "bg-[#18222E] border-[var(--line-2)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-[11px] text-[#6B7C8D] font-mono">
                  Context: <strong className="text-[#EAF1F8]">{currentGuide.label}</strong>
                </label>
                <textarea
                  rows={4}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="What happened? What did you expect to happen?"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] leading-relaxed"
                />
              </div>

              {/* Email me back check */}
              <label className="flex items-center gap-2 text-xs text-[#B4C2D0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackEmailMe}
                  onChange={(e) => setFeedbackEmailMe(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2ED8B6] cursor-pointer"
                />
                <span>Email me back with updates</span>
              </label>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setPanelView("guide")}
                  className="btn btn-secondary py-1.5 px-3 text-xs"
                >
                  Back to Guide
                </button>

                <button
                  type="button"
                  onClick={handleSendFeedback}
                  disabled={isSendingFeedback || !feedbackMessage.trim()}
                  className="btn btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSendingFeedback ? "Sending..." : "Send Report"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating FAB Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open page guide and help dock"
        className={`w-11 h-11 rounded-full border flex items-center justify-center font-mono text-base font-extrabold cursor-pointer transition-all shadow-xl hover:scale-105 ${
          isOpen
            ? "bg-[#2ED8B6] text-[#04201C] border-[#2ED8B6] shadow-[0_0_20px_rgba(46,216,182,0.4)]"
            : "bg-[#121A24] text-[#2ED8B6] border-[#2ED8B6]/50 hover:border-[#2ED8B6] hover:text-[#FFFFFF] hover:shadow-[0_0_15px_rgba(46,216,182,0.3)]"
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : "?"}
      </button>
    </div>
  );
}
