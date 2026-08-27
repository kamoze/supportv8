/**
 * supportV8 Declarative Scenarios Registry
 */

import { ScenarioRegistry, parseDeclarativeScenario } from "@servicev8/agentic-runtime";

export const SUPPORT_SCENARIO_TRIAGE = `
id: support-triage
name: Customer Support Triage and Resolution
version: "1.0.0"
role: support_analyst
vertical: supportv8
trigger:
  type: event
  event: interaction.message.received
compute:
  handler: triage_support_interaction
autonomy:
  rule: threshold
  auto_execute_max_risk: low
narration:
  enabled: true
  max_tokens: 300
marketplace:
  summary: Real-time sentiment analysis, intent categorization, and automated ticket tagging
  author: ServiceV8 Support Team
  subscribable: true
`;

export const SUPPORT_SCENARIO_SWEEP = `
id: stale-sweep
name: Stale Work Sweeper Automation
version: "1.0.0"
role: stale_sweeper_intern
vertical: supportv8
trigger:
  type: schedule
  cron: "0 2 * * *"
compute:
  handler: sweep_stale_external_tickets
autonomy:
  rule: threshold
  auto_execute_max_risk: medium
narration:
  enabled: false
marketplace:
  summary: Daily scan of external helpdesks to close dormant customer tickets
  author: ServiceV8 Operations
  subscribable: true
`;

export function buildSupportScenarioRegistry(): ScenarioRegistry {
  const registry = new ScenarioRegistry();
  const parsedTriage = parseDeclarativeScenario(SUPPORT_SCENARIO_TRIAGE);
  const parsedSweep = parseDeclarativeScenario(SUPPORT_SCENARIO_SWEEP);
  registry.register(parsedTriage);
  registry.register(parsedSweep);
  return registry;
}

export const supportScenarioRegistry = buildSupportScenarioRegistry();
