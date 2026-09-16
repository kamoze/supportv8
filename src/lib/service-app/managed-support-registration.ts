import { createHash } from "node:crypto";
import { SUPPORT_MANIFEST } from "./managed-support-contract";
export type ManagedSupportRegistrationJob = {
  installationId: string;
  acquisitionId: string;
  accountId: string;
  registryTenantId: string;
  verticalId: "runtime";
  workspaceId: string;
  state: "pending" | "connected" | "ready" | "conflict";
  attemptCount: number;
  connectionId?: string;
};
type Update = Partial<
  Pick<ManagedSupportRegistrationJob, "state" | "connectionId">
> & { nextAttemptAt?: string; lastErrorCode?: string };
type Dependencies = {
  call: (
    kind: "connect" | "readiness",
    target: Record<string, string>,
    connectionId?: string,
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
  update: (value: Update) => Promise<void> | void;
  connectionId?: (target: Record<string, string>) => string;
  now?: () => number;
  random?: () => number;
};
export function managedSupportRegistrationConnectionId(
  target: Record<string, string>,
): string {
  const bytes = createHash("sha256")
    .update(
      JSON.stringify([
        "managed-support-v1",
        target.accountId,
        target.tenantId,
        target.verticalId,
        target.installationId,
        target.workspaceId,
      ]),
    )
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 128;
  bytes[8] = (bytes[8]! & 63) | 128;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export async function reconcileManagedSupportRegistration(
  job: ManagedSupportRegistrationJob,
  deps: Dependencies,
): Promise<void> {
  const target = {
      accountId: job.accountId,
      tenantId: job.registryTenantId,
      verticalId: job.verticalId,
      installationId: job.installationId,
      workspaceId: job.workspaceId,
    },
    expected = (deps.connectionId ?? managedSupportRegistrationConnectionId)(
      target,
    );
  const retry = async (code: string, state: Update["state"] = "pending") => {
    const base = Math.min(
        900000,
        5000 * 2 ** Math.min(job.attemptCount + 1, 8),
      ),
      delay = Math.max(
        1000,
        Math.floor(base * (0.5 + (deps.random ?? Math.random)())),
      );
    await deps.update({
      state,
      nextAttemptAt: new Date((deps.now ?? Date.now)() + delay).toISOString(),
      lastErrorCode: code,
    });
  };
  const connect = await deps.call("connect", target);
  if (connect.status !== 200) {
    if (connect.status === 409) {
      await deps.update({
        state: "conflict",
        lastErrorCode: "connection_conflict",
      });
      return;
    }
    await retry(
      connect.status === 403 ? "authority_pending" : "connect_unavailable",
    );
    return;
  }
  if (
    connect.body.connectionId !== expected ||
    JSON.stringify(connect.body.manifest) !== JSON.stringify(SUPPORT_MANIFEST)
  ) {
    await deps.update({
      state: "conflict",
      lastErrorCode: "connection_identity_drift",
    });
    return;
  }
  const readiness = await deps.call("readiness", target, expected);
  if (readiness.status !== 200) {
    await deps.update({
      state: "connected",
      connectionId: expected,
      nextAttemptAt: new Date(
        (deps.now ?? Date.now)() +
          Math.max(
            1000,
            Math.floor(
              Math.min(900000, 5000 * 2 ** Math.min(job.attemptCount + 1, 8)) *
                (0.5 + (deps.random ?? Math.random)()),
            ),
          ),
      ).toISOString(),
      lastErrorCode: "readiness_pending",
    });
    return;
  }
  if (
    readiness.body.connectionId !== expected ||
    readiness.body.status !== "connected" ||
    JSON.stringify(readiness.body.manifest) !== JSON.stringify(SUPPORT_MANIFEST)
  ) {
    await deps.update({
      state: "conflict",
      connectionId: expected,
      lastErrorCode: "readiness_identity_drift",
    });
    return;
  }
  await deps.update({
    state: "ready",
    connectionId: expected,
    lastErrorCode: undefined,
  });
}
