/**
 * supportV8 Marketplace & Governance Service
 * Manages subscribed connectors, workforce catalog, billing plans, and tenant governance.
 */

import { db } from "../db/mock-data";
import type {
  MarketplaceConnector,
  MarketplaceWorkforceItem,
  MarketplacePlan,
  TenantMember,
  TenantSettingConfig,
  ComplianceAuditReport,
  TenantAuditLog,
} from "../types/marketplace-types";

export const INITIAL_AUDIT_LOGS: TenantAuditLog[] = [
  {
    id: "aud_20260826_9941a",
    timestamp: "2026-08-26T13:42:10Z",
    actorName: "Alex — Support Lead",
    actorRole: "AI Lead",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-manager.jpg",
    operation: "action_gateway.refund_issued",
    category: "action_gateway",
    targetEntityId: "order_ORD-99412",
    targetEntityType: "ticket",
    riskLevel: "medium",
    status: "executed",
    confidence: 0.96,
    durationMs: 142,
    ipAddress: "10.0.4.18 (Gateway)",
    sha256Hash: "8f7b2c9103e4d9a8f2110c7104b2a89c991823ab49102c77d61902ebfa9102ca",
    idempotencyKey: "idem_ref_99412_sarah",
    reasoning: "Autonomously executed $49.00 refund following OrderV8 duplicate charge telemetry verification under $100 autonomy threshold.",
    metadata: {
      amountUsd: 49.0,
      currency: "USD",
      orderId: "ORD-99412",
      customerTier: "enterprise",
      connector: "OrderV8 Connector",
    },
  },
  {
    id: "aud_20260826_8832b",
    timestamp: "2026-08-26T13:15:22Z",
    actorName: "Eleanor — Governance Lead",
    actorRole: "AI Governance & Policy Auditor",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-eleanor.jpg",
    operation: "autonomy_policy.policy_gate_evaluated",
    category: "autonomy_policy",
    targetEntityId: "ticket_ISS-1004",
    targetEntityType: "ticket",
    riskLevel: "high",
    status: "approved",
    confidence: 0.99,
    durationMs: 84,
    ipAddress: "10.0.4.22 (Policy Evaluator)",
    sha256Hash: "7a192bc901e892fac10283b9910c2837f1a9028cb91829374019283740192837",
    idempotencyKey: "idem_gate_iss1004",
    reasoning: "Evaluated high-risk cross-vertical database session clear action; approved execution under Eleanor supervision per Rule SEC-04.",
    metadata: {
      policyRule: "RULE_SEC_04_AUTH_FLUSH",
      riskScore: "HIGH",
      auditEnforced: true,
    },
  },
  {
    id: "aud_20260826_7719c",
    timestamp: "2026-08-26T12:50:04Z",
    actorName: "Jordan — KB Curator",
    actorRole: "Knowledge Base Specialist",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-curator.jpg",
    operation: "knowledge_graph.article_published",
    category: "knowledge_graph",
    targetEntityId: "art_oauth_refresh_v2",
    targetEntityType: "article",
    riskLevel: "low",
    status: "executed",
    confidence: 0.98,
    durationMs: 310,
    ipAddress: "10.0.4.15 (KnowledgeV8 Syncer)",
    sha256Hash: "3b901a88c219830fab910293740192837f019283740192837401928374019283",
    idempotencyKey: "idem_kb_pub_oauth_v2",
    reasoning: "Published verified knowledge article mined from 18 recurring checkout auth incidents with 99.1% pgvector similarity match.",
    metadata: {
      articleId: "art_oauth_refresh_v2",
      vectorChunks: 6,
      targetWorkspace: "ws_enterprise_core",
    },
  },
  {
    id: "aud_20260826_6620d",
    timestamp: "2026-08-26T11:30:45Z",
    actorName: "Rusty — Sweeper",
    actorRole: "Stale Work Sweeper Intern",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-arthur.jpg",
    operation: "action_gateway.stale_batch_closed",
    category: "action_gateway",
    targetEntityId: "batch_close_43_tickets",
    targetEntityType: "ticket",
    riskLevel: "low",
    status: "executed",
    confidence: 0.94,
    durationMs: 520,
    ipAddress: "10.0.4.30 (Batch Automation)",
    sha256Hash: "5c1829037401928374019283740192837f019283740192837401928374019283",
    idempotencyKey: "idem_stale_sweep_20260826",
    reasoning: "Executed automated batch close on 43 dormant tickets inactive for >14 days with zero customer reply.",
    metadata: {
      ticketsClosed: 43,
      avgInactiveDays: 19.4,
      notificationSent: true,
    },
  },
  {
    id: "aud_20260826_5511e",
    timestamp: "2026-08-26T10:14:18Z",
    actorName: "Maya — Incident Analyst",
    actorRole: "Incident Analyst Lead",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-analyst.jpg",
    operation: "action_gateway.broadcast_notification",
    category: "action_gateway",
    targetEntityId: "broadcast_outage_us_east",
    targetEntityType: "customer",
    riskLevel: "medium",
    status: "awaiting_approval",
    confidence: 0.97,
    durationMs: 95,
    ipAddress: "10.0.4.12 (Proactive Dispatch)",
    sha256Hash: "1d9018237401928374019283740192837f019283740192837401928374019283",
    idempotencyKey: "idem_bcast_useast_lat",
    reasoning: "Drafted status incident banner and email broadcast for 142 enterprise users affected by Stripe webhook latency.",
    metadata: {
      affectedUsers: 142,
      severity: "P2_MAJOR",
      approvalRequired: true,
    },
  },
  {
    id: "aud_20260826_4402f",
    timestamp: "2026-08-26T09:05:00Z",
    actorName: "Inigo Godwin",
    actorRole: "Owner / CX Director",
    actorType: "human_admin",
    actorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    operation: "auth_security.api_key_rotated",
    category: "auth_security",
    targetEntityId: "secret_sv8_live_key",
    targetEntityType: "policy",
    riskLevel: "critical",
    status: "executed",
    confidence: 1.0,
    durationMs: 44,
    ipAddress: "192.168.0.185 (Director Console)",
    sha256Hash: "9e0192837401928374019283740192837f019283740192837401928374019283",
    idempotencyKey: "idem_key_rot_20260826",
    reasoning: "Rotated live tenant secret key `sv8_live_...` with Keycloak OAuth2 validation and RLS partition isolation.",
    metadata: {
      action: "ROTATE_API_KEY",
      keyPrefix: "sv8_live_",
      twoFactorConfirmed: true,
    },
  },
  {
    id: "aud_20260826_3391g",
    timestamp: "2026-08-26T08:30:12Z",
    actorName: "Vivian — Voice Lead",
    actorRole: "Voice Concierge Lead",
    actorType: "ai_employee",
    actorAvatar: "/avatars/beaver-vivian.jpg",
    operation: "voice_telephony.ivr_sentiment_escalated",
    category: "voice_telephony",
    targetEntityId: "session_call_sip_9041",
    targetEntityType: "voice_call",
    riskLevel: "medium",
    status: "executed",
    confidence: 0.95,
    durationMs: 180,
    ipAddress: "10.0.4.19 (Twilio IVR Mesh)",
    sha256Hash: "2f0192837401928374019283740192837f019283740192837401928374019283",
    idempotencyKey: "idem_voice_esc_9041",
    reasoning: "Detected acoustic customer frustration index 8.9/10; initiated seamless warm handoff to Tier 2 with audio transcript token.",
    metadata: {
      caller: "Marcus Vance",
      durationSec: 142,
      sentimentScore: "FRUSTRATED_8.9",
      targetTier: "tier_2_escalation",
    },
  },
  {
    id: "aud_20260826_2280h",
    timestamp: "2026-08-26T07:15:00Z",
    actorName: "System Automation",
    actorRole: "Security Kernel",
    actorType: "system_automation",
    operation: "auth_security.saml_rls_verified",
    category: "auth_security",
    targetEntityId: "tenant_acme_enterprise",
    targetEntityType: "policy",
    riskLevel: "low",
    status: "executed",
    confidence: 1.0,
    durationMs: 12,
    ipAddress: "127.0.0.1 (Kernel Loopback)",
    sha256Hash: "4a0192837401928374019283740192837f019283740192837401928374019283",
    idempotencyKey: "idem_rls_cron_20260826",
    reasoning: "Automated multi-tenant PostgreSQL Row-Level Security policy test passed with 0 cross-tenant leak vectors.",
    metadata: {
      schemaPartition: "tenant_acme_core",
      testCasesExecuted: 32,
      crossTenantLeaks: 0,
    },
  },
];

export const INITIAL_CONNECTORS: MarketplaceConnector[] = [
  {
    id: "conn_zendesk",
    name: "Zendesk Support Enterprise",
    category: "helpdesk",
    icon: "fi fi-rr-headset",
    description: "Bi-directional ticket ingestion, automated macro synchronization, and webhook dispatch.",
    tier: "included",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 1,
    eventsPerDay: 1420,
    endpointUrl: "https://acme.zendesk.com/api/v2",
    configFields: [
      { key: "subdomain", label: "Zendesk Subdomain", type: "text", value: "acme" },
      { key: "adminEmail", label: "Admin Email", type: "text", value: "admin@acme.com" },
      { key: "apiToken", label: "API Token", type: "password", value: "••••••••••••••••" },
    ],
  },
  {
    id: "conn_intercom",
    name: "Intercom Messenger & Fin",
    category: "helpdesk",
    icon: "fi fi-rr-comment-alt-middle",
    description: "Live customer chat ingress, session handoffs, and omnichannel sentiment tracking.",
    tier: "included",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 1,
    eventsPerDay: 840,
    endpointUrl: "https://api.intercom.io/conversations",
    configFields: [
      { key: "appId", label: "Intercom App ID", type: "text", value: "ic_app_99182" },
      { key: "accessToken", label: "Access Token", type: "password", value: "••••••••••••••••" },
    ],
  },
  {
    id: "conn_twilio",
    name: "Twilio Voice Telephony & SIP",
    category: "telephony",
    icon: "fi fi-rr-phone-call",
    description: "Real-time streaming audio ingestion, dual-channel transcription, and IVR automation.",
    tier: "included",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 1,
    eventsPerDay: 180,
    endpointUrl: "wss://stream.twilio.com/v1/voice",
    configFields: [
      { key: "accountSid", label: "Account SID", type: "text", value: "AC998182736451" },
      { key: "authToken", label: "Auth Token", type: "password", value: "••••••••••••••••" },
    ],
  },
  {
    id: "conn_kv8",
    name: "KnowledgeV8 RAG Vector Hub",
    category: "knowledge",
    icon: "fi fi-rr-brain",
    description: "Semantic search over pgvector documentation embeddings with live knowledge deficit detection.",
    tier: "included",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 5,
    eventsPerDay: 2300,
    endpointUrl: "https://kv8.servicev8.internal/v1/rag",
    configFields: [
      { key: "tenantId", label: "KV8 Tenant ID", type: "text", value: "tenant_default" },
      { key: "vectorDim", label: "Embedding Dimensions", type: "text", value: "1536 (OpenAI ada-002)" },
    ],
  },
  {
    id: "conn_shopify",
    name: "Shopify / OrderV8 Commerce",
    category: "commerce",
    icon: "fi fi-rr-shopping-cart",
    description: "Customer order lookup, delivery status verification, and automated refund processing.",
    tier: "pro",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 2,
    eventsPerDay: 620,
    endpointUrl: "https://orderv8.servicev8.internal/api/v1",
    configFields: [
      { key: "shopUrl", label: "Store URL", type: "url", value: "https://acme-store.myshopify.com" },
      { key: "apiKey", label: "Admin API Key", type: "password", value: "••••••••••••••••" },
    ],
  },
  {
    id: "conn_salesforce",
    name: "Salesforce Service Cloud CRM",
    category: "crm",
    icon: "fi fi-rr-cloud",
    description: "Account health aggregation, VIP contract SLA sync, and enterprise case routing.",
    tier: "enterprise",
    isSubscribed: false,
    status: "available",
    syncFrequencyMinutes: 15,
    eventsPerDay: 0,
    endpointUrl: "https://acme.salesforce.com/services/data/v58.0",
    configFields: [
      { key: "instanceUrl", label: "Instance URL", type: "url", placeholder: "https://yourinstance.salesforce.com" },
      { key: "clientId", label: "Connected App Client ID", type: "text", placeholder: "3MVG9..." },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••" },
    ],
  },
  {
    id: "conn_slack",
    name: "Slack Connect & Internal Triage",
    category: "helpdesk",
    icon: "fi fi-rr-comments",
    description: "VIP shared Slack channels, automated bot triage, and on-call escalation alerts.",
    tier: "pro",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 1,
    eventsPerDay: 430,
    endpointUrl: "https://slack.com/api/chat.postMessage",
    configFields: [
      { key: "botToken", label: "Bot User OAuth Token", type: "password", value: "xoxb-••••••••••••" },
      { key: "escalationChannel", label: "On-Call Channel", type: "text", value: "#cx-incident-response" },
    ],
  },
  {
    id: "conn_github",
    name: "GitHub Issues & Incident SRE",
    category: "devops",
    icon: "fi fi-rr-code-branch",
    description: "Bi-directional incident sync, bug report auto-creation, and PR deployment triggers.",
    tier: "pro",
    isSubscribed: false,
    status: "available",
    syncFrequencyMinutes: 10,
    eventsPerDay: 0,
    endpointUrl: "https://api.github.com/repos/acme/backend",
    configFields: [
      { key: "repoOwner", label: "Repository Owner / Org", type: "text", placeholder: "acme-corp" },
      { key: "repoName", label: "Repository Name", type: "text", placeholder: "core-platform" },
      { key: "pat", label: "Personal Access Token", type: "password", placeholder: "ghp_••••••••" },
    ],
  },
  {
    id: "conn_s3",
    name: "Amazon S3 Knowledge Document Ingestion",
    category: "storage",
    icon: "fi fi-rr-database",
    description: "Continuous ingestion of PDF runbooks, OpenAPI specs, and markdown guides into pgvector.",
    tier: "pro",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 30,
    eventsPerDay: 85,
    endpointUrl: "s3://acme-support-knowledge-vault",
    configFields: [
      { key: "bucketName", label: "S3 Bucket Name", type: "text", value: "acme-support-knowledge-vault" },
      { key: "region", label: "AWS Region", type: "text", value: "us-east-1" },
    ],
  },
  {
    id: "conn_webhook",
    name: "Generic Ingress Webhook Hub",
    category: "helpdesk",
    icon: "fi fi-rr-plug",
    description: "Custom JSON payload ingestion endpoint with HMAC signature verification.",
    tier: "included",
    isSubscribed: true,
    status: "active",
    syncFrequencyMinutes: 1,
    eventsPerDay: 310,
    endpointUrl: "https://support.servicev8.com/api/ingress/webhook",
    configFields: [
      { key: "webhookSecret", label: "HMAC Secret Key", type: "password", value: "whsec_••••••••••••" },
    ],
  },
];

export const INITIAL_WORKFORCE_CATALOG: MarketplaceWorkforceItem[] = [
  {
    id: "emp_support_lead",
    name: "Alex",
    role: "Support Intelligence Lead",
    avatarUrl: "/avatars/beaver-manager.jpg",
    level: "ai_employee",
    priceMonthly: 199,
    skills: ["Multi-Channel Triage", "Problem Correlation", "Supervisor Handoffs", "SLA Guard"],
    isHired: true,
    rating: 4.95,
    hiredCount: 1240,
    description: "Top-tier AI Support Lead that analyzes real-time queue patterns, correlates systemic outages, and delegates tasks.",
  },
  {
    id: "emp_incident_analyst",
    name: "Maya",
    role: "Incident & Business Impact Analyst",
    avatarUrl: "/avatars/beaver-analyst.jpg",
    level: "ai_employee",
    priceMonthly: 249,
    skills: ["Financial Risk Modeling", "ARR Blast Radius", "Proactive Broadcasts", "Root Cause Analysis"],
    isHired: true,
    rating: 4.98,
    hiredCount: 890,
    description: "Computes financial exposure, identifies affected customer tiers, and authors proactive incident notifications.",
  },
  {
    id: "emp_kb_refresh",
    name: "Jordan",
    role: "Knowledge Refresh Specialist",
    avatarUrl: "/avatars/beaver-curator.jpg",
    level: "ai_employee",
    priceMonthly: 149,
    skills: ["Knowledge Deficit Radar", "Resolution Mining", "Proposal Authoring", "Vector Graph Sync"],
    isHired: true,
    rating: 4.88,
    hiredCount: 720,
    description: "Continuously scans closed tickets for undocumented solutions and generates reusable knowledge base articles.",
  },
  {
    id: "emp_compliance_officer",
    name: "Eleanor",
    role: "AI Governance & Policy Auditor",
    avatarUrl: "/avatars/beaver-eleanor.jpg",
    level: "ai_employee",
    priceMonthly: 299,
    skills: ["Hallucination Auditing", "GDPR / HIPAA Safety", "Autonomy Boundary Enforcement", "QA Scoring"],
    isHired: false,
    rating: 4.99,
    hiredCount: 450,
    description: "Audits AI conversations for hallucination drift, sensitive PII redaction, and compliance scorecards.",
  },
  {
    id: "emp_voice_coordinator",
    name: "Vivian",
    role: "Lead Voice Telephony Concierge",
    avatarUrl: "/avatars/beaver-vivian.jpg",
    level: "ai_employee",
    priceMonthly: 249,
    skills: ["Real-Time Telephony", "IVR Handoffs", "Caller Sentiment Calibration", "Voice Biometrics"],
    isHired: false,
    rating: 4.92,
    hiredCount: 610,
    description: "Directs high-volume voice contact centers with human-level cadence, voice tone matching, and seamless SIP transfers.",
  },
  {
    id: "intern_tagger",
    name: "Chip",
    role: "Auto-Tagger & Categorizer",
    avatarUrl: "/avatars/beaver-intern.jpg",
    level: "ai_intern",
    priceMonthly: 49,
    skills: ["Intent Tagging", "Sentiment Classification", "Routing Labels"],
    isHired: true,
    rating: 4.78,
    hiredCount: 3100,
    description: "High-speed intern that applies sentiment and classification tags to incoming tickets at 150ms latency.",
  },
  {
    id: "intern_stale_sweeper",
    name: "Rusty",
    role: "Stale Ticket Sweeper",
    avatarUrl: "/avatars/beaver-arthur.jpg",
    level: "ai_intern",
    priceMonthly: 49,
    skills: ["Dormant Ticket Detection", "Safety Verification", "Polite Auto-Close"],
    isHired: true,
    rating: 4.91,
    hiredCount: 2450,
    description: "Performs hourly automated sweeps across external helpdesks to close inactive tickets safely.",
  },
  {
    id: "intern_summarizer",
    name: "Echo",
    role: "Transcript & Voice Summarizer",
    avatarUrl: "/avatars/beaver-receptionist.jpg",
    level: "ai_intern",
    priceMonthly: 49,
    skills: ["Call Transcription", "Bullet Summarization", "Action Item Extraction"],
    isHired: true,
    rating: 4.84,
    hiredCount: 1980,
    description: "Generates structured, clean bullet-point summaries and caller timeline context from live phone recordings.",
  },
];

export const INITIAL_PLANS: MarketplacePlan[] = [
  {
    id: "plan_trial",
    name: "Trial",
    badge: "No card required",
    priceMonthly: 0,
    priceAnnual: 0,
    priceDisplay: "$0",
    creditsDisplay: "2,000 credits/month",
    description: "A first look at managed AI on this account.",
    actionLabel: "Not self-serve",
    actionNote: "Trials aren't started from this page — talk to ServiceV8 to arrange one.",
    isCurrent: false,
    isSelfServe: false,
    features: [
      "2,000 credits / month allowance",
      "1 Managed AI Employee seat",
      "Single-channel chat widget intake",
      "Community knowledge RAG access",
    ],
    slaCommitment: "Standard Community SLA",
    computeUnits: "2,000 Credits / mo",
    aiEmployeeSeats: 1,
  },
  {
    id: "plan_starter",
    name: "Starter",
    badge: "CURRENT PLAN",
    priceMonthly: 25,
    priceAnnual: 20,
    priceDisplay: "$25/mo",
    creditsDisplay: "5,000 credits/month",
    description: "For a single site getting started with managed AI.",
    actionLabel: "Current plan",
    actionNote: "This is the package this account is on.",
    isCurrent: true,
    isSelfServe: true,
    features: [
      "5,000 credits / month allowance",
      "2 AI Employee Seats + 2 Interns",
      "Zendesk & Intercom Connectors",
      "Standard SLA (4hr First Response)",
      "KnowledgeV8 RAG (5,000 documents)",
    ],
    slaCommitment: "99.0% SLA Attainment",
    computeUnits: "5,000 Credits / mo",
    aiEmployeeSeats: 2,
  },
  {
    id: "plan_growth",
    name: "Growth",
    badge: "RECOMMENDED",
    priceMonthly: 100,
    priceAnnual: 80,
    priceDisplay: "$100/mo",
    creditsDisplay: "27,500 credits/month",
    description: "For teams running customization and workflows day to day.",
    actionLabel: "CHOOSE PLAN",
    isCurrent: false,
    isSelfServe: true,
    features: [
      "27,500 credits / month allowance",
      "4 AI Employee Seats + Unlimited Interns",
      "Omnichannel Chat & Email Intake",
      "Pro SLA (1hr First Response)",
      "Zero-Trust Action Gateway Dispatch",
      "KnowledgeV8 Vector Topology Grounding",
    ],
    slaCommitment: "99.5% SLA Attainment",
    computeUnits: "27,500 Credits / mo",
    aiEmployeeSeats: 4,
  },
  {
    id: "plan_scale",
    name: "Scale",
    badge: "HIGH VOLUME",
    priceMonthly: 350,
    priceAnnual: 280,
    priceDisplay: "$350/mo",
    creditsDisplay: "115,000 credits/month",
    description: "For higher-volume estates running frequent builds and agents.",
    actionLabel: "CHOOSE PLAN",
    isCurrent: false,
    isSelfServe: true,
    features: [
      "115,000 credits / month allowance",
      "8 AI Employee Seats + Unlimited Interns",
      "All Connectors + Twilio Voice Telephony",
      "Enterprise SLA (15min Response / 2hr Resolution)",
      "Autonomous Resolution Mode (VARR)",
      "Real-Time Problem Correlation Matrix",
      "Multi-tenant pgvector RLS isolation",
    ],
    slaCommitment: "99.8% SLA Attainment",
    computeUnits: "115,000 Credits / mo",
    aiEmployeeSeats: 8,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    badge: "CUSTOM TERMS",
    priceMonthly: 0,
    priceAnnual: 0,
    priceDisplay: "Contact sales",
    creditsDisplay: "Allowance agreed with sales",
    description: "Custom allowance, invoicing and terms.",
    actionLabel: "CONTACT SALES",
    isCurrent: false,
    isSelfServe: false,
    features: [
      "Custom pooled credits & burst capacity",
      "Unlimited AI Employee & Intern seats",
      "Dedicated PostgreSQL RLS Partition & Redis Cluster",
      "Custom Invoicing, DPA, and SOC-2 Terms",
      "24/7 Dedicated Solutions Engineer & War-Room",
      "Custom on-prem and hybrid cloud bridges",
    ],
    slaCommitment: "99.99% SLA Attainment",
    computeUnits: "Custom Agreed Allowance",
    aiEmployeeSeats: 30,
  },
];

export const INITIAL_MEMBERS: TenantMember[] = [
  {
    id: "mem_001",
    name: "Sarah Chen",
    email: "sarah.chen@acme.com",
    role: "Owner / CX Director",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "Just now",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "mem_002",
    name: "David Kim",
    email: "david.kim@acme.com",
    role: "CX Operations Lead",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "12m ago",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "mem_003",
    name: "Elena Rostova",
    email: "elena.r@acme.com",
    role: "Tier 2 Escalation Agent",
    status: "active",
    twoFactorEnabled: false,
    lastActive: "2h ago",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "mem_004",
    name: "Marcus Vance",
    email: "marcus.v@acme.com",
    role: "Security & Compliance Auditor",
    status: "active",
    twoFactorEnabled: true,
    lastActive: "Yesterday",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
  },
];

export const INITIAL_SETTINGS: TenantSettingConfig = {
  tenantId: "tenant_default",
  workspaceName: "Acme Enterprise",
  workspaceSlug: "acme-enterprise",
  operatingMode: "autonomous",
  keycloakRealm: "supportv8-acme-realm",
  postgresRlsEnabled: true,
  redisTtlSeconds: 86400,
  webhookUrl: "https://support.servicev8.com/api/ingress/webhook",
  apiKey: "sv8_live_99f82ab47c104e12bb09",
  dataRetentionDays: 90,
  autoEscalateFrustrated: true,
  requireApprovalForBroadcast: false,

  // BYOM Settings
  byomProvider: "anthropic",
  byomModel: "claude-3-5-sonnet-20241022",
  byomCustomEndpoint: "https://api.anthropic.com/v1",
  byomApiKey: "sk-ant-api03-live_9921_77a4b2c1e8",
  byomTemperature: 0.2,
  byomMaxTokens: 4096,

  // Embedding Settings
  embeddingProvider: "openai",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  embeddingSimilarityMetric: "cosine",
  embeddingApiKey: "sk-proj-embed_live_8841_55b3c2d1",
  embeddingChunkSize: 512,
  embeddingChunkOverlap: 64,

  // ForgeGW Settings
  forgeGwEndpoint: "https://gateway.servicev8.com/v1/forge",
  forgeGwApiKey: "fgw_live_sec_88421098bb12c4",
  forgeGwRateLimitRpm: 500,
  forgeGwTimeoutMs: 10000,
  forgeGwEnforceIdempotency: true,
  forgeGwMtlsEnabled: true,
};

export const INITIAL_REPORTS: ComplianceAuditReport[] = [
  {
    id: "REP-2026-08",
    generatedAt: "2026-08-26T08:00:00Z",
    period: "August 2026 (Month-to-Date)",
    totalInteractions: 18420,
    autonomousResolved: 13780,
    humanEscalations: 4640,
    hallucinationDriftScore: 0.02,
    policyViolations: 0,
    costSavedEstimatedUsd: 58400,
    slaAttainmentPct: 98.4,
  },
  {
    id: "REP-2026-07",
    generatedAt: "2026-07-31T23:59:59Z",
    period: "July 2026",
    totalInteractions: 24100,
    autonomousResolved: 17890,
    humanEscalations: 6210,
    hallucinationDriftScore: 0.03,
    policyViolations: 1,
    costSavedEstimatedUsd: 74200,
    slaAttainmentPct: 97.9,
  },
];

export class MarketplaceService {
  private readonly tenantStates = new Map<string, {
    connectors: MarketplaceConnector[];
    workforce: MarketplaceWorkforceItem[];
    plans: MarketplacePlan[];
    members: TenantMember[];
    settings: TenantSettingConfig;
    reports: ComplianceAuditReport[];
    auditLogs: TenantAuditLog[];
    credits: number;
  }>();

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private stateFor(tenantSlug = "acme") {
    const clean = tenantSlug.trim().toLowerCase() || "default";
    const existing = this.tenantStates.get(clean);
    if (existing) return existing;

    const isDemoTenant = clean === "acme" || clean === "meridian";
    const state = {
      connectors: this.clone(INITIAL_CONNECTORS).map((connector) =>
        isDemoTenant
          ? connector
          : {
              ...connector,
              isSubscribed: false,
              status: "available" as const,
              eventsPerDay: 0,
              endpointUrl: undefined,
              configFields: connector.configFields.map(({ value: _value, ...field }) => field),
            }
      ),
      workforce: this.clone(INITIAL_WORKFORCE_CATALOG).map((employee) =>
        isDemoTenant
          ? { ...employee, isHired: employee.id === "emp_support_lead" }
          : { ...employee, isHired: false }
      ),
      // A seeded demo employee is an explicitly capped sandbox entitlement,
      // not a paid subscription. Demo and newly-created workspaces therefore
      // start without a current plan.
      plans: this.clone(INITIAL_PLANS).map((plan) => ({
        ...plan,
        isCurrent: false,
        badge: plan.badge === "CURRENT PLAN" ? undefined : plan.badge,
        actionLabel: plan.id === "plan_starter" ? "CHOOSE PLAN" : plan.actionLabel,
        actionNote: plan.id === "plan_starter" ? undefined : plan.actionNote,
      })),
      members: isDemoTenant ? this.clone(INITIAL_MEMBERS) : [],
      settings: {
        ...this.clone(INITIAL_SETTINGS),
        tenantId: `tenant_${clean.replace(/-/g, "_")}`,
        workspaceSlug: clean,
        workspaceName: isDemoTenant ? INITIAL_SETTINGS.workspaceName : clean,
      },
      reports: isDemoTenant ? this.clone(INITIAL_REPORTS) : [],
      auditLogs: isDemoTenant ? this.clone(INITIAL_AUDIT_LOGS) : [],
      credits: isDemoTenant ? 150 : 0,
    };
    this.tenantStates.set(clean, state);
    return state;
  }

  public getCredits(tenantSlug = "acme"): number {
    return this.stateFor(tenantSlug).credits;
  }

  public setCredits(amount: number, tenantSlug = "acme"): number {
    const state = this.stateFor(tenantSlug);
    state.credits = Math.max(0, amount);
    return state.credits;
  }

  public deductCredits(amount: number, reason: string, tenantSlug = "acme"): { remaining: number; deducted: number; reason: string } {
    const state = this.stateFor(tenantSlug);
    const deducted = Math.min(state.credits, Math.max(0, amount));
    state.credits = Math.max(0, state.credits - deducted);
    return {
      remaining: state.credits,
      deducted,
      reason,
    };
  }

  public addCredits(amount: number, reason: string, tenantSlug = "acme"): { remaining: number; added: number; reason: string } {
    const state = this.stateFor(tenantSlug);
    const added = Math.max(0, amount);
    state.credits += added;
    return {
      remaining: state.credits,
      added,
      reason,
    };
  }

  public getConnectors(tenantSlug = "acme"): MarketplaceConnector[] {
    return this.clone(this.stateFor(tenantSlug).connectors);
  }

  public getWorkforceCatalog(tenantSlug = "acme"): MarketplaceWorkforceItem[] {
    return this.clone(this.stateFor(tenantSlug).workforce);
  }

  public getPlans(tenantSlug = "acme"): MarketplacePlan[] {
    return this.clone(this.stateFor(tenantSlug).plans);
  }

  public getMembers(tenantSlug = "acme"): TenantMember[] {
    return this.clone(this.stateFor(tenantSlug).members);
  }

  public getSettings(tenantSlug = "acme"): TenantSettingConfig {
    return this.clone(this.stateFor(tenantSlug).settings);
  }

  public getReports(tenantSlug = "acme"): ComplianceAuditReport[] {
    return this.clone(this.stateFor(tenantSlug).reports);
  }

  public getAuditLogs(tenantSlug = "acme"): TenantAuditLog[] {
    return this.clone(this.stateFor(tenantSlug).auditLogs);
  }

  public addAuditLog(log: Omit<TenantAuditLog, "id" | "timestamp" | "sha256Hash">, tenantSlug = "acme"): TenantAuditLog {
    const state = this.stateFor(tenantSlug);
    const newLog: TenantAuditLog = {
      ...log,
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      sha256Hash: `sha256_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`,
    };
    state.auditLogs.unshift(newLog);
    return newLog;
  }

  public verifyAuditChain(tenantSlug = "acme"): { verified: boolean; blocksChecked: number; errors: string[] } {
    return {
      verified: true,
      blocksChecked: this.stateFor(tenantSlug).auditLogs.length,
      errors: [],
    };
  }

  public toggleConnector(id: string, isSubscribed: boolean, tenantSlug = "acme"): MarketplaceConnector {
    const conn = this.stateFor(tenantSlug).connectors.find((c) => c.id === id);
    if (!conn) throw new Error(`Connector ${id} not found`);
    conn.isSubscribed = isSubscribed;
    conn.status = isSubscribed ? "active" : "available";
    return { ...conn };
  }

  public hireWorkforceAgent(id: string, tenantSlug = "acme"): MarketplaceWorkforceItem {
    const item = this.stateFor(tenantSlug).workforce.find((w) => w.id === id);
    if (!item) throw new Error(`Workforce item ${id} not found`);
    item.isHired = true;
    item.hiredCount += 1;
    return { ...item };
  }

  public selectPlan(planId: string, tenantSlug = "acme"): MarketplacePlan {
    const plans = this.stateFor(tenantSlug).plans;
    plans.forEach((p) => {
      p.isCurrent = p.id === planId;
    });
    const current = plans.find((p) => p.isCurrent);
    if (!current) throw new Error(`Plan ${planId} not found`);
    return { ...current };
  }

  public inviteMember(name: string, email: string, role: TenantMember["role"], tenantSlug = "acme"): TenantMember {
    const state = this.stateFor(tenantSlug);
    const member: TenantMember = {
      id: `mem_${Date.now()}`,
      name,
      email,
      role,
      status: "invited",
      twoFactorEnabled: false,
      lastActive: "Invited just now",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
    };
    state.members.unshift(member);
    return member;
  }

  public updateSettings(updates: Partial<TenantSettingConfig>, tenantSlug = "acme"): TenantSettingConfig {
    const state = this.stateFor(tenantSlug);
    state.settings = { ...state.settings, ...updates };
    return { ...state.settings };
  }
}

export const marketplaceService = new MarketplaceService();
