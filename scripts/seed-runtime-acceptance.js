const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("=== Seeding SupportV8 for tenant 'runtime-acceptance' ===");

  const nativeTenantId = "tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559";
  const tenantDomain = "runtime-acceptance";
  const accountId = "acct_5c88ae327c3a";
  const registryTenantId = "tenant_5c88ae327c3a";
  const installationId = "inst:acq_435de4b5668d5e1bb09e5f499bdb030a3773ea39";
  const operationId = "op_runtime_acceptance_support";
  const subject = "1c26f3f6-d326-4b7e-a5aa-30fc918e4c46";
  const companyName = "ServiceV8";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Set RLS session variables
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [nativeTenantId]);
    await client.query("SELECT set_config('app.current_account_id', $1, true)", [accountId]);
    await client.query("SELECT set_config('app.current_registry_tenant_id', $1, true)", [registryTenantId]);

    // 1. Upsert supportv8.tenants
    console.log("Upserting supportv8.tenants...");
    await client.query(`
      INSERT INTO supportv8.tenants (
        id, domain, name, servicev8_account_id, operating_mode, autonomy_threshold, confidence_min, feature_flags, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'autonomous', 'medium', 0.85, '{"smart_triage": true, "olg_sync": true}'::jsonb, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        domain = EXCLUDED.domain,
        name = EXCLUDED.name,
        servicev8_account_id = EXCLUDED.servicev8_account_id,
        operating_mode = EXCLUDED.operating_mode,
        updated_at = NOW();
    `, [nativeTenantId, tenantDomain, companyName, accountId]);

    // 2. Upsert supportv8.runtime_support_workspaces
    console.log("Upserting supportv8.runtime_support_workspaces...");
    await client.query(`
      INSERT INTO supportv8.runtime_support_workspaces (
        installation_id, operation_id, account_id, registry_tenant_id,
        vertical_id, tenant_domain, subject, company_display_name,
        native_tenant_id, native_domain, state, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'runtime', $5, $6, $7, $8, $5, 'workspace_created', NOW()
      )
      ON CONFLICT (installation_id) DO UPDATE SET
        state = 'workspace_created',
        updated_at = NOW();
    `, [
      installationId, operationId, accountId, registryTenantId,
      tenantDomain, subject, companyName, nativeTenantId
    ]);

    // 3. Upsert representative support issues
    console.log("Upserting supportv8.issues...");
    const issues = [
      {
        id: `iss_rt_uat_1001`,
        source: "email",
        external_id: "EML-UAT-901",
        source_url: "https://mail.servicev8.com/thread/eml_901",
        customer_ref: "CUST-UAT-7701",
        customer_name: "Eleanor Vance",
        customer_tier: "enterprise",
        summary: "Urgent: Dispatch delay on Order ORD-UAT-1001 (Lumbar Orthotic Stabilization Brace)",
        category: "order_dispatch",
        product: "Lumbar Orthotic Stabilization Brace",
        version: "1.0",
        sentiment: "negative",
        sentiment_score: -0.65,
        sentiment_trajectory: "declining",
        priority: "urgent",
        confidence: 0.94,
        business_impact: "high",
        resolution_risk_score: 0.72,
        source_status: "open",
        tags: ["order_delay", "supplier_backorder", "sla_warning", "olg_correlated"],
        recommended_action: "Expedite shipment via courier and issue automated delay courtesy credit.",
        timeline: JSON.stringify([
          { at: new Date(Date.now() - 36000000).toISOString(), event: "Inbound customer inquiry received" },
          { at: new Date(Date.now() - 35000000).toISOString(), event: "Autonomous triage flagged dispatch delay > 48h" },
          { at: new Date(Date.now() - 34000000).toISOString(), event: "OLG situation linked: SIT-SUPPLY-DELAY-1001" },
        ]),
        messages: JSON.stringify([
          {
            sender: "Eleanor Vance",
            from: "eleanor.vance@acme-health.example",
            text: "Hello, my order ORD-UAT-1001 was scheduled for dispatch yesterday but the tracking number still shows unfulfilled. We have a clinical fitting scheduled for tomorrow morning.",
            at: new Date(Date.now() - 36000000).toISOString()
          },
          {
            sender: "Sophia (Support AI)",
            from: "sophia@servicev8.com",
            text: "Hi Eleanor, I have located your order ORD-UAT-1001. Our fulfillment center experienced a delay with polymer fastener components from our primary supplier. I have flagged this for immediate escalation.",
            at: new Date(Date.now() - 35000000).toISOString()
          }
        ]),
        assigned_to: "Sophia (AI Support Agent)",
        assigned_agent: "servicev8.ai-support-agent"
      },
      {
        id: `iss_rt_uat_1002`,
        source: "portal",
        external_id: "PORTAL-UAT-902",
        source_url: "https://support.servicev8.com/tickets/902",
        customer_ref: "CUST-UAT-7702",
        customer_name: "Marcus Sterling",
        customer_tier: "standard",
        summary: "Tracking confirmation requested for Cervical Traction Collar Pro (ORD-UAT-1002)",
        category: "tracking_inquiry",
        product: "Cervical Traction Collar Pro",
        version: "1.0",
        sentiment: "positive",
        sentiment_score: 0.80,
        sentiment_trajectory: "stable",
        priority: "normal",
        confidence: 0.98,
        business_impact: "low",
        resolution_risk_score: 0.05,
        source_status: "resolved",
        tags: ["tracking", "delivery_verified", "resolved"],
        recommended_action: "Tracking number provided to customer. Delivery confirmed.",
        timeline: JSON.stringify([
          { at: new Date(Date.now() - 86400000).toISOString(), event: "Ticket opened via customer portal" },
          { at: new Date(Date.now() - 85000000).toISOString(), event: "Carrier tracking link automatically delivered" },
          { at: new Date(Date.now() - 43200000).toISOString(), event: "Customer marked resolved with 5-star rating" }
        ]),
        messages: JSON.stringify([
          {
            sender: "Marcus Sterling",
            from: "marcus.sterling@example.com",
            text: "Can you confirm the tracking details for order ORD-UAT-1002?",
            at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            sender: "Sophia (Support AI)",
            from: "sophia@servicev8.com",
            text: "Tracking number TRK-9921002 is active with Canada Post Express. Delivery expected today by 3 PM.",
            at: new Date(Date.now() - 85000000).toISOString()
          }
        ]),
        assigned_to: "Sophia (AI Support Agent)",
        assigned_agent: "servicev8.ai-support-agent"
      },
      {
        id: `iss_rt_uat_1003`,
        source: "chat",
        external_id: "CHAT-UAT-903",
        source_url: "https://support.servicev8.com/chat/903",
        customer_ref: "CUST-UAT-7704",
        customer_name: "David Okafor",
        customer_tier: "premium",
        summary: "Address update request for outpatient delivery ORD-UAT-1004",
        category: "order_modification",
        product: "Portable Electrotherapy Stimulator",
        version: "1.0",
        sentiment: "neutral",
        sentiment_score: 0.10,
        sentiment_trajectory: "stable",
        priority: "high",
        confidence: 0.92,
        business_impact: "medium",
        resolution_risk_score: 0.20,
        source_status: "open",
        tags: ["address_change", "pre_dispatch"],
        recommended_action: "Update shipping address in OrderV8 before next dispatch run.",
        timeline: JSON.stringify([
          { at: new Date(Date.now() - 25000000).toISOString(), event: "Customer chat initiated" },
          { at: new Date(Date.now() - 24000000).toISOString(), event: "Destination address updated to 450 Bank St, Ottawa" }
        ]),
        messages: JSON.stringify([
          {
            sender: "David Okafor",
            from: "david.okafor@example.com",
            text: "Please update my shipping address to 450 Bank St, Apt 2B before dispatch.",
            at: new Date(Date.now() - 25000000).toISOString()
          }
        ]),
        assigned_to: "Sophia (AI Support Agent)",
        assigned_agent: "servicev8.ai-support-agent"
      }
    ];

    for (const issue of issues) {
      await client.query(`
        INSERT INTO supportv8.issues (
          id, tenant_id, source, external_id, source_url, customer_ref, customer_name,
          customer_tier, summary, category, product, version, sentiment, sentiment_score,
          sentiment_trajectory, priority, confidence, business_impact, resolution_risk_score,
          source_status, tags, recommended_action, timeline, messages, assigned_to, assigned_agent,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23::jsonb, $24::jsonb, $25, $26,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          summary = EXCLUDED.summary,
          sentiment = EXCLUDED.sentiment,
          sentiment_score = EXCLUDED.sentiment_score,
          priority = EXCLUDED.priority,
          source_status = EXCLUDED.source_status,
          tags = EXCLUDED.tags,
          timeline = EXCLUDED.timeline,
          messages = EXCLUDED.messages,
          updated_at = NOW();
      `, [
        issue.id, nativeTenantId, issue.source, issue.external_id, issue.source_url, issue.customer_ref, issue.customer_name,
        issue.customer_tier, issue.summary, issue.category, issue.product, issue.version, issue.sentiment, issue.sentiment_score,
        issue.sentiment_trajectory, issue.priority, issue.confidence, issue.business_impact, issue.resolution_risk_score,
        issue.source_status, issue.tags, issue.recommended_action, issue.timeline, issue.messages, issue.assigned_to, issue.assigned_agent
      ]);
    }
    console.log(`Upserted ${issues.length} support issues`);

    // 4. Upsert knowledge articles in supportv8
    console.log("Upserting supportv8.knowledge_articles...");
    const articles = [
      {
        id: "art_rt_dispatch_sla",
        source: "supportv8_policy",
        title: "Standard Dispatch and Delivery SLA Policy",
        url: "https://support.servicev8.com/kb/dispatch-sla",
        category: "orders",
        usage_count: 42,
        csat_score: 4.85,
        status: "active",
        summary: "Orders dispatch within 24 hours of capture. Supplier delays exceeding 48 hours trigger automatic OLG situation escalations.",
        content: "# Standard Dispatch and Delivery SLA Policy\n\nAll standard orders are guaranteed to dispatch within 24 hours. If a component supplier causes a backorder delay exceeding 48 hours, customer support is notified immediately and courier compensation is authorized up to $50."
      },
      {
        id: "art_rt_returns_policy",
        source: "supportv8_policy",
        title: "Return and Replacement Guidelines for Clinical Equipment",
        url: "https://support.servicev8.com/kb/returns-policy",
        category: "returns",
        usage_count: 28,
        csat_score: 4.90,
        status: "active",
        summary: "Comprehensive guide for managing returns, warranties, and exchanges on medical and rehabilitation orthotics.",
        content: "# Return and Replacement Guidelines\n\nPatients and outpatient clinics may request returns or replacements within 30 days of verified carrier delivery. Authorized replacements are dispatched with prepaid return packaging."
      }
    ];

    for (const art of articles) {
      await client.query(`
        INSERT INTO supportv8.knowledge_articles (
          id, tenant_id, source, title, url, category, usage_count, csat_score, status, summary, content, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          status = EXCLUDED.status,
          last_updated = NOW();
      `, [
        art.id, nativeTenantId, art.source, art.title, art.url, art.category,
        art.usage_count, art.csat_score, art.status, art.summary, art.content
      ]);
    }
    console.log(`Upserted ${articles.length} knowledge articles`);

    await client.query("COMMIT");

    // Print summary counts
    const tenantsCount = await client.query("SELECT count(*) FROM supportv8.tenants WHERE id = $1", [nativeTenantId]);
    const wsCount = await client.query("SELECT count(*) FROM supportv8.runtime_support_workspaces WHERE installation_id = $1", [installationId]);
    const issuesCount = await client.query("SELECT count(*) FROM supportv8.issues WHERE tenant_id = $1", [nativeTenantId]);
    const artsCount = await client.query("SELECT count(*) FROM supportv8.knowledge_articles WHERE tenant_id = $1", [nativeTenantId]);

    console.log("\n=== SupportV8 Seeding Complete ===");
    console.log(JSON.stringify({
      nativeTenantId,
      tenantDomain,
      tenants: tenantsCount.rows[0].count,
      workspaces: wsCount.rows[0].count,
      issues: issuesCount.rows[0].count,
      knowledgeArticles: artsCount.rows[0].count
    }, null, 2));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SupportV8 seeding failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
