/**
 * Schema and contracts for Declarative YAML Scenarios.
 *
 * Scenarios declare autonomous work packages that can be published to marketplaces,
 * enabled per tenant, and executed by AI Employees via @servicev8/agentic-runtime.
 */

import type { OperationRisk } from "../operations/registry";
import type { AutonomyThreshold } from "../autonomy/policy";

export type ScenarioTriggerType = "cron" | "event" | "manual";

export type ScenarioTrigger = {
  type: ScenarioTriggerType;
  /** Cron expression (e.g. "0 4 * * *") when type is "cron" */
  schedule?: string;
  /** Event topic name when type is "event" */
  eventTopic?: string;
};

export type ScenarioMarketplaceMetadata = {
  slug: string;
  verticals: string[];
  tier: "free" | "starter" | "pro" | "enterprise";
  requiredModules: string[];
  tags?: string[];
};

export type ScenarioComputeConfig = {
  type: "sql" | "declarative_filter" | "custom";
  /** Named query or SQL assertion reference */
  queryRef?: string;
  /** Query params or filter constraints */
  parameters?: Record<string, unknown>;
};

export type ScenarioProposalConfig = {
  operation: string;
  risk: OperationRisk;
  requiredScope: string;
  idempotencyPattern: string;
  payloadMapping?: Record<string, string>;
};

export type ScenarioAutonomyRule = {
  conditionField: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  thresholdValue: number | string | boolean;
  actionOnExceed: "escalate_to_human" | "deny";
};

export type ScenarioAutonomyConfig = {
  defaultThreshold: AutonomyThreshold;
  rules?: ScenarioAutonomyRule[];
};

export type ScenarioNarrationConfig = {
  personaRole?: string;
  systemPrompt?: string;
  templateFormat?: "markdown" | "json" | "plain";
};

export type DeclarativeScenario = {
  id: string;
  name: string;
  version: string;
  description: string;
  category: "operations" | "finance" | "inventory" | "support" | "growth" | "property";
  assignedRole: string;
  requiredRole: string;
  marketplace: ScenarioMarketplaceMetadata;
  trigger: ScenarioTrigger;
  compute: ScenarioComputeConfig;
  proposals: ScenarioProposalConfig[];
  autonomy: ScenarioAutonomyConfig;
  narration?: ScenarioNarrationConfig;
};

export class InvalidScenarioError extends Error {
  constructor(public readonly scenarioId: string, message: string) {
    super(`Scenario '${scenarioId}' validation failed: ${message}`);
    this.name = "InvalidScenarioError";
  }
}

export const VALID_RISKS: ReadonlySet<OperationRisk> = new Set([
  "read",
  "low",
  "medium",
  "high",
  "critical",
]);

export const VALID_THRESHOLDS: ReadonlySet<AutonomyThreshold> = new Set([
  "read",
  "low",
  "medium",
  "high",
]);

export function validateDeclarativeScenario(raw: unknown): DeclarativeScenario {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new InvalidScenarioError("unknown", "Scenario definition must be an object");
  }

  const obj = raw as Record<string, unknown>;
  const id = requireString(obj.id, "id", "unknown");
  const name = requireString(obj.name, "name", id);
  const version = requireString(obj.version, "version", id);
  const description = requireString(obj.description, "description", id);
  const category = requireString(obj.category, "category", id) as DeclarativeScenario["category"];
  const assignedRole = requireString(obj.assigned_role ?? obj.assignedRole, "assigned_role", id);
  const requiredRole = (
    typeof (obj.required_role ?? obj.requiredRole) === "string"
      ? String(obj.required_role ?? obj.requiredRole)
      : assignedRole
  ).trim();

  // Marketplace metadata
  const mRaw = (obj.marketplace ?? {}) as Record<string, unknown>;
  const reqModules = mRaw.required_modules ?? mRaw.requiredModules;
  const tagsRaw = mRaw.tags;
  const marketplace: ScenarioMarketplaceMetadata = {
    slug: requireString(mRaw.slug ?? id, "marketplace.slug", id),
    verticals: Array.isArray(mRaw.verticals) ? mRaw.verticals.map(String) : [],
    tier: (typeof mRaw.tier === "string" ? mRaw.tier : "free") as ScenarioMarketplaceMetadata["tier"],
    requiredModules: Array.isArray(reqModules) ? reqModules.map(String) : [],
    ...(Array.isArray(tagsRaw) ? { tags: tagsRaw.map(String) } : {}),
  };

  if (marketplace.verticals.length === 0) {
    throw new InvalidScenarioError(id, "marketplace.verticals must declare at least one target vertical");
  }

  // Trigger
  const tRaw = (obj.trigger ?? {}) as Record<string, unknown>;
  const triggerType = requireString(tRaw.type, "trigger.type", id) as ScenarioTriggerType;
  const triggerSchedule = typeof tRaw.schedule === "string" ? tRaw.schedule : undefined;
  const triggerTopic = typeof (tRaw.event_topic ?? tRaw.eventTopic) === "string"
    ? String(tRaw.event_topic ?? tRaw.eventTopic)
    : undefined;

  const trigger: ScenarioTrigger = {
    type: triggerType,
    ...(triggerSchedule ? { schedule: triggerSchedule } : {}),
    ...(triggerTopic ? { eventTopic: triggerTopic } : {}),
  };

  if (trigger.type === "cron" && !trigger.schedule) {
    throw new InvalidScenarioError(id, "Cron trigger must declare a 'schedule' expression");
  }

  // Compute
  const cRaw = (obj.compute ?? {}) as Record<string, unknown>;
  const qRef = typeof (cRaw.query_ref ?? cRaw.queryRef) === "string" ? String(cRaw.query_ref ?? cRaw.queryRef) : undefined;
  const compute: ScenarioComputeConfig = {
    type: (typeof cRaw.type === "string" ? cRaw.type : "sql") as ScenarioComputeConfig["type"],
    ...(qRef ? { queryRef: qRef } : {}),
    parameters: isRecord(cRaw.parameters) ? cRaw.parameters : {},
  };

  // Proposals
  const pList = Array.isArray(obj.proposals) ? obj.proposals : [];
  if (pList.length === 0) {
    throw new InvalidScenarioError(id, "Scenario must declare at least one proposal");
  }

  const proposals: ScenarioProposalConfig[] = pList.map((p, idx) => {
    if (!isRecord(p)) throw new InvalidScenarioError(id, `Proposal[${idx}] must be an object`);
    const operation = requireString(p.operation, `proposals[${idx}].operation`, id);
    const risk = requireString(p.risk, `proposals[${idx}].risk`, id) as OperationRisk;
    if (!VALID_RISKS.has(risk)) {
      throw new InvalidScenarioError(id, `Invalid operation risk '${risk}' in proposal[${idx}]`);
    }
    const requiredScope = requireString(p.required_scope ?? p.requiredScope, `proposals[${idx}].required_scope`, id);
    const idempotencyPattern = requireString(
      p.idempotency_pattern ?? p.idempotencyPattern,
      `proposals[${idx}].idempotency_pattern`,
      id,
    );
    const rawPayloadMap = p.payload_mapping ?? p.payloadMapping;
    const payloadMap: Record<string, string> | undefined = isRecord(rawPayloadMap)
      ? Object.fromEntries(Object.entries(rawPayloadMap).map(([k, v]) => [k, String(v)]))
      : undefined;

    return {
      operation,
      risk,
      requiredScope,
      idempotencyPattern,
      ...(payloadMap ? { payloadMapping: payloadMap } : {}),
    };
  });

  // Autonomy
  const aRaw = (obj.autonomy ?? {}) as Record<string, unknown>;
  const defaultThreshold = (
    typeof (aRaw.default_threshold ?? aRaw.defaultThreshold) === "string"
      ? (aRaw.default_threshold ?? aRaw.defaultThreshold)
      : "medium"
  ) as AutonomyThreshold;

  if (!VALID_THRESHOLDS.has(defaultThreshold)) {
    throw new InvalidScenarioError(id, `Invalid default_threshold '${defaultThreshold}'`);
  }

  const autonomy: ScenarioAutonomyConfig = {
    defaultThreshold,
    rules: Array.isArray(aRaw.rules)
      ? (aRaw.rules as Record<string, unknown>[]).map((r) => {
          const rawVal = r.threshold_value ?? r.thresholdValue;
          const thresholdValue: string | number | boolean =
            typeof rawVal === "number" || typeof rawVal === "string" || typeof rawVal === "boolean"
              ? rawVal
              : 0;
          return {
            conditionField: String(r.condition_field ?? r.conditionField ?? ""),
            operator: (r.operator ?? "gt") as ScenarioAutonomyRule["operator"],
            thresholdValue,
            actionOnExceed: (r.action_on_exceed ?? r.actionOnExceed ?? "escalate_to_human") as ScenarioAutonomyRule["actionOnExceed"],
          };
        })
      : [],
  };

  // Narration (optional)
  const nRaw = isRecord(obj.narration) ? obj.narration : undefined;
  const pRole = typeof (nRaw?.persona_role ?? nRaw?.personaRole) === "string"
    ? String(nRaw?.persona_role ?? nRaw?.personaRole)
    : undefined;
  const sPrompt = typeof (nRaw?.system_prompt ?? nRaw?.systemPrompt) === "string"
    ? String(nRaw?.system_prompt ?? nRaw?.systemPrompt)
    : undefined;
  const rawFormat = nRaw?.template_format ?? nRaw?.templateFormat;
  const templateFormat: "markdown" | "json" | "plain" =
    rawFormat === "json" || rawFormat === "plain" ? rawFormat : "markdown";

  const narration: ScenarioNarrationConfig | undefined = nRaw
    ? {
        ...(pRole ? { personaRole: pRole } : {}),
        ...(sPrompt ? { systemPrompt: sPrompt } : {}),
        templateFormat,
      }
    : undefined;

  return {
    id,
    name,
    version,
    description,
    category,
    assignedRole,
    requiredRole,
    marketplace,
    trigger,
    compute,
    proposals,
    autonomy,
    ...(narration ? { narration } : {}),
  };
}

function requireString(val: unknown, field: string, scenarioId: string): string {
  if (typeof val !== "string" || !val.trim()) {
    throw new InvalidScenarioError(scenarioId, `Field '${field}' is required and must be a non-empty string`);
  }
  return val.trim();
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}
