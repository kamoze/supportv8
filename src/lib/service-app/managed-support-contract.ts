/** servicev8.managed-support.v1: destination identity is separate from employee authority. */
export type SupportTarget = {
  accountId: string;
  tenantId: string;
  verticalId: "runtime";
  installationId: string;
  workspaceId: string;
};
export type SupportGrant = {
  connectionId: string;
  generation: number;
  employeeId: string;
  employeeInstallationId: string;
  employeeEntitlementId: string;
  principalId: string;
  destinationInstallationId: string;
  workspaceId: string;
};
export type SupportActor = {
  accountId?: string;
  tenantId?: string;
  actorId?: string;
  grant?: SupportGrant;
  correlationId: string;
};
export type SupportOperation =
  | "connection.verify"
  | "connection.readiness"
  | "connection.lifecycle"
  | "support_ticket_lookup";
export const SUPPORT_MANIFEST = {
  schemaVersion: "servicev8.managed-support.v1",
  operations: [
    {
      name: "support_ticket_lookup",
      capability: "ticket.read",
      access: "read",
      approval: "never",
      inputSchema: "support.ticket-reference.v1",
      outputSchema: "support.ticket-status.v1",
    },
  ],
} as const;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("invalid_request");
  return value as Record<string, unknown>;
}
export function exact(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const row = record(value);
  if (
    Object.keys(row).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(row, key))
  )
    throw new TypeError("invalid_request");
  return row;
}
export function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/.test(value)
  )
    throw new TypeError("invalid_request");
  return value;
}
export function parseTarget(value: unknown): SupportTarget {
  const row = exact(value, [
    "accountId",
    "tenantId",
    "verticalId",
    "installationId",
    "workspaceId",
  ]);
  if (
    row.verticalId !== "runtime" ||
    typeof row.workspaceId !== "string" ||
    !/^tenant_[a-z0-9_]{1,56}$/.test(row.workspaceId)
  )
    throw new TypeError("invalid_request");
  return {
    accountId: identifier(row.accountId),
    tenantId: identifier(row.tenantId),
    verticalId: "runtime",
    installationId: identifier(row.installationId),
    workspaceId: row.workspaceId,
  };
}
export function parseGrant(value: unknown): SupportGrant {
  const row = exact(value, [
    "connectionId",
    "generation",
    "employeeId",
    "employeeInstallationId",
    "employeeEntitlementId",
    "principalId",
    "destinationInstallationId",
    "workspaceId",
  ]);
  if (!Number.isSafeInteger(row.generation) || (row.generation as number) < 1)
    throw new TypeError();
  return {
    ...Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => key !== "generation")
        .map(([key, v]) => [key, identifier(v)]),
    ),
    generation: row.generation,
  } as SupportGrant;
}
export function sameTarget(value: unknown, target: SupportTarget): boolean {
  try {
    const row = parseTarget(value);
    return Object.entries(target).every(
      ([key, v]) => row[key as keyof SupportTarget] === v,
    );
  } catch {
    return false;
  }
}
export function ticketRef(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  )
    throw new TypeError("invalid_request");
  return value;
}
export async function boundedJson(
  input: Request | Response,
  max = 8192,
): Promise<unknown> {
  const reader = input.body?.getReader();
  if (!reader) throw new TypeError("invalid_request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new TypeError("payload_too_large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    reader.releaseLock();
  }
}
