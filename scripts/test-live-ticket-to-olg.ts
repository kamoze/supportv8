import { chatRepository } from "../src/lib/db/chat-repository";

async function main() {
  process.env.DATABASE_URL = "postgres://postgres:9d99c403f424dbd311bd366ca5de22c87b040139@127.0.0.1:55432/postgres";
  process.env.RUNTIME_URL = "https://runtime-acceptance.runtime.servicev8.com";
  process.env.SERVICEV8_RUNTIME_URL = "https://runtime-acceptance.runtime.servicev8.com";
  process.env.RUNTIME_SIGNALS_SECRET = "2a453c3b42b81b43f230dc3c587738db5fe974554184f25c3306458bd99b7653";

  console.log("Creating ticket through SupportV8 chatRepository.startSession...");
  const session = await chatRepository.startSession({
    tenantId: "tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559",
    tenantSlug: "runtime-acceptance",
    stream: "customers",
    customerName: "Dr. Sarah Jenkins",
    customerEmail: "sarah.jenkins@acceptance-health.com",
    intakeData: {
      details: "Urgent: Calibration failure and power fluctuation on ultrasound diagnostic probe Unit 4",
      issueCategory: "medical_equipment_malfunction",
    },
    manual: {
      operatorName: "Support Specialist Alex Rivera",
      priority: "urgent",
    },
  });

  console.log("Support Ticket and Session Created Successfully!");
  console.log("Session ID:", session.id);
  console.log("Tenant:", session.tenantDomain);
  console.log("Customer:", session.customerName);
  console.log("Priority:", session.priority);
  console.log("Status:", session.status);

  // Give asynchronous signal emission a moment to complete
  await new Promise((r) => setTimeout(r, 2000));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
