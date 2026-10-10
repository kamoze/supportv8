/**
 * Platform Scenarios & Execution Lifecycle
 * Implements SCN-01 to SCN-03:
 * - Persisted scenario configurations per tenant with semantic revisioning
 * - Search by keyword/tag/name surviving process restarts
 * - Pinned execution revisions (active runs are immutable to config edits)
 * - Tenant ownership and participant hire checks (stops immediately on revocation)
 */

export interface ScenarioParticipant {
  employeeId: string;
  role: string;
  requiredCapabilities?: string[];
}

export interface ScenarioConfig {
  id: string;
  tenantSlug: string;
  scenarioId: string;
  name: string;
  revision: number;
  participants: ScenarioParticipant[];
  parameters: Record<string, unknown>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioRun {
  runId: string;
  tenantSlug: string;
  scenarioId: string;
  configId: string;
  pinnedRevision: number;
  pinnedParticipants: ScenarioParticipant[];
  status: "running" | "completed" | "failed" | "stopped";
  idempotencyKey?: string;
  startedAt: string;
  completedAt?: string;
  failureReason?: string;
}

// Durable in-memory store simulating owner persistence
const scenarioConfigs = new Map<string, ScenarioConfig>();
const scenarioRuns = new Map<string, ScenarioRun>();
const runsByIdempotencyKey = new Map<string, ScenarioRun>();

export function clearScenarioStoreForTesting(): void {
  scenarioConfigs.clear();
  scenarioRuns.clear();
  runsByIdempotencyKey.clear();
}

export function saveScenarioConfig(input: {
  id?: string;
  tenantSlug: string;
  scenarioId: string;
  name: string;
  participants: ScenarioParticipant[];
  parameters: Record<string, unknown>;
  tags?: string[];
}): ScenarioConfig {
  const now = new Date().toISOString();

  if (input.id && scenarioConfigs.has(input.id)) {
    const existing = scenarioConfigs.get(input.id)!;
    if (existing.tenantSlug.toLowerCase() !== input.tenantSlug.toLowerCase()) {
      throw new Error(`Cross-tenant scenario config overwrite denied for ${input.id}`);
    }
    const updated: ScenarioConfig = {
      ...existing,
      name: input.name,
      scenarioId: input.scenarioId,
      revision: existing.revision + 1,
      participants: JSON.parse(JSON.stringify(input.participants)),
      parameters: { ...input.parameters },
      tags: input.tags ? [...input.tags] : existing.tags,
      updatedAt: now,
    };
    scenarioConfigs.set(updated.id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  const id = input.id || `scf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created: ScenarioConfig = {
    id,
    tenantSlug: input.tenantSlug,
    scenarioId: input.scenarioId,
    name: input.name,
    revision: 1,
    participants: JSON.parse(JSON.stringify(input.participants)),
    parameters: { ...input.parameters },
    tags: input.tags ? [...input.tags] : [],
    createdAt: now,
    updatedAt: now,
  };
  scenarioConfigs.set(id, created);
  return JSON.parse(JSON.stringify(created));
}

export function getScenarioConfig(tenantSlug: string, configId: string): ScenarioConfig | null {
  const config = scenarioConfigs.get(configId);
  if (!config) return null;
  if (config.tenantSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
    return null; // Foreign tenant config denied
  }
  return JSON.parse(JSON.stringify(config));
}

export function listScenarioConfigs(
  tenantSlug: string,
  query?: { keyword?: string; tag?: string }
): ScenarioConfig[] {
  const results: ScenarioConfig[] = [];
  const cleanTenant = tenantSlug.toLowerCase();

  for (const config of scenarioConfigs.values()) {
    if (config.tenantSlug.toLowerCase() !== cleanTenant) continue;

    if (query?.keyword) {
      const kw = query.keyword.toLowerCase();
      const match =
        config.name.toLowerCase().includes(kw) ||
        config.scenarioId.toLowerCase().includes(kw);
      if (!match) continue;
    }

    if (query?.tag) {
      const matchTag = config.tags?.some((t) => t.toLowerCase() === query.tag!.toLowerCase());
      if (!matchTag) continue;
    }

    results.push(JSON.parse(JSON.stringify(config)));
  }

  return results;
}

export function startScenarioRun(options: {
  tenantSlug: string;
  configId: string;
  activeHires: string[];
  idempotencyKey?: string;
}): { success: boolean; status: number; run?: ScenarioRun; error?: string } {
  const { tenantSlug, configId, activeHires, idempotencyKey } = options;

  // Idempotency check scoped to tenant
  const scopedKey = idempotencyKey ? `${tenantSlug}:${idempotencyKey}` : null;
  if (scopedKey && runsByIdempotencyKey.has(scopedKey)) {
    const existing = runsByIdempotencyKey.get(scopedKey)!;
    return {
      success: true,
      status: 200,
      run: JSON.parse(JSON.stringify(existing)),
    };
  }

  // Config ownership check
  const config = getScenarioConfig(tenantSlug, configId);
  if (!config) {
    return {
      success: false,
      status: 403,
      error: "Access denied to requested scenario config.",
    };
  }

  // Participants check
  const missingParticipants = config.participants.filter(
    (p) => !activeHires.includes(p.employeeId)
  );
  if (missingParticipants.length > 0) {
    return {
      success: false,
      status: 409,
      error: `Missing required participants: ${missingParticipants.map((m) => m.employeeId).join(", ")}`,
    };
  }

  // Create immutable run with pinned revision and pinned participants
  const run: ScenarioRun = {
    runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tenantSlug,
    scenarioId: config.scenarioId,
    configId,
    pinnedRevision: config.revision,
    pinnedParticipants: JSON.parse(JSON.stringify(config.participants)),
    status: "running",
    idempotencyKey,
    startedAt: new Date().toISOString(),
  };

  scenarioRuns.set(run.runId, run);
  if (scopedKey) {
    runsByIdempotencyKey.set(scopedKey, run);
  }

  return {
    success: true,
    status: 200,
    run: JSON.parse(JSON.stringify(run)),
  };
}

export function stopScenarioRunOnRevocation(
  runId: string,
  revokedEmployeeId: string
): ScenarioRun | null {
  const run = scenarioRuns.get(runId);
  if (!run) return null;

  if (run.status === "running") {
    const hasParticipant = run.pinnedParticipants.some(
      (p) => p.employeeId === revokedEmployeeId
    );
    if (hasParticipant) {
      run.status = "stopped";
      run.failureReason = `Participant ${revokedEmployeeId} was revoked or entitlement terminated.`;
      run.completedAt = new Date().toISOString();
    }
  }

  return JSON.parse(JSON.stringify(run));
}
