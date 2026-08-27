/**
 * Declarative YAML Scenarios subsystem for @servicev8/agentic-runtime.
 */

export {
  InvalidScenarioError,
  VALID_RISKS,
  VALID_THRESHOLDS,
  validateDeclarativeScenario,
  type DeclarativeScenario,
  type ScenarioAutonomyConfig,
  type ScenarioAutonomyRule,
  type ScenarioComputeConfig,
  type ScenarioMarketplaceMetadata,
  type ScenarioNarrationConfig,
  type ScenarioProposalConfig,
  type ScenarioTrigger,
  type ScenarioTriggerType,
} from "./schema";

export {
  parseDeclarativeScenario,
  parseYamlSimple,
} from "./parser";

export {
  ScenarioRegistry,
  type ScenarioFilter,
} from "./registry";

export {
  declarativeScenarioToEngine,
  type ComputeHandler,
} from "./adapter";

export {
  EmployeeNotSubscribedError,
  assertScenarioEnablement,
  isEmployeeSubscribed,
  normalizeRoleKeys,
  verifyScenarioEnablement,
  type ScenarioEnablementCheck,
} from "./enablement";
