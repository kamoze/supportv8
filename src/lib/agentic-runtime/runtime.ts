/**
 * THE LOOP.
 *
 *   hire → tune → run → propose → autonomy → execute → outcome + audit
 *
 * Nothing in the audited estate completes this end to end: orderv8 does the
 * first half and cannot mutate; estatev8 designed the mutation half and never
 * wired it. This module is the join, and it is the ONLY place the join
 * happens — a vertical calls `runAgent` and gets the gates for free, or it
 * writes its own runtime and we are back to three competing patterns.
 *
 * ── What this function refuses to let a vertical do ───────────────────────
 *
 *  · trust a caller-supplied hire         — it re-fetches and re-verifies
 *  · make an unmetered model call         — `narrate` is the only model access
 *                                           and it always carries `instanceId`
 *  · make more than one model call        — the second `narrate` returns null
 *  · dispatch an unregistered operation   — registry lookup precedes everything
 *  · dispatch an unvalidated input        — the registry's validator runs first
 *  · self-declare an operation's risk     — risk comes from the registry
 *  · execute past an empty `grants[]`     — `evaluateAutonomy` denies
 *  · run without an autonomy policy       — an omitted one is DENY_ALL, and the
 *                                           threshold is recorded on every
 *                                           decision so it is auditable
 *  · spend against an exhausted budget    — refused before any call
 *  · act without leaving a trail          — every decision emits a record
 *
 * ── One design decision worth stating ────────────────────────────────────
 *
 * The contract says `narrate` returns null both when the model is UNAVAILABLE
 * and when the budget is EXHAUSTED, and that the engine must still return its
 * figures either way. Those two nulls mean different things to the runtime:
 *
 *   unavailable  → degrade. The run stands, proposals are still gated and
 *                  dispatched, the outcome is recorded. "Correct numbers, no
 *                  prose" is the documented degraded mode.
 *   exhausted    → refuse. The whole run becomes `refuse("budget_exhausted")`:
 *                  no dispatch, NO OUTCOME RECORDED. Recording an outcome for
 *                  a hire that could not pay for the work would credit output
 *                  that was never produced, which is a money bug, and it is
 *                  what orderv8's bookkeeper already does (`executed:false`,
 *                  no outcome) on this path.
 *
 * The common case never reaches that branch at all: an exhausted budget is
 * caught from the hire record before the model is called.
 */

import { buildAuditRecord, type AgentActivityRecord, type AuditActorType } from "./audit/record";
import { consoleAuditSink, safeEmit, type AuditSink } from "./audit/sink";
import { evaluateAutonomy, type AutonomyDecision } from "./autonomy/evaluate";
import { DENY_ALL_AUTONOMY, describeAutonomyPolicy, type AutonomyPolicy } from "./autonomy/policy";
import { refuse, type AgentResolution, type Engine, type EngineContext, type OperationProposal, type RefusalReason } from "./engine/contract";
import { extractCreditsUsed, extractNarrative, isBudgetExhausted } from "./gateway/completion";
import type { ForgeGateway, HiredInstance, JsonRecord, OutcomeInput } from "./gateway/forge-gateway";
import type { OperationDispatchResult, OperationGateway } from "./gateway/operation-gateway";
import type { OperationDefinition, OperationRegistry } from "./operations/registry";
import type { TenantRef } from "./tenant/identity";

/** What happened to one proposal, start to finish. */
export type ProposalOutcome = {
  readonly proposal: OperationProposal;
  /** The autonomy verdict, or a synthesised denial for a pre-autonomy gate. */
  readonly decision: AutonomyDecision;
  readonly dispatched: boolean;
  /** Present only when a dispatch was actually attempted. */
  readonly dispatch?: OperationDispatchResult;
};

export type AgentRunResult = {
  /** The engine's resolution, or a refusal the runtime substituted. */
  readonly resolution: AgentResolution;
  /** Set when the run was refused rather than executed. */
  readonly refusal?: RefusalReason;
  readonly proposals: readonly ProposalOutcome[];
  readonly outcomeRecorded: boolean;
  /** Every record emitted, in order. Returned so a caller can re-persist them. */
  readonly audit: readonly AgentActivityRecord[];
  /** Did a model call actually happen? False on every refusal path. */
  readonly modelCalled: boolean;
};

export type OutcomeMapperInput = {
  readonly hire: HiredInstance;
  readonly resolution: AgentResolution;
  readonly proposals: readonly ProposalOutcome[];
  readonly creditsUsed: number;
  readonly period: string;
};

export type AgentRunRequest = {
  readonly tenant: TenantRef;
  /** Vertical id, e.g. "orderv8". Checked against the hire's own vertical. */
  readonly vertical: string;
  /** The hire (`role × vertical × tenant`) doing the work. */
  readonly instanceId: string;
  readonly engine: Engine;
  readonly registry: OperationRegistry;
  /** What was asked for, recorded on every audit record from this run. */
  readonly command: string;

  /** Money and model. `null` (or omitted) means unconfigured → refuse. */
  readonly forge: ForgeGateway | null;
  /** Effects and configuration. `null` (or omitted) means unconfigured → refuse. */
  readonly operations: OperationGateway | null;

  readonly audit?: AuditSink;
  /**
   * Called when the sink throws. A sink failure never aborts a run (see
   * `audit/sink.ts`), but it must never be invisible either.
   */
  readonly onAuditError?: (error: unknown, record: AgentActivityRecord) => void;
  /** Who triggered this. Defaults to `agent` — an autonomous step. */
  readonly actorType?: AuditActorType;
  /**
   * Operation ids a human has standing-approved for THIS hire. Never read
   * from tuning or from the engine: a pre-approval is a human decision, and
   * config a vertical can edit is not one.
   */
  readonly preApproved?: readonly string[];
  /**
   * How much blast radius this hire may land unattended.
   *
   * OMITTING IT IS SAFE AND MEANS "NOTHING AUTO-EXECUTES" — the default is
   * `DENY_ALL_AUTONOMY`, so a caller that forgets gets proposals and approval
   * requests, never dispatches. Resolve a real one with
   * `resolveAutonomyPolicy` (see `autonomy/resolve.ts`); it is deliberately
   * NOT read from `tuning`, because the gate an engine runs under must not be
   * editable by whoever edits the engine's behaviour.
   */
  readonly autonomy?: AutonomyPolicy;
  /** Where to read per-tenant tuning. Omit to run with `{}`. */
  readonly tuning?: { readonly moduleKey: string; readonly scope: string };
  /** Metering feature tag on the model call. */
  readonly feature?: string;
  readonly maxNarrativeTokens?: number;
  /** Hard ceiling on proposals considered in one run. Extras are denied, not ignored. */
  readonly maxProposals?: number;
  /** Override the recorded outcome. Return `null` to record none. */
  readonly outcome?: (input: OutcomeMapperInput) => OutcomeInput | null;
  readonly now?: () => Date;
};

const DEFAULT_FEATURE = "agent_narrative";
const DEFAULT_MAX_NARRATIVE_TOKENS = 400;
const DEFAULT_MAX_PROPOSALS = 50;

export async function runAgent(request: AgentRunRequest): Promise<AgentRunResult> {
  const sink = request.audit ?? consoleAuditSink;
  const actorType: AuditActorType = request.actorType ?? "agent";
  const now = request.now ?? (() => new Date());
  const emitted: AgentActivityRecord[] = [];

  const emit = async (input: {
    status: AgentActivityRecord["status"];
    tool: string;
    title: string;
    detail: string;
    metadata?: Readonly<Record<string, unknown>>;
    affected_entity?: AgentActivityRecord["affected_entity"];
    approval?: AgentActivityRecord["approval"];
    execution?: AgentActivityRecord["execution"];
  }): Promise<void> => {
    const record = buildAuditRecord({
      tenant_id: request.tenant.tenantId,
      vertical_id: request.vertical,
      agent_id: request.instanceId,
      actor_type: actorType,
      tool: input.tool,
      command: request.command,
      status: input.status,
      title: input.title,
      detail: input.detail,
      created_at: now().toISOString(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.affected_entity ? { affected_entity: input.affected_entity } : {}),
      ...(input.approval ? { approval: input.approval } : {}),
      ...(input.execution ? { execution: input.execution } : {}),
    });
    emitted.push(record);
    await safeEmit(sink, record, request.onAuditError);
  };

  const refusalResult = async (
    reason: RefusalReason,
    detail: string,
    status: AgentActivityRecord["status"] = "BLOCKED",
  ): Promise<AgentRunResult> => {
    await emit({
      status,
      tool: "runtime.run",
      title: `Run refused: ${reason}`,
      detail,
      metadata: { refusal: reason, instanceId: request.instanceId },
    });
    return {
      resolution: refuse(reason, detail),
      refusal: reason,
      proposals: [],
      outcomeRecorded: false,
      audit: emitted,
      modelCalled: false,
    };
  };

  // ── 0. Configuration ────────────────────────────────────────────────────
  // Absence must never mean "allow". A missing gateway is not a reason to run
  // the engine anyway and skip the parts that would have stopped it.
  const forge = request.forge;
  const operations = request.operations;
  if (!forge) {
    return refusalResult("not_configured", "Forge gateway is not configured — cannot resolve the hire or meter a model call.");
  }
  if (!operations) {
    return refusalResult("not_configured", "Operation gateway is not configured — no proposal could be dispatched, so the run is refused rather than partially performed.");
  }

  // ── 1. Hire ─────────────────────────────────────────────────────────────
  // Re-fetched and re-verified here, never taken from the caller. This engine
  // is reachable from any trigger (schedule, event, chat), and each of those
  // call sites would otherwise have to remember the check itself — which is
  // the same as it not existing. A foreign hire answers 404 upstream and
  // arrives here as `null`; an unreachable gateway also arrives as `null`, and
  // both must fail closed identically.
  const hire = await forge.getHire(request.tenant.tenantDomain, request.instanceId);
  if (!hire) {
    return refusalResult(
      "hire_not_found",
      "Couldn't resolve this hire — it may have been removed, belong to another tenant, or the gateway is unreachable.",
    );
  }
  if (hire.vertical !== request.vertical) {
    // Our own hire, wrong vertical. A bookkeeper hired into orderv8 must not
    // act inside propv8 just because someone passed the id there.
    return refusalResult(
      "hire_not_found",
      `Hire ${request.instanceId} belongs to vertical "${hire.vertical}", not "${request.vertical}".`,
    );
  }

  // ── 2. Budget, BEFORE any spend ─────────────────────────────────────────
  // A hire whose payload carries no budget is treated as exhausted. That is
  // deliberately strict: an unreadable budget is not evidence of a healthy
  // one, and the cost of being wrong is unbilled model spend.
  if (!hire.budget || hire.budget.exhausted === true) {
    return refusalResult(
      "budget_exhausted",
      hire.budget
        ? "This hire is out of budget for the period — top up to run. No model call was made and no outcome was recorded."
        : "The gateway returned no budget for this hire; treating it as exhausted rather than spending against an unknown allowance.",
    );
  }

  // ── 3. Tuning ───────────────────────────────────────────────────────────
  // A tenant with no tuning row is a normal, unconfigured tenant: run with
  // defaults. Tuning shapes BEHAVIOUR (thresholds, tone); it never grants a
  // scope and never appears in the autonomy decision.
  let tuning: Readonly<Record<string, unknown>> = {};
  if (request.tuning) {
    const payload = await operations.getEffectiveTuning({
      tenant: request.tenant,
      vertical: request.vertical,
      moduleKey: request.tuning.moduleKey,
      scope: request.tuning.scope,
    });
    tuning = unwrapTuning(payload);
  }

  // ── 3b. Autonomy policy ─────────────────────────────────────────────────
  // Resolved by the CALLER (`resolveAutonomyPolicy`) and passed in, never read
  // from `tuning` above — see `autonomy/resolve.ts` for why those must not be
  // the same read. An omitted policy is deny-all, so a caller that forgets gets
  // a propose-only agent rather than an unbounded one.
  const autonomy: AutonomyPolicy = request.autonomy ?? DENY_ALL_AUTONOMY;

  // ── 4. The engine ───────────────────────────────────────────────────────
  let modelCalled = false;
  let budgetExhaustedMidRun = false;
  let creditsUsed = 0;

  const narrate: EngineContext["narrate"] = async (prompt, maxTokens) => {
    if (modelCalled) {
      // ONE metered call per run. A second is not billed differently, it is a
      // different design — deterministic figures narrated once — and silently
      // allowing it would let an engine drift into using the model for work.
      await emit({
        status: "BLOCKED",
        tool: "runtime.narrate",
        title: "Second model call refused",
        detail: "An engine may make exactly one metered model call per run; the additional call returned null.",
      });
      return null;
    }
    modelCalled = true;
    const completion = await forge.complete(request.tenant.tenantDomain, {
      instanceId: request.instanceId, // metering: never omitted
      feature: request.feature ?? DEFAULT_FEATURE,
      messages: [{ role: "user", content: prompt }],
      maxTokens: maxTokens ?? request.maxNarrativeTokens ?? DEFAULT_MAX_NARRATIVE_TOKENS,
    });
    if (!completion) return null; // model unavailable → degrade, do not refuse
    if (isBudgetExhausted(completion)) {
      budgetExhaustedMidRun = true;
      return null;
    }
    creditsUsed = extractCreditsUsed(completion);
    return extractNarrative(completion);
  };

  const context: EngineContext = {
    tenant: request.tenant,
    instanceId: request.instanceId,
    tuning,
    narrate,
  };

  let resolution: AgentResolution;
  try {
    resolution = await request.engine(context);
  } catch (error) {
    // An engine that throws has not produced a resolution, so there is nothing
    // to trust and nothing to dispatch.
    await emit({
      status: "FAILED",
      tool: "runtime.engine",
      title: "Engine threw",
      detail: error instanceof Error ? error.message : String(error),
      metadata: { instanceId: request.instanceId },
    });
    return {
      resolution: refuse("not_configured", "The engine failed to complete."),
      refusal: "not_configured",
      proposals: [],
      outcomeRecorded: false,
      audit: emitted,
      modelCalled,
    };
  }

  if (budgetExhaustedMidRun) {
    // See the header note: exhausted ≠ unavailable. No dispatch, no outcome.
    const result = await refusalResult(
      "budget_exhausted",
      "The gateway reported the hire's budget exhausted during the run — no proposal was dispatched and no outcome was recorded.",
    );
    return { ...result, modelCalled };
  }

  if (!resolution.executed) {
    // The engine refused on its own terms. Record it — a refusal is exactly
    // the kind of thing an audit trail that only logs successes would lose.
    await emit({
      status: "REJECTED",
      tool: "runtime.engine",
      title: "Engine did not execute",
      detail: resolution.recommendation ?? "The engine returned executed:false.",
      metadata: { actionsTaken: resolution.actionsTaken },
    });
    return {
      resolution,
      proposals: [],
      outcomeRecorded: false,
      audit: emitted,
      modelCalled,
    };
  }

  // ── 5. Proposals: registry → validation → autonomy → dispatch ───────────
  const allProposals = resolution.proposals ?? [];
  const maxProposals = request.maxProposals ?? DEFAULT_MAX_PROPOSALS;
  const outcomes: ProposalOutcome[] = [];

  for (const [index, proposal] of allProposals.entries()) {
    if (index >= maxProposals) {
      outcomes.push(
        await denyProposal(
          emit,
          proposal,
          `run exceeded the ${maxProposals}-proposal ceiling; proposal ${index + 1} was not considered`,
        ),
      );
      continue;
    }

    // 5a. Is it a real operation? An unregistered id must never fall through
    // to a permissive default — 25 of estatev8's 27 operation ids have no
    // handler anywhere, and nothing noticed for 75 days.
    let definition: OperationDefinition;
    try {
      definition = request.registry.get(proposal.operationId);
    } catch {
      outcomes.push(
        await denyProposal(
          emit,
          proposal,
          `operation not registered: ${proposal.operationId}`,
        ),
      );
      continue;
    }

    // 5b. Does it belong to the vertical being run? A registry shared across
    // verticals must not let one vertical's agent reach another's operation.
    if (definition.vertical !== request.vertical) {
      outcomes.push(
        await denyProposal(
          emit,
          proposal,
          `operation ${definition.id} belongs to vertical "${definition.vertical}", not "${request.vertical}"`,
        ),
      );
      continue;
    }

    // 5c. Is the input the shape the operation declared? The registry's own
    // validator decides — never the engine, and never "it looked fine".
    const validationError = definition.validate(proposal.input);
    if (validationError) {
      outcomes.push(
        await denyProposal(
          emit,
          proposal,
          `input rejected by ${definition.id} validator: ${validationError}`,
          definition,
        ),
      );
      continue;
    }

    // 5d. May it run unattended?
    //     grants × registry blast radius × the tenant's threshold × pre-approval.
    const decision = evaluateAutonomy({
      grants: hire.grants ?? [],
      risk: definition.risk,
      requiredScope: definition.requiredScope,
      policy: autonomy,
      preApproved: request.preApproved ?? [],
      proposal,
    });

    // The policy in force is recorded on EVERY autonomy record, not only on the
    // ones that executed. "The dial was at medium when this was denied" is the
    // question an incident review asks, and a trail that only carries the
    // threshold on successes cannot answer it.
    const autonomyMetadata = {
      risk: definition.risk,
      policy: describeAutonomyPolicy(autonomy),
      ...(decision.outcome === "execute" ? { basis: decision.basis } : {}),
    };

    if (decision.outcome === "denied") {
      await emit({
        status: "REJECTED",
        tool: definition.id,
        title: `Denied: ${definition.summary}`,
        detail: `${decision.reason}. Reason given by the agent: ${proposal.reason}`,
        metadata: {
          input: proposal.input,
          grants: hire.grants,
          risk: definition.risk,
          autonomy: autonomyMetadata,
        },
        approval: { required: false },
        execution: buildExecution(definition.id, false, proposal.idempotencyKey),
      });
      outcomes.push({ proposal, decision, dispatched: false });
      continue;
    }

    if (decision.outcome === "needs_approval") {
      // An approval REQUEST is an audited event in its own right. The reason
      // the engine gave is carried through verbatim, because an approval UI
      // that cannot say why is one nobody should trust.
      await emit({
        status: "NEEDS_APPROVAL",
        tool: definition.id,
        title: `Approval needed: ${definition.summary}`,
        detail: `${decision.reason}. Reason given by the agent: ${proposal.reason}`,
        metadata: { input: proposal.input, risk: definition.risk, autonomy: autonomyMetadata },
        approval: { required: true, preApproved: false },
        execution: buildExecution(definition.id, false, proposal.idempotencyKey),
      });
      outcomes.push({ proposal, decision, dispatched: false });
      continue;
    }

    // 5e. Approved. Emit BEFORE dispatching: a dispatch whose result we never
    // learn (process death, timeout) must still be visible in the trail.
    //
    // `approval.required` now means "a human decision was needed and a standing
    // one supplied it" — i.e. the operation was ABOVE the tenant's threshold
    // and only the pre-approval list released it. It used to be derived from
    // the risk value alone (`risk !== "safe_execute"`), which is no longer a
    // question the risk value can answer: whether `medium` needs approval is
    // now the tenant's decision, not the platform's.
    await emit({
      status: "APPROVED",
      tool: definition.id,
      title: `Executing: ${definition.summary}`,
      detail: `${decision.reason}. Reason given by the agent: ${proposal.reason}`,
      metadata: { input: proposal.input, risk: definition.risk, autonomy: autonomyMetadata },
      approval: {
        required: decision.basis === "pre_approval",
        preApproved: decision.basis === "pre_approval",
      },
      execution: buildExecution(definition.id, false, proposal.idempotencyKey),
    });

    const dispatch = await operations.dispatch({
      tenant: request.tenant,
      vertical: request.vertical,
      operationId: definition.id,
      input: proposal.input,
      actorId: request.instanceId,
      ...(proposal.idempotencyKey ? { idempotencyKey: proposal.idempotencyKey } : {}),
    });

    await emit({
      status: dispatch.ok ? "COMPLETED" : "FAILED",
      tool: definition.id,
      title: dispatch.ok ? definition.auditEvent : `Failed: ${definition.summary}`,
      detail: dispatch.ok
        ? dispatch.replayed
          ? `${definition.id} was NOT re-applied — the Operation Gateway replayed the stored result for idempotency key ${proposal.idempotencyKey}.`
          : `Dispatched ${definition.id} through the Operation Gateway.`
        : `Operation Gateway rejected ${definition.id} (HTTP ${dispatch.status}): ${dispatch.error}`,
      metadata: dispatch.ok
        ? { output: dispatch.output, replayed: dispatch.replayed }
        : { status: dispatch.status },
      execution: buildExecution(definition.id, dispatch.ok, proposal.idempotencyKey),
    });

    outcomes.push({ proposal, decision, dispatched: dispatch.ok, dispatch });
  }

  // ── 6. Exactly one outcome ──────────────────────────────────────────────
  const period = currentPeriodUTC(now());
  const outcomeInput = (request.outcome ?? defaultOutcome)({
    hire,
    resolution,
    proposals: outcomes,
    creditsUsed,
    period,
  });

  let outcomeRecorded = false;
  if (outcomeInput) {
    const recorded = await forge.recordOutcome(
      request.tenant.tenantDomain,
      request.instanceId,
      outcomeInput,
    );
    outcomeRecorded = recorded !== null;
    if (!outcomeRecorded) {
      await emit({
        status: "FAILED",
        tool: "runtime.outcome",
        title: "Outcome not recorded",
        detail: "The Forge gateway rejected or did not answer the outcome write; the run's work still happened.",
        metadata: { metric: outcomeInput.metric, period: outcomeInput.period },
      });
    }
  }

  await emit({
    status: "COMPLETED",
    tool: "runtime.run",
    title: `Run complete: ${request.command}`,
    detail: resolution.recommendation ?? "Run completed with no narrative.",
    metadata: {
      actionsTaken: resolution.actionsTaken,
      proposals: outcomes.length,
      dispatched: outcomes.filter((entry) => entry.dispatched).length,
      needsApproval: outcomes.filter((entry) => entry.decision.outcome === "needs_approval").length,
      denied: outcomes.filter((entry) => entry.decision.outcome === "denied").length,
      replayed: outcomes.filter((entry) => entry.dispatch?.ok === true && entry.dispatch.replayed)
        .length,
      creditsUsed,
      outcomeRecorded,
      autonomy: describeAutonomyPolicy(autonomy),
    },
  });

  return {
    resolution,
    proposals: outcomes,
    outcomeRecorded,
    audit: emitted,
    modelCalled,
  };
}

/**
 * Deny a proposal at a pre-autonomy gate (unregistered, wrong vertical,
 * invalid input, over the ceiling). These never reach `evaluateAutonomy` —
 * there is nothing to evaluate — so the denial is synthesised in the same
 * `AutonomyDecision` shape a caller already handles.
 */
async function denyProposal(
  emit: (input: {
    status: AgentActivityRecord["status"];
    tool: string;
    title: string;
    detail: string;
    metadata?: Readonly<Record<string, unknown>>;
    execution?: AgentActivityRecord["execution"];
  }) => Promise<void>,
  proposal: OperationProposal,
  reason: string,
  definition?: OperationDefinition,
): Promise<ProposalOutcome> {
  await emit({
    status: "REJECTED",
    tool: proposal.operationId || "unknown",
    title: definition ? `Denied: ${definition.summary}` : `Denied: ${proposal.operationId}`,
    detail: `${reason}. Reason given by the agent: ${proposal.reason}`,
    metadata: { input: proposal.input },
    execution: buildExecution(proposal.operationId, false, proposal.idempotencyKey),
  });
  return {
    proposal,
    decision: { outcome: "denied", reason },
    dispatched: false,
  };
}

function buildExecution(
  operationId: string,
  dispatched: boolean,
  idempotencyKey: string | undefined,
): NonNullable<AgentActivityRecord["execution"]> {
  return idempotencyKey
    ? { dispatched, operationId, idempotencyKey }
    : { dispatched, operationId };
}

/**
 * Default outcome: the share of this run's proposals that actually landed,
 * against the hire's own declared `outcomeKey`. A run with no proposals but a
 * completed engine still scores 1 — reporting is work.
 */
function defaultOutcome(input: OutcomeMapperInput): OutcomeInput {
  const total = input.proposals.length;
  const dispatched = input.proposals.filter((entry) => entry.dispatched).length;
  return {
    period: input.period,
    metric: input.hire.outcomeKey || "runs_completed",
    value: total > 0 ? dispatched / total : 1,
    unit: total > 0 ? "ratio" : "count",
    detail: JSON.stringify({
      proposals: total,
      dispatched,
      needsApproval: input.proposals.filter((entry) => entry.decision.outcome === "needs_approval")
        .length,
      denied: input.proposals.filter((entry) => entry.decision.outcome === "denied").length,
      actionsTaken: input.resolution.actionsTaken,
    }),
    creditsUsed: input.creditsUsed,
  };
}

/**
 * The customization SoR answers either a merged config object or a row that
 * wraps one in `config`. Engines read tuning paths directly, so unwrap when a
 * `config` object is present and otherwise pass the payload through.
 */
function unwrapTuning(payload: JsonRecord | null): Readonly<Record<string, unknown>> {
  if (!payload) return {};
  const config = payload.config;
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return config as Record<string, unknown>;
  }
  return payload;
}

function currentPeriodUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
