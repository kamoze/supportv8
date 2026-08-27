import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";
import { kv8RetrievalEngine } from "@/lib/rag/retrieval";
import { workforceManager } from "@/lib/workforce";
import { voiceService } from "@/lib/voice/voice-service";
import { slaEngine } from "@/lib/services/sla-engine-service";

export async function POST(req: NextRequest) {
  try {
    const { query, employeeId = "emp_support_lead" } = await req.json();
    const q = (query || "").toLowerCase();

    const employee = workforceManager.getById(employeeId) || workforceManager.getAll()[0];
    let answer = "";
    const citations: Array<{ type: "problem" | "issue" | "insight" | "metric" | "document"; id: string; title: string }> = [];
    const suggestedActions: Array<{ label: string; action: string; targetTab?: string; payload?: any }> = [];

    // 1. Perform KnowledgeV8 status-weighted RAG retrieval
    const searchResults = await kv8RetrievalEngine.query(query, { topK: 3, minScore: 0.60 });
    const topDocMatch = searchResults[0];

    // Persona-grounded logic
    if (topDocMatch && (q.includes("how") || q.includes("what") || q.includes("document") || q.includes("guide") || q.includes("kb") || q.includes("rag"))) {
      answer = `**${employee.name} (${employee.role}):**\n\nI retrieved verified grounded context from our unified Knowledge Base:\n\n${topDocMatch.expandedBody || topDocMatch.matchedSections[0]?.content}\n\n*Source:* **${topDocMatch.title}** (Confidence: ${(topDocMatch.score * 100).toFixed(0)}%, Status: ${topDocMatch.status.toUpperCase()}).`;
      
      for (const res of searchResults) {
        citations.push({
          type: "document",
          id: res.id,
          title: `${res.title} (${res.status})`,
        });
      }
      suggestedActions.push(
        { label: "Inspect Document in Knowledge Suite", action: "navigate", targetTab: "knowledge" },
        { label: "Launch Simulator with Document", action: "navigate", targetTab: "studio" }
      );
    } else if (employee.id === "emp_incident_analyst" || q.includes("exposure") || q.includes("money") || q.includes("revenue") || q.includes("arr") || q.includes("blast")) {
      const activePrb = db.problems.find((p) => p.status === "active") || db.problems[0];
      const totalExposure = db.problems.reduce((sum, p) => sum + p.estimatedRevenueExposure, 0);
      
      answer = `**Maya (Incident & Business Impact Analyst):**\n\nHere is our real-time financial and account risk assessment:\n\n- **Total Active Revenue Exposure**: **$${totalExposure.toLocaleString()} ARR** across ${db.problems.filter((p) => p.status !== "resolved").length} active systemic problems.\n- **Primary Driver**: Problem **${activePrb.id}** (${activePrb.title}) with **${activePrb.affectedEnterpriseCount} Enterprise tier clients** impacted.\n- **Recommended Action**: Proactive communications have an 88% satisfaction retention rate. I can dispatch a broadcast notice immediately.`;
      
      citations.push({ type: "problem", id: activePrb.id, title: activePrb.title });
      suggestedActions.push(
        { label: "Open Proactive Broadcast Notice", action: "broadcast", targetTab: "problems", payload: { problemId: activePrb.id } },
        { label: "View Customer Health Radar", action: "navigate", targetTab: "cx_cockpit" }
      );
    } else if (employee.id === "emp_kb_refresh" || q.includes("gap") || q.includes("article") || q.includes("refresh") || q.includes("proposal")) {
      const gap = db.gaps[0];
      const prop = db.proposals[0];
      
      answer = `**Jordan (Knowledge Refresh Specialist):**\n\nI am continuously auditing ticket resolution trajectories for undocumented solutions:\n\n- **Top Knowledge Gap**: **${gap.topic}** (${gap.recurringIssueCount} recurring cases in 14 days).\n- **Proposed Article Prepared**: **${prop.title}** is staged and ready for publication to eliminate repeat human escalations.\n- **KnowledgeV8 Graph Sync**: 3 federated concepts synced with cosine deduplication >= 0.96.`;
      
      citations.push(
        { type: "insight", id: gap.id, title: gap.topic },
        { type: "document", id: prop.id, title: prop.title }
      );
      suggestedActions.push(
        { label: "Publish Proposal to Knowledge Base", action: "publish", targetTab: "knowledge", payload: { proposalId: prop.id } },
        { label: "Crawl Public Documentation URL", action: "navigate", targetTab: "knowledge" }
      );
    } else if (employee.id === "intern_tagger" || q.includes("tag") || q.includes("intent") || q.includes("category")) {
      answer = `**Chip (Auto-Tagger & Categorizer Intern):**\n\nI have auto-categorized **642 tickets** today with an average accuracy of 96.2%:\n\n- **Billing & Checkout**: 48% (Urgency: High)\n- **Auth & SSO (Okta/SAML)**: 31% (Urgency: High)\n- **Integration / Webhooks**: 14% (Urgency: Medium)\n- **General Inquiries**: 7% (Urgency: Low)`;
      
      citations.push({ type: "metric", id: "TAG_ACC", title: "Triage Intent Accuracy (96.2%)" });
      suggestedActions.push(
        { label: "View Derived Issues Feed", action: "navigate", targetTab: "issues" },
        { label: "Rebalance Ingress Queues", action: "navigate", targetTab: "cx_cockpit" }
      );
    } else if (employee.id === "intern_stale_sweeper" || q.includes("stale") || q.includes("dormant") || q.includes("sweep")) {
      answer = `**Rusty (Stale Ticket Sweeper Intern):**\n\nMy hourly background sweep has identified **43 external tickets** safe for automated closure:\n\n- Inactivity threshold: > 14 days without customer reply.\n- Expected backlog reduction: **18.4%**.\n- Customer notification: Polite close note with 1-click re-open link.`;
      
      citations.push({ type: "metric", id: "SWEEP_43", title: "43 Dormant Tickets" });
      suggestedActions.push(
        { label: "Execute Batch Stale Ticket Close", action: "stale_sweep", targetTab: "stale_work" }
      );
    } else if (employee.id === "intern_summarizer" || q.includes("voice") || q.includes("call") || q.includes("phone") || q.includes("audio")) {
      const sessions = voiceService.getSessions(db.tenant.tenantId);
      const activeCall = sessions[0];
      const caller = activeCall ? `${activeCall.callerName || activeCall.callerNumber} (${activeCall.customerTier.toUpperCase()})` : "+1 (415) 890-1234 (ENTERPRISE)";
      const sentiment = activeCall ? activeCall.sentiment.toUpperCase() : "POSITIVE";
      
      answer = `**Echo (Transcript & Voice Summarizer Intern):**\n\nReal-time telephony summary from active inbound stream:\n\n- **Recent Caller**: ${caller}\n- **Detected Intent**: Order #ORD-99412 refund inquiry & status check.\n- **Call Sentiment**: **${sentiment}** (Autonomous IVR verification passed).\n- **Action Execution**: Refund verified and executed via OrderV8 API with zero human agent escalation.`;
      
      citations.push({ type: "issue", id: "VOICE_01", title: `Call Log ${activeCall ? activeCall.callerNumber : "+1 (415) 890-1234"}` });
      suggestedActions.push(
        { label: "Open Voice Telephony Console", action: "navigate", targetTab: "voice" }
      );
    } else if (q.includes("csat") || q.includes("sentiment") || q.includes("sla")) {
      const slaOverview = slaEngine.getSlaOverview();
      answer = `**Alex (Support Intelligence Lead):**\n\nExecutive CSAT & SLA Status Briefing:\n\n- **Overall CSAT**: **91.4%** (-2.3% week-over-week due to checkout worker 504s).\n- **SLA Attainment**: **${slaOverview.attainmentRate}%** (${slaOverview.atRiskCount} tickets currently at >= 75% timer duration).\n- **VARR Autonomy Rate**: **74.8%** of inbound volume resolved with zero human touch.\n- **Recommendation**: Page on-call tier 2 engineers for SLA at-risk accounts.`;
      
      citations.push(
        { type: "metric", id: "CSAT_91", title: "CSAT Attainment (91.4%)" },
        { type: "metric", id: "SLA_ATTAIN", title: `SLA Attainment (${slaOverview.attainmentRate}%)` }
      );
      suggestedActions.push(
        { label: "Open SLA Breach Predictor", action: "navigate", targetTab: "cx_cockpit" },
        { label: "Review QA Scorecards", action: "navigate", targetTab: "cx_cockpit" }
      );
    } else {
      answer = `**Alex (Support Intelligence Lead):**\n\nI am monitoring all active customer ingress channels for **${db.tenant.name}**:\n\n- **Active Systems**: Zendesk, Intercom, Twilio Voice, KnowledgeV8, and 6 ServiceV8 Verticals.\n- **Autonomous Resolutions Today**: 1,378 tickets (saved ~142 engineering hours).\n- **AI Workforce Status**: 3 AI Employees and 3 AI Interns active and healthy.\n\nAsk me about systemic problems, customer health, SLA timers, or select an AI Employee to dive deeper.`;
      
      citations.push({ type: "metric", id: "WORKFORCE", title: "6 AI Workforce Agents Active" });
      suggestedActions.push(
        { label: "View Problem Correlation Matrix", action: "navigate", targetTab: "problems" },
        { label: "Open AI Workforce Hierarchy", action: "navigate", targetTab: "workforce" }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        query,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeRole: employee.role,
        employeeAvatar: employee.avatar,
        answer,
        citations,
        suggestedActions,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Chat query failed" },
      { status: 400 }
    );
  }
}

