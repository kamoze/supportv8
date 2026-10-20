import { createHash } from "node:crypto";

export type CloudEventV1<T> = Readonly<{
  specversion: "1.0";
  id: string;
  source: string;
  type: string;
  time: string;
  datacontenttype: "application/json";
  data: T;
}>;

export type WorkScope = Readonly<{
  tenantId: string;
  accountId: string;
}>;

export type WorkIntakeV1 = Readonly<{
  schema: "servicev8.work-intake.v1";
  operation: "upsert" | "cancel" | "link";
  source: Readonly<{
    system: "dominion" | "supportv8";
    recordId: string;
    recordUri: string;
    revision: number;
    occurredAt: string;
  }>;
  work: Readonly<{
    projectRef?: string;
    workKind:
      | "remediation"
      | "investigation"
      | "support_escalation"
      | "defect"
      | "change"
      | "task";
    title: string;
    problemStatement: string;
    desiredOutcome: string;
    acceptanceCriteria: readonly string[];
    constraints: readonly string[];
    nonGoals: readonly string[];
    requiredDeliverables: readonly string[];
    verificationMethod: string;
    priority: "low" | "medium" | "high" | "urgent";
    severity: "none" | "minor" | "major" | "critical";
    customerImpact?: string;
    accountableOwner?: string;
    owningTeam?: string;
    dueDate?: string;
    labels: readonly string[];
  }>;
  relationships: ReadonlyArray<{
    kind:
      | "caused_by"
      | "remediates"
      | "triggered_by"
      | "requested_by"
      | "related_to";
    targetSystem: string;
    targetId: string;
    targetUri?: string;
  }>;
  correlationId: string;
  causationId?: string;
}>;

export type WorkIntakeReceipt = Readonly<{
  receiptId: string;
  workId: string | null;
  state: "created" | "updated" | "duplicate" | "queued" | "canceled";
  sourceRevision: number;
  taskUri?: string;
}>;

export type WorkOutcomeV1 = Readonly<{
  schema: "servicev8.work-outcome.v1";
  eventId: string;
  workId: string;
  projectId: string;
  acceptedSpecVersion: number;
  acceptedBy: string;
  acceptedAt: string;
  outcomeSummary: string;
  sourceReferences: ReadonlyArray<{
    system: string;
    recordId: string;
    uri?: string;
  }>;
  execution: Readonly<{
    dispatchId: string;
    runId: string;
    state: "succeeded";
  }>;
  verification: ReadonlyArray<{
    system: string;
    receiptId: string;
    result: "passed";
    evidenceUris: readonly string[];
  }>;
  artifacts: ReadonlyArray<{
    artifactId: string;
    uri: string;
    sha256: string;
  }>;
  correlationId: string;
}>;

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function sha256Hex(value: unknown): string {
  const content = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(content).digest("hex");
}

function fail(message: string): never {
  throw new Error(`invalid_work_contract: ${message}`);
}

function assertObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`expected object in ${context}`);
  }
  return value as Record<string, unknown>;
}

function assertString(
  value: unknown,
  context: string,
  minLen = 1,
  maxLen = 10000
): string {
  if (
    typeof value !== "string" ||
    value.length < minLen ||
    value.length > maxLen
  ) {
    fail(`expected string between ${minLen} and ${maxLen} chars in ${context}`);
  }
  return value;
}

function assertInteger(value: unknown, context: string, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    fail(`expected integer >= ${min} in ${context}`);
  }
  return value;
}

function assertArray(
  value: unknown,
  context: string,
  minLen = 0,
  maxLen = 100
): unknown[] {
  if (!Array.isArray(value) || value.length < minLen || value.length > maxLen) {
    fail(`expected array between ${minLen} and ${maxLen} items in ${context}`);
  }
  return value;
}

export function parseCloudEvent<T>(
  value: unknown,
  expectedType: string,
  parseData: (dataVal: unknown) => T
): CloudEventV1<T> {
  const obj = assertObject(value, "CloudEvent");
  if (obj["specversion"] !== "1.0") {
    fail(`expected specversion '1.0', got '${String(obj["specversion"])}'`);
  }
  const id = assertString(obj["id"], "CloudEvent.id", 1, 256);
  const source = assertString(obj["source"], "CloudEvent.source", 1, 1024);
  const type = assertString(obj["type"], "CloudEvent.type", 1, 256);
  if (type !== expectedType) {
    fail(`expected CloudEvent type '${expectedType}', got '${type}'`);
  }
  const time = assertString(obj["time"], "CloudEvent.time", 1, 128);
  if (obj["datacontenttype"] !== "application/json") {
    fail(
      `expected datacontenttype 'application/json', got '${String(
        obj["datacontenttype"]
      )}'`
    );
  }
  const data = parseData(obj["data"]);
  return {
    specversion: "1.0",
    id,
    source,
    type,
    time,
    datacontenttype: "application/json",
    data,
  };
}

export function parseWorkOutcomeEvent(value: unknown): CloudEventV1<WorkOutcomeV1> {
  return parseCloudEvent(value, "servicev8.work-outcome.v1", (dataVal) => {
    const obj = assertObject(dataVal, "WorkOutcomeV1");
    if (obj["schema"] !== "servicev8.work-outcome.v1") {
      fail(`expected schema 'servicev8.work-outcome.v1', got '${String(obj["schema"])}'`);
    }
    const eventId = assertString(obj["eventId"], "WorkOutcomeV1.eventId", 1, 256);
    const workId = assertString(obj["workId"], "WorkOutcomeV1.workId", 1, 256);
    const projectId = assertString(obj["projectId"], "WorkOutcomeV1.projectId", 1, 256);
    const acceptedSpecVersion = assertInteger(
      obj["acceptedSpecVersion"],
      "WorkOutcomeV1.acceptedSpecVersion",
      1
    );
    const acceptedBy = assertString(obj["acceptedBy"], "WorkOutcomeV1.acceptedBy", 1, 256);
    const acceptedAt = assertString(obj["acceptedAt"], "WorkOutcomeV1.acceptedAt", 1, 128);
    const outcomeSummary = assertString(
      obj["outcomeSummary"],
      "WorkOutcomeV1.outcomeSummary",
      1,
      10000
    );

    const rawRefs = assertArray(obj["sourceReferences"], "WorkOutcomeV1.sourceReferences", 0, 100);
    const sourceReferences = rawRefs.map((refVal, idx) => {
      const refObj = assertObject(refVal, `WorkOutcomeV1.sourceReferences[${idx}]`);
      return {
        system: assertString(refObj["system"], `WorkOutcomeV1.sourceReferences[${idx}].system`, 1, 256),
        recordId: assertString(
          refObj["recordId"],
          `WorkOutcomeV1.sourceReferences[${idx}].recordId`,
          1,
          256
        ),
        ...(typeof refObj["uri"] === "string" ? { uri: refObj["uri"] } : {}),
      };
    });

    const execObj = assertObject(obj["execution"], "WorkOutcomeV1.execution");
    if (execObj["state"] !== "succeeded") {
      fail(`expected execution state 'succeeded', got '${String(execObj["state"])}'`);
    }
    const execution = {
      dispatchId: assertString(execObj["dispatchId"], "WorkOutcomeV1.execution.dispatchId", 1, 256),
      runId: assertString(execObj["runId"], "WorkOutcomeV1.execution.runId", 1, 256),
      state: "succeeded" as const,
    };

    const rawVerif = assertArray(obj["verification"], "WorkOutcomeV1.verification", 0, 100);
    const verification = rawVerif.map((vVal, idx) => {
      const vObj = assertObject(vVal, `WorkOutcomeV1.verification[${idx}]`);
      if (vObj["result"] !== "passed") {
        fail(`expected verification result 'passed', got '${String(vObj["result"])}'`);
      }
      const rawUris = assertArray(
        vObj["evidenceUris"],
        `WorkOutcomeV1.verification[${idx}].evidenceUris`,
        0,
        100
      );
      const evidenceUris = rawUris.map((u, uIdx) =>
        assertString(u, `WorkOutcomeV1.verification[${idx}].evidenceUris[${uIdx}]`, 1, 2048)
      );
      return {
        system: assertString(vObj["system"], `WorkOutcomeV1.verification[${idx}].system`, 1, 256),
        receiptId: assertString(
          vObj["receiptId"],
          `WorkOutcomeV1.verification[${idx}].receiptId`,
          1,
          256
        ),
        result: "passed" as const,
        evidenceUris,
      };
    });

    const rawArtifacts = assertArray(obj["artifacts"], "WorkOutcomeV1.artifacts", 0, 100);
    const artifacts = rawArtifacts.map((artVal, idx) => {
      const artObj = assertObject(artVal, `WorkOutcomeV1.artifacts[${idx}]`);
      const sha256 = assertString(artObj["sha256"], `WorkOutcomeV1.artifacts[${idx}].sha256`, 64, 64);
      if (!/^[0-9a-fA-F]{64}$/.test(sha256)) {
        fail(`expected valid sha256 hex string in WorkOutcomeV1.artifacts[${idx}].sha256`);
      }
      return {
        artifactId: assertString(
          artObj["artifactId"],
          `WorkOutcomeV1.artifacts[${idx}].artifactId`,
          1,
          256
        ),
        uri: assertString(artObj["uri"], `WorkOutcomeV1.artifacts[${idx}].uri`, 1, 2048),
        sha256,
      };
    });

    const correlationId = assertString(
      obj["correlationId"],
      "WorkOutcomeV1.correlationId",
      1,
      256
    );

    return {
      schema: "servicev8.work-outcome.v1" as const,
      eventId,
      workId,
      projectId,
      acceptedSpecVersion,
      acceptedBy,
      acceptedAt,
      outcomeSummary,
      sourceReferences,
      execution,
      verification,
      artifacts,
      correlationId,
    };
  });
}

export function parseWorkIntakeEvent(value: unknown): CloudEventV1<WorkIntakeV1> {
  return parseCloudEvent(value, "servicev8.work-intake.v1", (dataVal) => {
    const obj = assertObject(dataVal, "WorkIntakeV1");
    if (obj["schema"] !== "servicev8.work-intake.v1") {
      fail(`expected schema 'servicev8.work-intake.v1', got '${String(obj["schema"])}'`);
    }
    const operation = assertString(obj["operation"], "WorkIntakeV1.operation") as
      | "upsert"
      | "cancel"
      | "link";
    if (!["upsert", "cancel", "link"].includes(operation)) {
      fail(`invalid operation '${operation}' in WorkIntakeV1`);
    }

    const srcObj = assertObject(obj["source"], "WorkIntakeV1.source");
    const source = {
      system: assertString(srcObj["system"], "WorkIntakeV1.source.system") as
        | "dominion"
        | "supportv8",
      recordId: assertString(srcObj["recordId"], "WorkIntakeV1.source.recordId"),
      recordUri: assertString(srcObj["recordUri"], "WorkIntakeV1.source.recordUri"),
      revision: assertInteger(srcObj["revision"], "WorkIntakeV1.source.revision", 0),
      occurredAt: assertString(srcObj["occurredAt"], "WorkIntakeV1.source.occurredAt"),
    };

    const workObj = assertObject(obj["work"], "WorkIntakeV1.work");
    const work = {
      ...(typeof workObj["projectRef"] === "string"
        ? { projectRef: workObj["projectRef"] }
        : {}),
      workKind: assertString(workObj["workKind"], "WorkIntakeV1.work.workKind") as any,
      title: assertString(workObj["title"], "WorkIntakeV1.work.title"),
      problemStatement: assertString(
        workObj["problemStatement"],
        "WorkIntakeV1.work.problemStatement"
      ),
      desiredOutcome: assertString(
        workObj["desiredOutcome"],
        "WorkIntakeV1.work.desiredOutcome"
      ),
      acceptanceCriteria: (workObj["acceptanceCriteria"] as string[]) ?? [],
      constraints: (workObj["constraints"] as string[]) ?? [],
      nonGoals: (workObj["nonGoals"] as string[]) ?? [],
      requiredDeliverables: (workObj["requiredDeliverables"] as string[]) ?? [],
      verificationMethod: assertString(
        workObj["verificationMethod"],
        "WorkIntakeV1.work.verificationMethod"
      ),
      priority: assertString(workObj["priority"], "WorkIntakeV1.work.priority") as any,
      severity: assertString(workObj["severity"], "WorkIntakeV1.work.severity") as any,
      ...(typeof workObj["customerImpact"] === "string"
        ? { customerImpact: workObj["customerImpact"] }
        : {}),
      labels: (workObj["labels"] as string[]) ?? [],
    };

    const relationships = ((obj["relationships"] as any[]) ?? []).map((rel) => ({
      kind: rel.kind,
      targetSystem: rel.targetSystem,
      targetId: rel.targetId,
      ...(typeof rel.targetUri === "string" ? { targetUri: rel.targetUri } : {}),
    }));

    const correlationId = assertString(
      obj["correlationId"],
      "WorkIntakeV1.correlationId"
    );

    return {
      schema: "servicev8.work-intake.v1" as const,
      operation,
      source,
      work,
      relationships,
      correlationId,
      ...(typeof obj["causationId"] === "string"
        ? { causationId: obj["causationId"] }
        : {}),
    };
  });
}
