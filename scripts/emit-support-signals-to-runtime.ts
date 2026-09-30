import {
  emitSupportTicketCreatedSignal,
  emitSupportTicketEscalatedSignal,
  emitSupportTicketResolvedSignal,
  emitSupportCsatRecordedSignal,
  safeEmitSignal,
} from "../src/lib/signals/signal-agent";

const tenantId = process.env.SERVICEV8_TENANT_ID || "runtime-acceptance";
const accountId = process.env.SERVICEV8_ACCOUNT_ID || "acct_5c88ae327c3a";
const runtimeUrl = process.env.SERVICEV8_RUNTIME_URL || "https://runtime-acceptance.runtime.servicev8.com";
const signalsSecret =
  process.env.RUNTIME_SIGNALS_SECRET ||
  "2a453c3b42b81b43f230dc3c587738db5fe974554184f25c3306458bd99b7653";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`=== Emitting SupportV8 CloudEvents to Runtime (${runtimeUrl}) ===`);
  console.log(`Tenant: ${tenantId}, Account: ${accountId}`);

  const env = {
    ...process.env,
    SERVICEV8_RUNTIME_URL: runtimeUrl,
    RUNTIME_SIGNALS_SECRET: signalsSecret,
  };

  // 1. Ticket Created: TCK-UAT-8001 (Urgent delay inquiry)
  console.log("\n[1/6] Emitting support ticket created (TCK-UAT-8001)...");
  const t1Res = await emitSupportTicketCreatedSignal(
    {
      tenantId,
      accountId,
      ticket: {
        id: "TCK-UAT-8001",
        ticketRef: "TCK-UAT-8001",
        customerName: "Eleanor Vance",
        customerRef: "CUST-UAT-7701",
        summary: "Urgent: Dispatch delay on Order ORD-UAT-1001 (Lumbar Orthotic Stabilization Brace)",
        priority: "urgent",
        category: "order_dispatch",
        status: "open",
      },
    },
    { env }
  );
  console.log("Ticket created response:", t1Res);
  await sleep(100);

  // 2. Ticket Escalated: TCK-UAT-8001 (Customer escalation -> triggers Rule 3: Customer Escalation Risk)
  console.log("\n[2/6] Emitting support ticket escalated (TCK-UAT-8001, triggers Rule 3)...");
  const escRes = await emitSupportTicketEscalatedSignal(
    {
      tenantId,
      accountId,
      ticketId: "TCK-UAT-8001",
      ticketRef: "TCK-UAT-8001",
      customerName: "Eleanor Vance",
      reason: "Clinical fitting scheduled tomorrow morning; order fulfillment delayed past 48h SLA",
      severity: "critical",
    },
    { env }
  );
  console.log("Ticket escalated response:", escRes);
  await sleep(100);

  // 3. Ticket Created: TCK-UAT-8002 (Tracking inquiry)
  console.log("\n[3/6] Emitting support ticket created (TCK-UAT-8002)...");
  const t2Res = await emitSupportTicketCreatedSignal(
    {
      tenantId,
      accountId,
      ticket: {
        id: "TCK-UAT-8002",
        ticketRef: "TCK-UAT-8002",
        customerName: "Marcus Sterling",
        customerRef: "CUST-UAT-7702",
        summary: "Tracking confirmation requested for Cervical Traction Collar Pro (ORD-UAT-1002)",
        priority: "normal",
        category: "tracking_inquiry",
        status: "open",
      },
    },
    { env }
  );
  console.log("Ticket created response:", t2Res);
  await sleep(100);

  // 4. Ticket Resolved: TCK-UAT-8002 (Carrier delivery confirmed)
  console.log("\n[4/6] Emitting support ticket resolved (TCK-UAT-8002)...");
  const resRes = await emitSupportTicketResolvedSignal(
    {
      tenantId,
      accountId,
      ticketId: "TCK-UAT-8002",
      ticketRef: "TCK-UAT-8002",
      resolutionSummary: "Canada Post Express tracking TRK-9921002 delivered; confirmed with patient Marcus Sterling",
      resolvedAt: new Date().toISOString(),
    },
    { env }
  );
  console.log("Ticket resolved response:", resRes);
  await sleep(100);

  // 5. CSAT Recorded: TCK-UAT-8002 (5-star satisfaction)
  console.log("\n[5/6] Emitting CSAT recorded (TCK-UAT-8002)...");
  const csatRes = await emitSupportCsatRecordedSignal(
    {
      tenantId,
      accountId,
      ticketId: "TCK-UAT-8002",
      ticketRef: "TCK-UAT-8002",
      score: 5,
      feedback: "Sophia was wonderful and the tracking resolution was immediate!",
    },
    { env }
  );
  console.log("CSAT recorded response:", csatRes);
  await sleep(100);

  // 6. SLA Breach: TCK-UAT-8003 (Triggers Rule 4: Support SLA Breached, assigned to Sophia)
  console.log("\n[6/6] Emitting SLA breached signal (TCK-UAT-8003, triggers Rule 4)...");
  const slaRes = await safeEmitSignal(
    {
      tenantId,
      accountId,
      eventType: "com.servicev8.business.support.sla-breached.v1",
      subject: "ticket:TCK-UAT-8003",
      data: {
        ticketId: "TCK-UAT-8003",
        ticketRef: "TCK-UAT-8003",
        customerName: "David Okafor",
        customerRef: "CUST-UAT-7704",
        slaStatus: "breached",
        breachMinutes: 120,
        priority: "high",
        summary: "Address update request pending > 2 hours prior to scheduled courier dispatch",
        breachedAt: new Date().toISOString(),
      },
    },
    { env }
  );
  console.log("SLA breached response:", slaRes);

  console.log("\n=== All SupportV8 signals successfully emitted to Runtime! ===");
}

main().catch((err) => {
  console.error("SupportV8 signal emission failed:", err);
  process.exit(1);
});
