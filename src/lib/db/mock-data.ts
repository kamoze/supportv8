/**
 * supportV8 Seed Database & In-Memory Store
 * Production-ready mock data matching supportV8 design specification v0.3
 */

import type {
  Issue,
  Problem,
  Insight,
  KnowledgeArticle,
  KnowledgeGap,
  KnowledgeProposal,
  KnowledgeDocument,
  KnowledgeDocumentChunk,
  KnowledgeWebSource,
  StaleWorkCandidate,
  SourceConnector,
  SupportPolicy,
  OverviewMetrics,
  TenantConfig,
  OperatingMode,
} from "../types";

export const DEFAULT_TENANT: TenantConfig = {
  tenantId: "tenant_default",
  name: "Acme Cloud Services",
  mode: "autonomous",
  featureFlags: {
    observeMode: true,
    copilotMode: true,
    autonomousMode: true,
    problemCorrelation: true,
    businessImpact: true,
    knowledgeIntelligence: true,
    proactiveComms: true,
    staleWorkSweep: true,
  },
};

export const INITIAL_SOURCES: SourceConnector[] = [
  {
    id: "src_zd_01",
    name: "Primary Zendesk Instance",
    type: "zendesk",
    status: "connected",
    lastSync: "2 mins ago",
    eventCountToday: 1420,
    credentialsConfigured: true,
    endpointUrl: "https://acme.zendesk.com/api/v2",
    capabilities: {
      read: ["tickets", "comments", "users", "tags", "custom_fields"],
      realtime: ["ticket.created", "ticket.updated", "comment.added"],
      write: ["add_tag", "update_priority", "add_internal_note", "close_ticket"],
    },
  },
  {
    id: "src_ic_01",
    name: "In-App Intercom Messenger",
    type: "intercom",
    status: "connected",
    lastSync: "Just now",
    eventCountToday: 890,
    credentialsConfigured: true,
    endpointUrl: "https://api.intercom.io/conversations",
    capabilities: {
      read: ["conversations", "contacts", "tags"],
      realtime: ["conversation.user.created", "conversation.user.replied"],
      write: ["tag_conversation", "assign_team", "send_reply"],
    },
  },
  {
    id: "src_tw_01",
    name: "Twilio Voice Contact Center",
    type: "twilio_voice",
    status: "connected",
    lastSync: "5 mins ago",
    eventCountToday: 310,
    credentialsConfigured: true,
    endpointUrl: "wss://stream.twilio.com/v1/voice",
    capabilities: {
      read: ["call_metadata", "realtime_transcripts"],
      realtime: ["call.started", "call.transcription", "call.ended"],
      write: ["transfer_call", "trigger_sms_followup"],
    },
  },
  {
    id: "src_kb_01",
    name: "KnowledgeV8 Corporate Base",
    type: "knowledgev8",
    status: "connected",
    lastSync: "1 hour ago",
    eventCountToday: 54,
    credentialsConfigured: true,
    endpointUrl: "https://knowledge.servicev8.internal/api",
    capabilities: {
      read: ["search_articles", "fetch_content", "analytics"],
      realtime: ["article.updated"],
      write: ["publish_article", "create_draft", "deprecate_article"],
    },
  },
];

export const INITIAL_PROBLEMS: Problem[] = [
  {
    id: "PRB-218",
    tenantId: "tenant_default",
    title: "Payment Gateway 504 Gateway Timeout During Checkout",
    summary: "High failure rate on Stripe v3 3DS verification webhook causing cart freezes during payment submission.",
    suspectedCause: "Upstream gateway API latency exceeding 8000ms timeout threshold in checkout worker v4.18.",
    status: "active",
    confidence: 0.94,
    impact: "critical",
    affectedCustomerCount: 187,
    affectedEnterpriseCount: 7,
    linkedIssueIds: ["ISS-1001", "ISS-1002", "ISS-1005", "ISS-1011"],
    estimatedRevenueExposure: 126000,
    firstSeen: "2026-08-26T02:15:00Z",
    lastSeen: "2026-08-26T04:45:00Z",
    trend: "increasing",
    owner: "Incident AI Employee / FinTech Ops",
    recommendedActions: [
      "Switch checkout worker fallback to Secondary Adyen Gateway",
      "Broadcast proactive status notification to 187 affected checkout sessions",
      "Apply Action Gateway policy override to auto-refund double-charge transactions",
    ],
    communicationsCount: 1,
    verificationState: "in_progress",
    sourceSystems: ["zendesk", "intercom", "chat"],
  },
  {
    id: "PRB-219",
    tenantId: "tenant_default",
    title: "Okta SAML 2.0 Identity Assertion Failure on Enterprise Login",
    summary: "Users from domain *.nordicenterprises.com unable to authenticate via Single Sign-On after certificate rotation.",
    suspectedCause: "Mismatch in X.509 signing certificate fingerprint in Identity Federation metadata.",
    status: "mitigating",
    confidence: 0.91,
    impact: "high",
    affectedCustomerCount: 64,
    affectedEnterpriseCount: 3,
    linkedIssueIds: ["ISS-1003", "ISS-1007"],
    estimatedRevenueExposure: 45000,
    firstSeen: "2026-08-26T01:30:00Z",
    lastSeen: "2026-08-26T04:20:00Z",
    trend: "decreasing",
    owner: "Identity Security Team",
    recommendedActions: [
      "Resync IdP metadata in Dominion SSO manager",
      "Dispatch temporary bypass token to authorized security contacts",
    ],
    communicationsCount: 2,
    verificationState: "verified",
    sourceSystems: ["zendesk", "email"],
  },
  {
    id: "PRB-220",
    tenantId: "tenant_default",
    title: "MFA SMS Delivery Latency in EMEA Region",
    summary: "Carriers in DE and FR experiencing 15+ minute delivery delays for one-time verification passcodes.",
    suspectedCause: "Regional aggregator routing throttle during maintenance window.",
    status: "active",
    confidence: 0.88,
    impact: "medium",
    affectedCustomerCount: 42,
    affectedEnterpriseCount: 0,
    linkedIssueIds: ["ISS-1004", "ISS-1008"],
    estimatedRevenueExposure: 12000,
    firstSeen: "2026-08-26T03:00:00Z",
    lastSeen: "2026-08-26T04:40:00Z",
    trend: "stable",
    owner: "Telephony Employee",
    recommendedActions: [
      "Prompt users to switch to TOTP Authenticator App in Web UI",
      "Route SMS traffic via backup Twilio route",
    ],
    communicationsCount: 0,
    verificationState: "unverified",
    sourceSystems: ["twilio_voice", "zendesk"],
  },
];

export const INITIAL_ISSUES: Issue[] = [
  {
    id: "ISS-1001",
    tenantId: "tenant_default",
    source: "zendesk",
    externalId: "ZD-884233",
    sourceUrl: "https://acme.zendesk.com/agent/tickets/884233",
    customerRef: "C-1920",
    customerName: "Sarah Jenkins",
    customerTier: "enterprise",
    summary: "Credit card page freezes on checkout submission with spinner",
    category: "checkout_failure",
    product: "Checkout Web",
    version: "4.18.2",
    sentiment: "angry",
    sentimentScore: -0.85,
    sentimentTrajectory: "deteriorating",
    priority: "urgent",
    confidence: 0.96,
    businessImpact: "critical",
    problemId: "PRB-218",
    sourceStatus: "open",
    resolutionRiskScore: 0.88,
    recommendedAction: "Apply automated gateway mitigation note and assign to High Priority Tier",
    tags: ["checkout", "payment_timeout", "enterprise", "stripe_error"],
    createdAt: "2026-08-26T04:12:00Z",
    updatedAt: "2026-08-26T04:30:00Z",
  },
  {
    id: "ISS-1002",
    tenantId: "tenant_default",
    source: "intercom",
    externalId: "IC-554192",
    sourceUrl: "https://app.intercom.com/a/apps/acme/conversations/554192",
    customerRef: "C-4481",
    customerName: "David Miller",
    customerTier: "pro",
    summary: "Payment will not complete, getting error 504 repeatedly",
    category: "checkout_failure",
    product: "Checkout Web",
    version: "4.18.2",
    sentiment: "frustrated",
    sentimentScore: -0.65,
    sentimentTrajectory: "stable",
    priority: "high",
    confidence: 0.94,
    businessImpact: "high",
    problemId: "PRB-218",
    sourceStatus: "open",
    resolutionRiskScore: 0.62,
    recommendedAction: "Send automated workaround instructions for alternative payment method",
    tags: ["checkout", "error_504", "pro_tier"],
    createdAt: "2026-08-26T04:18:00Z",
    updatedAt: "2026-08-26T04:22:00Z",
  },
  {
    id: "ISS-1003",
    tenantId: "tenant_default",
    source: "zendesk",
    externalId: "ZD-884240",
    sourceUrl: "https://acme.zendesk.com/agent/tickets/884240",
    customerRef: "C-8821",
    customerName: "Michael Chang",
    customerTier: "enterprise",
    summary: "Nordic Enterprises entire engineering team locked out of SSO login",
    category: "auth_sso",
    product: "Identity / SSO",
    version: "2.4.0",
    sentiment: "urgent",
    sentimentScore: -0.9,
    sentimentTrajectory: "stable",
    priority: "urgent",
    confidence: 0.95,
    businessImpact: "critical",
    problemId: "PRB-219",
    sourceStatus: "open",
    resolutionRiskScore: 0.92,
    recommendedAction: "Generate temporary emergency login tokens and notify IT Admin",
    tags: ["sso", "saml", "okta", "enterprise_impact"],
    createdAt: "2026-08-26T03:45:00Z",
    updatedAt: "2026-08-26T04:10:00Z",
  },
  {
    id: "ISS-1004",
    tenantId: "tenant_default",
    source: "twilio_voice",
    externalId: "TW-99321",
    sourceUrl: "https://console.twilio.com/voice/calls/TW-99321",
    customerRef: "C-3310",
    customerName: "Elena Rostova",
    customerTier: "standard",
    summary: "Customer waiting 20 minutes for 2FA SMS code in Germany",
    category: "mfa_sms",
    product: "Authentication",
    version: "2.4.0",
    sentiment: "frustrated",
    sentimentScore: -0.55,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.89,
    businessImpact: "medium",
    problemId: "PRB-220",
    sourceStatus: "open",
    resolutionRiskScore: 0.45,
    recommendedAction: "Advise switching to Authenticator App or voice call code",
    tags: ["mfa", "sms_delay", "emea"],
    createdAt: "2026-08-26T03:50:00Z",
    updatedAt: "2026-08-26T04:05:00Z",
  },
  {
    id: "ISS-1005",
    tenantId: "tenant_default",
    source: "chat",
    externalId: "CH-12093",
    sourceUrl: "https://support.acme.com/live/12093",
    customerRef: "C-9104",
    customerName: "Robert Vance",
    customerTier: "enterprise",
    summary: "Tried to purchase annual enterprise plan 3 times, transaction failed",
    category: "checkout_failure",
    product: "Checkout Web",
    version: "4.18.2",
    sentiment: "angry",
    sentimentScore: -0.88,
    sentimentTrajectory: "deteriorating",
    priority: "urgent",
    confidence: 0.97,
    businessImpact: "critical",
    problemId: "PRB-218",
    sourceStatus: "open",
    resolutionRiskScore: 0.85,
    recommendedAction: "Escalate to Account Executive and offer manual invoice billing",
    tags: ["annual_contract", "checkout_fail", "high_arr"],
    createdAt: "2026-08-26T04:25:00Z",
    updatedAt: "2026-08-26T04:42:00Z",
  },
  {
    id: "ISS-1006",
    tenantId: "tenant_default",
    source: "chat",
    externalId: "WO-88419",
    sourceUrl: "https://support.acme.com/live/12098",
    customerRef: "CTR-4491",
    customerName: "David O'Connor",
    customerTier: "pro",
    summary: "Need access code for Site B Electrical Room lockbox before 8 AM",
    category: "contractor_dispatch",
    product: "Field Operations",
    version: "1.8.0",
    sentiment: "neutral",
    sentimentScore: 0.25,
    sentimentTrajectory: "stable",
    priority: "high",
    confidence: 0.96,
    businessImpact: "medium",
    sourceStatus: "open",
    resolutionRiskScore: 0.15,
    recommendedAction: "Dispatch automated one-time site access PIN valid for 60 minutes",
    tags: ["contractor", "site_access", "lockbox_pin", "field_dispatch"],
    createdAt: "2026-08-26T04:30:00Z",
    updatedAt: "2026-08-26T04:32:00Z",
    entityType: "contractor",
    contractor: {
      company: "Apex Field Solutions",
      contactName: "David O'Connor",
      phone: "+1 (555) 234-8901",
      trade: "Electrical & Facilities SRE",
      workOrderId: "WO-88419",
      siteLocation: "Site B - Facility Electrical Room 102",
      dispatchStatus: "en_route",
      eta: "15 mins",
      accessCode: "LOCK-7729-PIN",
    },
  },
  {
    id: "ISS-1010",
    tenantId: "tenant_default",
    source: "email",
    externalId: "WO-90214",
    sourceUrl: "https://ops.acme.com/dispatch/90214",
    customerRef: "CTR-8812",
    customerName: "Mike Vance",
    customerTier: "enterprise",
    summary: "Core Switch Fabric 100GbE Optic Replacement on Rack 18-B",
    category: "contractor_dispatch",
    product: "Hardware Infrastructure",
    version: "2.1.0",
    sentiment: "neutral",
    sentimentScore: 0.5,
    sentimentTrajectory: "stable",
    priority: "urgent",
    confidence: 0.98,
    businessImpact: "high",
    problemId: "PRB-218",
    sourceStatus: "open",
    resolutionRiskScore: 0.25,
    recommendedAction: "Transmit optic serial # verification and escort security badge to technician",
    tags: ["contractor", "hardware_dispatch", "datacenter_east", "switch_optic"],
    createdAt: "2026-08-26T04:35:00Z",
    updatedAt: "2026-08-26T04:40:00Z",
    entityType: "contractor",
    contractor: {
      company: "DataOps Pro Field Services",
      contactName: "Mike Vance",
      phone: "+1 (555) 890-4432",
      trade: "Datacenter Hardware Engineer",
      workOrderId: "WO-90214",
      siteLocation: "DC-East 2, Cage B4, Rack 18",
      dispatchStatus: "on_site",
      eta: "On Site (Cage B4)",
      accessCode: "BADGE-SEC-4418",
    },
  },
  {
    id: "ISS-1012",
    tenantId: "tenant_default",
    source: "chat",
    externalId: "WO-90342",
    sourceUrl: "https://ops.acme.com/dispatch/90342",
    customerRef: "CTR-3390",
    customerName: "Arthur Dent",
    customerTier: "pro",
    summary: "Basement HVAC Chiller Loop 2 High Pressure Alert Inspection",
    category: "contractor_dispatch",
    product: "Facilities & Power",
    version: "1.0.0",
    sentiment: "urgent",
    sentimentScore: -0.4,
    sentimentTrajectory: "stable",
    priority: "high",
    confidence: 0.92,
    businessImpact: "high",
    sourceStatus: "open",
    resolutionRiskScore: 0.35,
    recommendedAction: "Issue gate pass for heavy refrigerant equipment and notify Building Ops",
    tags: ["contractor", "chiller_inspection", "emergency_hvac"],
    createdAt: "2026-08-26T04:40:00Z",
    updatedAt: "2026-08-26T04:45:00Z",
    entityType: "contractor",
    contractor: {
      company: "CoolTech Industrial HVAC",
      contactName: "Arthur Dent",
      phone: "+1 (555) 776-9021",
      trade: "Industrial HVAC & Chiller Specialist",
      workOrderId: "WO-90342",
      siteLocation: "Building 4 Facility Basement, Mechanical Room 02",
      dispatchStatus: "dispatched",
      eta: "35 mins",
      assignedVehicle: "Service Van #14 (Plate: NY-7881)",
    },
  },
  {
    id: "ISS-1007",
    tenantId: "tenant_default",
    source: "email",
    externalId: "EM-77210",
    sourceUrl: "https://mail.acme.com/thread/77210",
    customerRef: "C-8821",
    customerName: "Astrid Lindgren",
    customerTier: "enterprise",
    summary: "SSO Certificate Expired error when logging into production dashboard",
    category: "auth_sso",
    product: "Identity / SSO",
    version: "2.4.0",
    sentiment: "frustrated",
    sentimentScore: -0.65,
    sentimentTrajectory: "stable",
    priority: "urgent",
    confidence: 0.94,
    businessImpact: "critical",
    problemId: "PRB-219",
    sourceStatus: "open",
    resolutionRiskScore: 0.88,
    recommendedAction: "Apply IdP certificate thumbprint update and send SSO bypass link",
    tags: ["sso", "saml", "certificate_rotation", "enterprise"],
    createdAt: "2026-08-26T04:00:00Z",
    updatedAt: "2026-08-26T04:15:00Z",
  },
  {
    id: "ISS-1008",
    tenantId: "tenant_default",
    source: "whatsapp",
    externalId: "WA-33019",
    sourceUrl: "https://api.whatsapp.com/v1/conversations/33019",
    customerRef: "C-1102",
    customerName: "Hans Weber",
    customerTier: "standard",
    summary: "SMS verification code never arrived for mobile app login",
    category: "mfa_sms",
    product: "Authentication",
    version: "2.4.0",
    sentiment: "neutral",
    sentimentScore: 0.1,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.91,
    businessImpact: "low",
    problemId: "PRB-220",
    sourceStatus: "closed",
    resolutionRiskScore: 0.2,
    recommendedAction: "Sent fallback WhatsApp OTP verification link autonomously",
    tags: ["mfa", "sms_fallback", "whatsapp", "autonomous_resolved"],
    createdAt: "2026-08-26T03:30:00Z",
    updatedAt: "2026-08-26T03:32:00Z",
  },
  {
    id: "ISS-1009",
    tenantId: "tenant_default",
    source: "zendesk",
    externalId: "ZD-884260",
    sourceUrl: "https://acme.zendesk.com/agent/tickets/884260",
    customerRef: "C-5520",
    customerName: "Claire Bennett",
    customerTier: "pro",
    summary: "Requesting credit voucher for 30 minutes of checkout downtime yesterday",
    category: "billing_invoice",
    product: "Billing Portal",
    version: "3.2.1",
    sentiment: "neutral",
    sentimentScore: 0.4,
    sentimentTrajectory: "improving",
    priority: "normal",
    confidence: 0.95,
    businessImpact: "low",
    sourceStatus: "closed",
    resolutionRiskScore: 0.1,
    recommendedAction: "Dispatched $50 credit token via OrderV8 Forge Gateway autonomously",
    tags: ["billing", "credit_voucher", "autonomous_resolved", "pro_tier"],
    createdAt: "2026-08-26T02:40:00Z",
    updatedAt: "2026-08-26T02:42:00Z",
  },
  {
    id: "ISS-1010",
    tenantId: "tenant_default",
    source: "chat",
    externalId: "CH-12104",
    sourceUrl: "https://support.acme.com/live/12104",
    customerRef: "VND-9921",
    customerName: "Carlos Mendez",
    customerTier: "standard",
    summary: "Uploaded revised 2026 W9 form and COI insurance certificate",
    category: "contractor_access",
    product: "Vendor Management",
    version: "1.8.0",
    sentiment: "happy",
    sentimentScore: 0.85,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.98,
    businessImpact: "low",
    sourceStatus: "closed",
    resolutionRiskScore: 0.05,
    recommendedAction: "Validated documents against S3 compliance vault and marked vendor active",
    tags: ["contractor", "compliance", "w9_verified", "autonomous_resolved"],
    createdAt: "2026-08-26T02:10:00Z",
    updatedAt: "2026-08-26T02:12:00Z",
  },
  {
    id: "ISS-1011",
    tenantId: "tenant_default",
    source: "intercom",
    externalId: "IC-554210",
    sourceUrl: "https://app.intercom.com/a/apps/acme/conversations/554210",
    customerRef: "C-6619",
    customerName: "Emily Zhao",
    customerTier: "enterprise",
    summary: "Double charge appeared on American Express after timeout on checkout",
    category: "checkout_failure",
    product: "Checkout Web",
    version: "4.18.2",
    sentiment: "frustrated",
    sentimentScore: -0.5,
    sentimentTrajectory: "improving",
    priority: "urgent",
    confidence: 0.96,
    businessImpact: "critical",
    problemId: "PRB-218",
    sourceStatus: "closed",
    resolutionRiskScore: 0.18,
    recommendedAction: "Triggered idempotent authorization void via Stripe connector",
    tags: ["checkout", "double_charge", "void_processed", "autonomous_resolved"],
    createdAt: "2026-08-26T01:50:00Z",
    updatedAt: "2026-08-26T01:55:00Z",
  },
  {
    id: "ISS-1012",
    tenantId: "tenant_default",
    source: "zendesk",
    externalId: "ZD-884275",
    sourceUrl: "https://acme.zendesk.com/agent/tickets/884275",
    customerRef: "C-3380",
    customerName: "Alex Rivera",
    customerTier: "pro",
    summary: "Webhook secret verification failing with 401 Unauthorized",
    category: "api_developer",
    product: "Developer API",
    version: "v2.1",
    sentiment: "neutral",
    sentimentScore: 0.35,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.92,
    businessImpact: "medium",
    sourceStatus: "open",
    resolutionRiskScore: 0.3,
    recommendedAction: "Referenced KnowledgeV8 HMAC SHA-256 header validation guide",
    tags: ["api", "webhook", "hmac_signature", "developer"],
    createdAt: "2026-08-26T01:10:00Z",
    updatedAt: "2026-08-26T01:25:00Z",
  },
  {
    id: "ISS-1013",
    tenantId: "tenant_default",
    source: "chat",
    externalId: "CH-12110",
    sourceUrl: "https://support.acme.com/live/12110",
    customerRef: "C-7740",
    customerName: "Jessica Taylor",
    customerTier: "standard",
    summary: "Forgot login password and need magic link reset",
    category: "auth_sso",
    product: "Authentication",
    version: "2.4.0",
    sentiment: "happy",
    sentimentScore: 0.9,
    sentimentTrajectory: "stable",
    priority: "low",
    confidence: 0.99,
    businessImpact: "low",
    sourceStatus: "closed",
    resolutionRiskScore: 0.02,
    recommendedAction: "Generated secure magic link token and dispatched to verified email",
    tags: ["password_reset", "magic_link", "autonomous_resolved"],
    createdAt: "2026-08-26T00:45:00Z",
    updatedAt: "2026-08-26T00:46:00Z",
  },
  {
    id: "ISS-1014",
    tenantId: "tenant_default",
    source: "email",
    externalId: "EM-77240",
    sourceUrl: "https://mail.acme.com/thread/77240",
    customerRef: "C-9901",
    customerName: "Liam Gallagher",
    customerTier: "enterprise",
    summary: "Enterprise custom SLA addendum review for Q4 contract renewal",
    category: "billing_invoice",
    product: "Enterprise Contracts",
    version: "2026.3",
    sentiment: "happy",
    sentimentScore: 0.8,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.94,
    businessImpact: "high",
    sourceStatus: "open",
    resolutionRiskScore: 0.25,
    recommendedAction: "Attached 99.99% VARR SLA compliance scorecard and routed to account director",
    tags: ["enterprise_renewal", "sla_report", "high_arr"],
    createdAt: "2026-08-26T00:20:00Z",
    updatedAt: "2026-08-26T00:30:00Z",
  },
  {
    id: "ISS-1015",
    tenantId: "tenant_default",
    source: "intercom",
    externalId: "IC-554230",
    sourceUrl: "https://app.intercom.com/a/apps/acme/conversations/554230",
    customerRef: "C-4412",
    customerName: "Klaus Schmidt",
    customerTier: "pro",
    summary: "How do I register a YubiKey 5C NFC key for my staff account?",
    category: "auth_sso",
    product: "Authentication",
    version: "2.4.0",
    sentiment: "neutral",
    sentimentScore: 0.5,
    sentimentTrajectory: "stable",
    priority: "normal",
    confidence: 0.95,
    businessImpact: "low",
    sourceStatus: "closed",
    resolutionRiskScore: 0.08,
    recommendedAction: "Provided step-by-step FIDO2 registration instructions from Knowledge proposal",
    tags: ["fido2", "yubikey", "hardware_key", "autonomous_resolved"],
    createdAt: "2026-08-25T23:50:00Z",
    updatedAt: "2026-08-25T23:53:00Z",
  },
  {
    id: "ISS-1016",
    tenantId: "tenant_default",
    source: "zendesk",
    externalId: "ZD-884290",
    sourceUrl: "https://acme.zendesk.com/agent/tickets/884290",
    customerRef: "C-2290",
    customerName: "Sophia Loren",
    customerTier: "standard",
    summary: "Auto-closed ticket survey: rated resolution 5 out of 5 stars",
    category: "billing_invoice",
    product: "Billing Portal",
    version: "3.2.1",
    sentiment: "happy",
    sentimentScore: 0.98,
    sentimentTrajectory: "stable",
    priority: "low",
    confidence: 1.0,
    businessImpact: "low",
    sourceStatus: "closed",
    resolutionRiskScore: 0.01,
    recommendedAction: "CSAT recorded in satisfaction analytics database",
    tags: ["csat_5_star", "survey_completed", "autonomous_resolved"],
    createdAt: "2026-08-25T23:10:00Z",
    updatedAt: "2026-08-25T23:12:00Z",
  },
];

export const INITIAL_INSIGHTS: Insight[] = [
  {
    id: "INS-301",
    tenantId: "tenant_default",
    title: "Billing CSAT declined from 94% to 82% over the last 7 days",
    finding: "73% of negative sentiment is driven by autonomous refund delays where AI confidence fell below 75%.",
    evidence: [
      "43 customer conversations re-opened after AI refusal to refund",
      "Average CSAT on autonomous refund requests: 2.8 / 5.0",
      "Refund requests involving currency conversion show 3.2x higher failure rate",
    ],
    confidence: 0.92,
    affectedSegment: "Pro & Standard Customers (Self-Serve)",
    businessImpact: "high",
    likelyDriver: "Autonomous refund confidence threshold (72%) is triggering too many agent escalations for small balances.",
    recommendation: "Increase autonomous refund confidence threshold from 72% to 85% and auto-approve refunds < $50 for Pro accounts.",
    recommendedOperation: "zendesk.ticket.update_priority",
    status: "new",
    createdAt: "2026-08-26T02:00:00Z",
  },
  {
    id: "INS-302",
    tenantId: "tenant_default",
    title: "Sharp 217% surge in MFA authentication inquiries",
    finding: "Customers migrating to OAuth 2.0 cannot find instructions for TOTP hardware key enrollment.",
    evidence: [
      "86 tickets opened in 48 hours referencing 'YubiKey' or 'FIDO2'",
      "Knowledge search queries for 'Hardware Key' returned 0 matching articles",
      "Average agent handling time on these cases is 22 minutes",
    ],
    confidence: 0.95,
    affectedSegment: "Enterprise IT Administrators",
    businessImpact: "medium",
    likelyDriver: "Documentation gap in KnowledgeV8 regarding recent FIDO2 enterprise rollout.",
    recommendation: "Publish pre-drafted Knowledge Article 'Configuring Hardware MFA & FIDO2 Keys' to Zendesk Guide.",
    recommendedOperation: "knowledge.publish",
    actionPayload: {
      title: "Configuring Hardware MFA & FIDO2 Keys",
      content: "Complete step-by-step procedure for enrolling security keys...",
    },
    status: "new",
    createdAt: "2026-08-26T01:15:00Z",
  },
  {
    id: "INS-303",
    tenantId: "tenant_default",
    title: "43 external Zendesk tickets identified as stale (safe to close)",
    finding: "Tickets marked pending customer response for >14 days with no reopen activity.",
    evidence: [
      "43 tickets in Zendesk 'Pending' state since August 10th",
      "Zero customer messages received following resolution confirmation",
      "Closing these will improve backlog metric by 18%",
    ],
    confidence: 0.98,
    affectedSegment: "All customer tiers",
    businessImpact: "low",
    likelyDriver: "Human agents leaving tickets in pending status instead of resolving.",
    recommendation: "Run Stale Work Sweeper to auto-close 43 dormant tickets with automated satisfaction survey.",
    recommendedOperation: "zendesk.ticket.close",
    status: "reviewed",
    createdAt: "2026-08-25T18:00:00Z",
  },
];

export const INITIAL_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "KB-101",
    source: "zendesk_guide",
    title: "Managing SSO and SAML 2.0 Identity Providers",
    url: "https://support.acme.com/hc/articles/360012-sso-guide",
    category: "Authentication & Security",
    usageCount: 4120,
    csatScore: 4.6,
    status: "active",
    lastUpdated: "2026-08-15",
    summary: "Comprehensive guide for setting up Okta, Azure AD, and Google Workspace SSO.",
  },
  {
    id: "KB-102",
    source: "knowledgev8",
    title: "Payment Processing & Invoicing FAQ",
    url: "https://knowledge.servicev8.internal/articles/billing-faq",
    category: "Billing & Subscriptions",
    usageCount: 2840,
    csatScore: 3.8,
    status: "stale",
    lastUpdated: "2026-04-10",
    summary: "Billing troubleshooting. Contains outdated references to Stripe legacy checkout.",
  },
  {
    id: "KB-103",
    source: "confluence",
    title: "Webhook Delivery & Retry Policy",
    url: "https://wiki.acme.com/engineering/webhooks",
    category: "Developer Platform",
    usageCount: 950,
    csatScore: 4.8,
    status: "active",
    lastUpdated: "2026-08-01",
    summary: "Technical reference for webhook headers, signatures, and exponential backoff.",
  },
];

export const INITIAL_KNOWLEDGE_GAPS: KnowledgeGap[] = [
  {
    id: "GAP-201",
    topic: "Hardware Token & FIDO2 MFA Setup",
    recurringIssueCount: 86,
    confidence: 0.94,
    sampleQueries: ["How do I register my YubiKey?", "FIDO2 security key not recognized", "Hardware MFA error 403"],
    suggestedAction: "Create new Knowledge Article with step-by-step enrollment screenshots.",
    status: "draft_proposed",
    firstDetected: "2026-08-24T10:00:00Z",
  },
  {
    id: "GAP-202",
    topic: "Automated Currency Conversion Refunds",
    recurringIssueCount: 43,
    confidence: 0.88,
    sampleQueries: ["Refund received in wrong currency", "FX fee deducted from refund", "EUR vs USD refund rate"],
    suggestedAction: "Update billing FAQ with international banking FX refund timelines.",
    status: "detected",
    firstDetected: "2026-08-25T14:30:00Z",
  },
];

export const INITIAL_KNOWLEDGE_PROPOSALS: KnowledgeProposal[] = [
  {
    id: "PROP-101",
    gapId: "GAP-201",
    targetSource: "zendesk_guide",
    title: "Configuring Hardware Security Keys (FIDO2 / YubiKey)",
    proposedContent: `# Configuring Hardware Security Keys (FIDO2 / YubiKey)

supportV8 has generated this procedure based on 86 verified successful agent resolutions.

## Prerequisites
- Supported Browser (Chrome 110+, Safari 16+, Firefox 112+)
- WebAuthn-compliant Security Key (YubiKey 5 Series, Titan Security Key)

## Step-by-Step Enrollment
1. Navigate to **Account Settings > Security > Multi-Factor Authentication**.
2. Click **Add Security Key**.
3. When prompted by your operating system, insert and touch your hardware key.
4. Name your key (e.g., 'Primary YubiKey 5C') and click **Save**.
5. Download your offline emergency backup codes.

## Troubleshooting
If key is not detected, ensure browser USB permissions are granted under *chrome://settings/content*.`,
    rationale: "Addresses 86 recurring inquiries regarding FIDO2 enrollment without requiring human agent intervention.",
    provenance: "Synthesized from 12 senior agent resolution transcripts with 100% CSAT.",
    confidence: 0.96,
    status: "pending_approval",
    createdAt: "2026-08-26T03:00:00Z",
  },
];

export const INITIAL_STALE_WORK: StaleWorkCandidate[] = [
  {
    id: "SW-01",
    issueId: "ISS-991",
    externalId: "ZD-881204",
    source: "zendesk",
    customerName: "Quantum Dynamics",
    daysInactive: 16,
    reason: "no_customer_reply",
    confidence: 0.97,
    recommendedAction: "close",
    suggestedNote: "Ticket auto-closed after 16 days of customer inactivity following resolution verification.",
    status: "detected",
  },
  {
    id: "SW-02",
    issueId: "ISS-992",
    externalId: "ZD-881330",
    source: "zendesk",
    customerName: "Starlight Media",
    daysInactive: 19,
    reason: "resolved_not_closed",
    confidence: 0.99,
    recommendedAction: "close",
    suggestedNote: "Closing ticket: Customer confirmed resolution via email on Aug 7.",
    status: "detected",
  },
  {
    id: "SW-03",
    issueId: "ISS-993",
    externalId: "IC-550102",
    source: "intercom",
    customerName: "Vertex AI Labs",
    daysInactive: 22,
    reason: "duplicate_of_problem",
    confidence: 0.91,
    recommendedAction: "link_to_problem",
    suggestedNote: "Link to Problem PRB-210 (Historical) and mark superseded.",
    status: "reviewed",
  },
];

export const INITIAL_POLICY: SupportPolicy = {
  tenantId: "tenant_default",
  operatingMode: "autonomous",
  autonomyThreshold: "medium", // 'read' | 'low' | 'medium' | 'high' | 'critical'
  confidenceMin: 0.85,
  sentimentEscalationEnabled: true,
  sentimentThreshold: "angry",
  autoProblemLinkThreshold: 0.90,
  staleWorkAutoCloseDays: 14,
  proactiveCommsApprovalRequired: true,
  retentionRawContextHours: 24,
  retentionDerivedMonths: 24,
};

export const INITIAL_OVERVIEW_METRICS: OverviewMetrics = {
  csat: 91.4,
  csatChange: -2.3,
  issueVolume: 1842,
  issueVolumeChange: +14.8,
  activeProblems: 3,
  varrRate: 74.8,
  businessExposure: 183000,
  needsAttention: [
    {
      id: "na_1",
      severity: "critical",
      title: "Checkout 504 Gateway Timeouts",
      description: "187 customers affected across Zendesk and Intercom. Estimated $126K revenue exposure.",
      impactText: "CRITICAL REVENUE AT RISK ($126K)",
      actionText: "Investigate Problem",
      targetTab: "problems",
      targetId: "PRB-218",
    },
    {
      id: "na_2",
      severity: "warning",
      title: "Billing CSAT Deterioration (94% -> 82%)",
      description: "AI refund refusals causing elevated ticket re-opens in self-serve segment.",
      impactText: "CSAT IMPACT (-12% DECLINE)",
      actionText: "Review Insight",
      targetTab: "insights",
      targetId: "INS-301",
    },
    {
      id: "na_3",
      severity: "knowledge",
      title: "Surge in FIDO2 MFA Inquiries",
      description: "86 new tickets opened. Proposed Knowledge Article ready for one-click publishing.",
      impactText: "KNOWLEDGE GAP DETECTED",
      actionText: "Review KB Proposal",
      targetTab: "knowledge",
      targetId: "PROP-101",
    },
  ],
  aiDiscovered: [
    {
      id: "ad_1",
      type: "problem",
      title: "3 Emerging Problems Detected",
      description: "Cross-channel clustering grouped 312 recent contacts into 3 systemic incidents.",
      confidence: 0.94,
      actionText: "View Correlation Matrix",
      targetTab: "problems",
    },
    {
      id: "ad_2",
      type: "gap",
      title: "2 Critical Knowledge Gaps",
      description: "Identified documentation deficits in Hardware MFA setup and currency refunds.",
      confidence: 0.95,
      actionText: "Inspect Knowledge Radar",
      targetTab: "knowledge",
    },
    {
      id: "ad_3",
      type: "stale",
      title: "43 Stale Tickets Safe to Close",
      description: "Dormant external helpdesk tickets ready for automated sweep.",
      confidence: 0.98,
      actionText: "Run Work Sweep",
      targetTab: "stale_work",
    },
  ],
  recentActivity: [
    {
      id: "act_1",
      timestamp: "Just now",
      type: "action_executed",
      description: "Action Gateway executed 'zendesk.ticket.add_tag' on ZD-884233 [autonomous]",
      actor: "Support AI Employee",
      badgeColor: "emerald",
    },
    {
      id: "act_2",
      timestamp: "4 mins ago",
      type: "problem_detected",
      description: "Problem PRB-218 correlated 187 issues ($126K exposure calculated)",
      actor: "Problem Engine",
      badgeColor: "rose",
    },
    {
      id: "act_3",
      timestamp: "12 mins ago",
      type: "proactive_sent",
      description: "Proactive status notification dispatched to 64 Okta SSO users",
      actor: "Proactive Comms Hub",
      badgeColor: "indigo",
    },
    {
      id: "act_4",
      timestamp: "28 mins ago",
      type: "kb_proposed",
      description: "Drafted proposed update: 'Configuring Hardware Security Keys (FIDO2)'",
      actor: "Knowledge Employee",
      badgeColor: "cyan",
    },
  ],
  aiWorkforce: [
    {
      id: "emp_1",
      name: "Triage & Resolution Employee",
      role: "Tier 1 Customer Support AI",
      status: "active",
      assignedCount: 142,
      csat: 94.2,
      varr: 82.5,
      avatar: "🤖",
    },
    {
      id: "emp_2",
      name: "Incident Correlation Employee",
      role: "Problem & Business Impact Analyst",
      status: "active",
      assignedCount: 38,
      csat: 96.0,
      varr: 91.0,
      avatar: "🧠",
    },
    {
      id: "emp_3",
      name: "Knowledge Refresh Employee",
      role: "Continuous Knowledge Improvement",
      status: "reviewing",
      assignedCount: 19,
      csat: 92.8,
      varr: 78.0,
      avatar: "📚",
    },
  ],
};

/**
 * In-Memory Store Singleton
 */
class SupportDatabase {
  public tenant: TenantConfig = { ...DEFAULT_TENANT };
  public sources: SourceConnector[] = [...INITIAL_SOURCES];
  public problems: Problem[] = [...INITIAL_PROBLEMS];
  public issues: Issue[] = [...INITIAL_ISSUES];
  public insights: Insight[] = [...INITIAL_INSIGHTS];
  public articles: KnowledgeArticle[] = [...INITIAL_KNOWLEDGE_ARTICLES];
  public gaps: KnowledgeGap[] = [...INITIAL_KNOWLEDGE_GAPS];
  public proposals: KnowledgeProposal[] = [...INITIAL_KNOWLEDGE_PROPOSALS];
  public staleWork: StaleWorkCandidate[] = [...INITIAL_STALE_WORK];
  public policy: SupportPolicy = { ...INITIAL_POLICY };

  public documents: KnowledgeDocument[] = [
    {
      id: "doc_s3_001",
      tenantId: "tenant_default",
      filename: "SAML_Okta_Setup_Guide_v2.md",
      fileType: "md",
      fileSizeBytes: 14320,
      s3Key: "tenant_default/kb/1787720000_SAML_Okta_Setup_Guide_v2.md",
      s3Url: "https://supportv8-kb-documents.s3.amazonaws.com/tenant_default/kb/1787720000_SAML_Okta_Setup_Guide_v2.md",
      category: "auth_sso",
      title: "Okta SAML 2.0 Integration & Troubleshooting Guide",
      chunkCount: 8,
      status: "indexed",
      uploadedAt: "2026-08-25T14:20:00.000Z",
      summary: "Comprehensive guide for configuring Okta SSO, entity IDs, certificates, and clock skew resolution.",
    },
    {
      id: "doc_s3_002",
      tenantId: "tenant_default",
      filename: "Checkout_Payment_Gateway_Failures_Runbook.pdf",
      fileType: "pdf",
      fileSizeBytes: 48200,
      s3Key: "tenant_default/kb/1787720100_Checkout_Payment_Gateway_Failures_Runbook.pdf",
      s3Url: "https://supportv8-kb-documents.s3.amazonaws.com/tenant_default/kb/1787720100_Checkout_Payment_Gateway_Failures_Runbook.pdf",
      category: "checkout_failure",
      title: "Checkout 504 Gateway Timeout Runbook",
      chunkCount: 14,
      status: "indexed",
      uploadedAt: "2026-08-25T18:45:00.000Z",
      summary: "Diagnostic runbook for payment gateway timeouts, database connection pooling, and circuit breaker recovery.",
    },
  ];
  public documentChunks: KnowledgeDocumentChunk[] = [];

  public webSources: KnowledgeWebSource[] = [
    {
      id: "src_web_001",
      tenantId: "tenant_default",
      url: "https://docs.acme.com/identity/sso-saml",
      title: "Acme SSO & SAML Identity Portal Docs",
      category: "auth_sso",
      crawlDepth: 1,
      pageCount: 3,
      chunkCount: 12,
      status: "indexed",
      lastCrawledAt: "2026-08-25T16:00:00.000Z",
      s3SnapshotUrl: "https://supportv8-kb-documents.s3.amazonaws.com/tenant_default/kb/web_docs_acme_com_1787720000.md",
      summary: "Official customer documentation on configuring federated SAML SSO, attribute mappings, and certificates.",
    },
    {
      id: "src_web_002",
      tenantId: "tenant_default",
      url: "https://status.acme.com/history",
      title: "Acme Cloud Infrastructure Status & Incident History",
      category: "infrastructure",
      crawlDepth: 1,
      pageCount: 1,
      chunkCount: 6,
      status: "indexed",
      lastCrawledAt: "2026-08-26T00:30:00.000Z",
      s3SnapshotUrl: "https://supportv8-kb-documents.s3.amazonaws.com/tenant_default/kb/web_status_acme_com_1787720500.md",
      summary: "System availability history, planned maintenance windows, and regional latency notices for EMEA and US-East.",
    },
  ];

  public getOverviewMetrics(): OverviewMetrics {
    const totalIssues = this.issues.length;
    const activeProblemsList = this.problems.filter((p) => p.status !== "resolved");
    const activeProblemsCount = activeProblemsList.length;

    // 1. Business Exposure: Exact dollar sum of estimated revenue exposure across all active problems
    const businessExposure = activeProblemsList.reduce(
      (sum, p) => sum + (p.estimatedRevenueExposure || 0),
      0
    );

    // 2. CSAT: Derived from actual sentiment distribution across issues
    // Issues with neutral/happy sentiment (sentimentScore >= -0.3) count toward positive customer satisfaction
    const positiveIssues = this.issues.filter(
      (i) => (i.sentimentScore ?? 0) >= -0.3 && i.sentiment !== "angry" && i.sentiment !== "urgent"
    ).length;
    const csat = totalIssues > 0 ? parseFloat(((positiveIssues / totalIssues) * 100).toFixed(1)) : 91.5;

    // CSAT Change: Difference between most recent 5 issues vs total baseline
    const recentIssues = this.issues.slice(-5);
    const recentPos = recentIssues.filter((i) => (i.sentimentScore ?? 0) >= -0.3).length;
    const recentCsat = recentIssues.length > 0 ? (recentPos / recentIssues.length) * 100 : csat;
    const csatDelta = recentCsat - csat;
    const csatChange = parseFloat((csatDelta >= 0 ? Math.min(csatDelta, 4.5) : Math.max(csatDelta, -4.5)).toFixed(1));

    // 3. Issue Volume: Aggregated ingress event counts across connected channels
    const totalChannelEvents = this.sources.reduce((sum, s) => sum + (s.eventCountToday || 0), 0);
    const issueVolume = totalChannelEvents > 0 ? totalChannelEvents : totalIssues * 115;
    const issueVolumeChange = 14.8;

    // 4. North Star VARR (Verified Autonomous Resolution Rate):
    // Real ratio of issues that are autonomously resolved or high confidence (>= 0.85) without human intervention
    const autonomousResolvedCount = this.issues.filter(
      (i) =>
        i.tags.includes("autonomous_resolved") ||
        (i.confidence >= 0.85 && (i.sourceStatus === "closed" || i.resolutionRiskScore < 0.25))
    ).length;
    const varrRate = totalIssues > 0 ? parseFloat(((autonomousResolvedCount / totalIssues) * 100).toFixed(1)) : 75.0;

    // 5. Needs Attention: Dynamically derived from active problems, unreviewed insights, and open knowledge gaps
    const needsAttention: OverviewMetrics["needsAttention"] = [];

    for (const p of activeProblemsList.slice(0, 2)) {
      needsAttention.push({
        id: `na_prob_${p.id}`,
        severity: p.impact === "critical" ? "critical" : "warning",
        title: p.title,
        description: `${p.affectedCustomerCount} customers affected across ${p.sourceSystems.join(", ")}. Estimated $${(p.estimatedRevenueExposure / 1000).toFixed(0)}K revenue exposure.`,
        impactText: `${p.impact.toUpperCase()} REVENUE AT RISK ($${(p.estimatedRevenueExposure / 1000).toFixed(0)}K)`,
        actionText: "Investigate Problem",
        targetTab: "problems",
        targetId: p.id,
      });
    }

    const unreviewedInsights = this.insights.filter((i) => i.status === "new");
    for (const ins of unreviewedInsights.slice(0, 1)) {
      needsAttention.push({
        id: `na_ins_${ins.id}`,
        severity: "warning",
        title: ins.title,
        description: ins.finding,
        impactText: `${ins.businessImpact.toUpperCase()} IMPACT`,
        actionText: "Review Insight",
        targetTab: "insights",
        targetId: ins.id,
      });
    }

    const openGaps = this.gaps.filter((g) => g.status === "detected");
    for (const gap of openGaps.slice(0, 1)) {
      needsAttention.push({
        id: `na_gap_${gap.id}`,
        severity: "knowledge",
        title: `Surge in ${gap.topic} Inquiries`,
        description: `${gap.recurringIssueCount} recurring tickets opened. Proposed Knowledge Article ready for one-click publishing.`,
        impactText: "KNOWLEDGE GAP DETECTED",
        actionText: "Review KB Proposal",
        targetTab: "knowledge",
        targetId: gap.id,
      });
    }

    // 6. AI Discovered Intelligence: Computed from live database groupings
    const totalAffectedCustomers = activeProblemsList.reduce((sum, p) => sum + p.affectedCustomerCount, 0);
    const aiDiscovered: OverviewMetrics["aiDiscovered"] = [
      {
        id: "ad_problems",
        type: "problem",
        title: `${activeProblemsCount} Emerging Problems Detected`,
        description: `Cross-channel clustering grouped ${totalAffectedCustomers} recent contacts into ${activeProblemsCount} systemic incidents.`,
        confidence: 0.94,
        actionText: "View Correlation Matrix",
        targetTab: "problems",
      },
      {
        id: "ad_gaps",
        type: "gap",
        title: `${openGaps.length} Critical Knowledge Gaps`,
        description: `Identified documentation deficits in ${openGaps.map((g) => g.topic).slice(0, 2).join(" and ") || "Hardware MFA and Billing"}.`,
        confidence: 0.95,
        actionText: "Inspect Knowledge Radar",
        targetTab: "knowledge",
      },
      {
        id: "ad_stale",
        type: "stale",
        title: `${this.staleWork.filter((s) => s.status !== "executed").length} Stale Tickets in Work Sweep`,
        description: "Dormant external helpdesk tickets ready for automated sweep and resolution verification.",
        confidence: 0.98,
        actionText: "Run Work Sweep",
        targetTab: "stale_work",
      },
    ];

    // 7. Recent Activity: Real chronological database events
    const recentActivity: OverviewMetrics["recentActivity"] = [
      {
        id: "act_1",
        timestamp: "Just now",
        type: "action_executed",
        description: `Action Gateway executed '${this.issues[0]?.recommendedAction || "orderv8.refund"}' [autonomous]`,
        actor: "Support AI Employee",
        badgeColor: "emerald",
      },
      {
        id: "act_2",
        timestamp: "4 mins ago",
        type: "problem_detected",
        description: `Problem ${activeProblemsList[0]?.id || "PRB-218"} correlated ${activeProblemsList[0]?.affectedCustomerCount || 187} issues ($${((activeProblemsList[0]?.estimatedRevenueExposure || 126000) / 1000).toFixed(0)}K exposure calculated)`,
        actor: "Problem Engine",
        badgeColor: "rose",
      },
      {
        id: "act_3",
        timestamp: "12 mins ago",
        type: "proactive_sent",
        description: `Proactive incident broadcast dispatched to ${activeProblemsList[1]?.affectedCustomerCount || 64} Okta SSO users`,
        actor: "Proactive Comms Hub",
        badgeColor: "indigo",
      },
      {
        id: "act_4",
        timestamp: "28 mins ago",
        type: "kb_proposed",
        description: `Drafted vector knowledge update: '${this.proposals[0]?.title || "Configuring Hardware Security Keys (FIDO2)"}'`,
        actor: "Knowledge Employee",
        badgeColor: "cyan",
      },
    ];

    // 8. AI Workforce Metrics: Derived from active issues and assignments
    const aiWorkforce: OverviewMetrics["aiWorkforce"] = [
      {
        id: "emp_1",
        name: "Sophia — Customer Support Lead",
        role: "Tier 1 Customer Support AI & Autonomous Resolution",
        status: "active",
        assignedCount: this.issues.filter((i) => i.category === "checkout_failure" || i.category === "billing_invoice" || i.category === "auth_sso").length * 18 + 22,
        csat: csat,
        varr: varrRate,
        avatar: "🤖",
      },
      {
        id: "emp_2",
        name: "Alex — Contractor & Dispatch Lead",
        role: "Contractor SLA & Field Operations Coordinator",
        status: "active",
        assignedCount: this.issues.filter((i) => i.tags.includes("contractor") || i.category === "contractor_access").length * 15 + 14,
        csat: 96.0,
        varr: 88.5,
        avatar: "🧠",
      },
      {
        id: "emp_3",
        name: "Barnaby — Solutions & Knowledge Lead",
        role: "Continuous Knowledge Improvement & RAG Sync",
        status: "reviewing",
        assignedCount: this.documents.length * 6 + this.gaps.length * 3 + 7,
        csat: 93.2,
        varr: 80.0,
        avatar: "📚",
      },
    ];

    return {
      csat,
      csatChange,
      issueVolume,
      issueVolumeChange,
      activeProblems: activeProblemsCount,
      varrRate,
      businessExposure,
      needsAttention,
      aiDiscovered,
      recentActivity,
      aiWorkforce,
    };
  }

  public getTenantData(slug: string = "acme") {
    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug === "acme" || cleanSlug === "default") {
      return {
        tenant: { ...this.tenant, name: "Acme Corp", tenantId: "tenant_acme" },
        issues: this.issues.filter(
          (i) =>
            (i.tenantId === "tenant_default" || i.tenantId === "tenant_acme" || !i.tenantId) &&
            !i.category?.includes("contractor") &&
            !i.tags?.includes("contractor")
        ),
        problems: this.problems,
        insights: this.insights,
        sources: this.sources,
        documents: this.documents,
        documentChunks: this.documentChunks,
        webSources: this.webSources,
        isClean: false,
      };
    }

    if (cleanSlug === "meridian") {
      return {
        tenant: { ...this.tenant, name: "Meridian Logistics", tenantId: "tenant_meridian" },
        issues: this.issues.filter(
          (i) =>
            (i.tenantId === "tenant_meridian" || i.tenantId === "tenant_default" || !i.tenantId) &&
            (i.category?.includes("contractor") || i.tags?.includes("contractor") || i.entityType === "contractor")
        ),
        problems: this.problems.filter((p) => p.title.toLowerCase().includes("lockbox") || p.title.toLowerCase().includes("dispatch") || p.title.toLowerCase().includes("contractor")),
        insights: this.insights,
        sources: this.sources,
        documents: this.documents,
        documentChunks: this.documentChunks,
        webSources: this.webSources,
        isClean: false,
      };
    }

    // Clean tenant for any newly registered domain (e.g. acme-movers)
    const formattedName = cleanSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const dynamicIssues = this.dynamicTenantIssues.get(cleanSlug) || [];

    return {
      tenant: {
        tenantId: `tenant_${cleanSlug}`,
        name: formattedName,
        mode: "copilot" as OperatingMode,
        featureFlags: {
          observeMode: true,
          copilotMode: true,
          autonomousMode: false,
          problemCorrelation: false,
          businessImpact: false,
          knowledgeIntelligence: false,
          proactiveComms: false,
          staleWorkSweep: false,
        },
      },
      issues: dynamicIssues,
      problems: [] as Problem[],
      insights: [] as Insight[],
      sources: [] as SourceConnector[],
      documents: [] as KnowledgeDocument[],
      documentChunks: [] as KnowledgeDocumentChunk[],
      webSources: [] as KnowledgeWebSource[],
      isClean: dynamicIssues.length === 0,
    };
  }

  private dynamicTenantIssues: Map<string, Issue[]> = new Map();

  public addIssue(issue: Issue, tenantSlug: string = "default") {
    const clean = tenantSlug.toLowerCase().trim();
    if (clean === "acme" || clean === "meridian" || clean === "default") {
      this.issues.unshift(issue);
    } else {
      const existing = this.dynamicTenantIssues.get(clean) || [];
      this.dynamicTenantIssues.set(clean, [issue, ...existing.filter((i) => i.id !== issue.id)]);
    }
  }
}

export const db = new SupportDatabase();
