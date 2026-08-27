/**
 * `@servicev8/agentic-runtime` — the shared agentic runtime.
 *
 * One import surface on purpose. The audit found four copies of
 * `AgentResolution` in the estate, two of which disagreed about the same
 * field, because each repo redeclared the type locally instead of importing
 * it. A vertical should never have a reason to reach past this barrel.
 */

// The spine.
export {
  refuse,
  type AgentResolution,
  type Engine,
  type EngineContext,
  type OperationProposal,
  type RefusalReason,
} from "./engine/contract";
export { defineTenantRef, InvalidTenantRef, type TenantRef } from "./tenant/identity";
export {
  evaluateAutonomy,
  type AutonomyBasis,
  type AutonomyDecision,
  type AutonomyInput,
} from "./autonomy/evaluate";
// Autonomy is a POLICY OVER blast radius, not a second risk vocabulary.
export {
  AUTONOMY_THRESHOLDS,
  DENY_ALL_AUTONOMY,
  describeAutonomyPolicy,
  isAutonomyThreshold,
  parseAutonomyPolicy,
  rankRisk,
  rankThreshold,
  type AutonomyPolicy,
  type AutonomyThreshold,
} from "./autonomy/policy";
export {
  AUTONOMY_POLICY_SCOPE,
  resolveAutonomyPolicy,
  type AutonomyPolicyRequest,
  type ResolvedAutonomyPolicy,
} from "./autonomy/resolve";
export {
  DuplicateOperation,
  isOperationRisk,
  OPERATION_RISKS,
  OperationRegistry,
  UnknownOperation,
  type InputValidator,
  type OperationDefinition,
  type OperationRisk,
} from "./operations/registry";

// Gateways — two of them, and which one you want matters. See each module doc.
export {
  ForgeGateway,
  forgeGatewayConfigFromEnv,
  type CompletionMessage,
  type CompletionResult,
  type ForgeGatewayConfig,
  type HiredInstance,
  type InstanceBudget,
  type JsonRecord,
  type Outcome,
  type OutcomeInput,
} from "./gateway/forge-gateway";
export {
  OperationGateway,
  operationGatewayConfigFromEnv,
  type DispatchRequest,
  type OperationDispatchResult,
  type OperationGatewayConfig,
} from "./gateway/operation-gateway";
export {
  extractCreditsUsed,
  extractNarrative,
  isBudgetExhausted,
} from "./gateway/completion";

// Audit.
export {
  buildAuditRecord,
  redactMetadata,
  type AffectedEntity,
  type AgentActivityRecord,
  type AuditActorType,
  type AuditStatus,
  type NewAuditRecord,
} from "./audit/record";
export { consoleAuditSink, InMemoryAuditSink, safeEmit, type AuditSink } from "./audit/sink";

// Growth loop — closed-loop lead attribution and outcome conversions.
export {
  emitGrowthOutcome,
  growthConfigFromEnv,
  validateInboundGrowthLead,
  type GrowthLoopConfig,
  type GrowthOutcomeInput,
  type GrowthOutcomeResult,
  type GrowthOutcomeType,
  type InboundGrowthLeadPayload,
  type InboundLeadValidationResult,
} from "./growth/index";

// Declarative YAML Scenarios for marketplace-enabled autonomous work.
export {
  EmployeeNotSubscribedError,
  InvalidScenarioError,
  ScenarioRegistry,
  assertScenarioEnablement,
  declarativeScenarioToEngine,
  isEmployeeSubscribed,
  normalizeRoleKeys,
  parseDeclarativeScenario,
  parseYamlSimple,
  validateDeclarativeScenario,
  verifyScenarioEnablement,
  VALID_RISKS,
  VALID_THRESHOLDS,
  type ComputeHandler,
  type DeclarativeScenario,
  type ScenarioAutonomyConfig,
  type ScenarioAutonomyRule,
  type ScenarioComputeConfig,
  type ScenarioEnablementCheck,
  type ScenarioFilter,
  type ScenarioMarketplaceMetadata,
  type ScenarioNarrationConfig,
  type ScenarioProposalConfig,
  type ScenarioTrigger,
  type ScenarioTriggerType,
} from "./scenarios/index";

// The loop.
export {
  runAgent,
  type AgentRunRequest,
  type AgentRunResult,
  type OutcomeMapperInput,
  type ProposalOutcome,
} from "./runtime";
