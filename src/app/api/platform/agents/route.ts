import { NextResponse } from "next/server";
import { AgentPlatform, type AgentClass } from "@/lib/chatbot/platform/agent-platform";
import { InteractiveRunner } from "@/lib/chatbot/platform/interactive-runner";
import { AutonomousRunner } from "@/lib/chatbot/platform/autonomous-runner";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filterClass = searchParams.get("class") as AgentClass | null;

  const agents = filterClass ? AgentPlatform.listByClass(filterClass) : AgentPlatform.listAgents();

  const interactive = agents.filter((a) => a.agentClass === "interactive");
  const autonomous = agents.filter((a) => a.agentClass === "autonomous");

  return NextResponse.json({
    success: true,
    platform: "ServiceV8 Agent Platform",
    summary: {
      totalAgents: agents.length,
      interactiveAgentsCount: interactive.length,
      autonomousAgentsCount: autonomous.length,
    },
    matrix: {
      interactive: {
        chatbot: interactive.find((a) => a.role === "chatbot"),
        copilot: interactive.find((a) => a.role === "copilot"),
        assistant: interactive.find((a) => a.role === "assistant"),
      },
      autonomous: {
        aiEmployees: autonomous.filter((a) => a.role === "ai_employee"),
        aiIntern: autonomous.find((a) => a.role === "ai_intern"),
        backgroundAgent: autonomous.find((a) => a.role === "background_agent"),
      },
    },
    allAgents: agents,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, agentClass, role, tenantId = "tenant_default" } = body;

    // 1. Interactive Agent Dispatch
    if (agentClass === "interactive" || role === "copilot") {
      if (role === "copilot") {
        const copilotResult = await InteractiveRunner.runCopilot({
          sessionId: body.sessionId || `copilot_${Date.now()}`,
          stream: body.stream || "customers",
          customerName: body.customerName || "Customer",
          latestCustomerMessage: body.content || "I need help with my account",
          tenantId,
        });
        return NextResponse.json({ success: true, mode: "interactive_copilot", result: copilotResult });
      }

      if (role === "assistant") {
        const assistantResult = await InteractiveRunner.runAssistant({
          query: body.content || "How do I download invoices?",
          tenantId,
          customerEmail: body.customerEmail,
        });
        return NextResponse.json({ success: true, mode: "interactive_assistant", result: assistantResult });
      }

      const chatResult = await InteractiveRunner.runChatbot({
        sessionId: body.sessionId || `chat_${Date.now()}`,
        stream: body.stream || "customers",
        customerName: body.customerName || "Customer",
        customerEmail: body.customerEmail,
        content: body.content || "Hello",
        tenantId,
      });
      return NextResponse.json({ success: true, mode: "interactive_chatbot", result: chatResult });
    }

    // 2. Autonomous Agent Dispatch
    if (agentClass === "autonomous" || role === "ai_employee" || role === "ai_intern" || role === "background_agent") {
      if (role === "ai_intern") {
        const internResult = await AutonomousRunner.runAiIntern({
          tenantId,
          ticketId: body.ticketId || "TICK-101",
          ticketTitle: body.ticketTitle || "SAML SSO Login Error",
          ticketBody: body.ticketBody || "User received SAML assertion parsing failure with Okta.",
        });
        return NextResponse.json({ success: true, mode: "autonomous_ai_intern", result: internResult });
      }

      if (role === "background_agent") {
        const bgResult = await AutonomousRunner.runBackgroundAgent({
          sweepType: body.sweepType || "stale_work",
          tenantId,
        });
        return NextResponse.json({ success: true, mode: "autonomous_background_agent", result: bgResult });
      }

      const empResult = await AutonomousRunner.runAiEmployee({
        agentId: body.agentId || "agent_employee_sophia",
        tenantId,
        stream: body.stream || "customers",
        objective: body.objective || "Review open tickets and apply SLA retention voucher",
        customerEmail: body.customerEmail,
        priority: body.priority,
      });
      return NextResponse.json({ success: true, mode: "autonomous_ai_employee", result: empResult });
    }

    return NextResponse.json({ error: "Invalid agentClass or role" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Platform dispatch error" }, { status: 500 });
  }
}
