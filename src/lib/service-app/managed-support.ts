import {
  type SourceMode,
  type SupportSourceProof,
} from "./managed-support-source";
import {
  SUPPORT_MANIFEST,
  boundedJson,
  exact,
  parseTarget,
  ticketRef,
  type SupportTarget,
  type SupportOperation,
} from "./managed-support-contract";
import type { ManagedSupportAuthenticator } from "./managed-support-auth";
export type TicketStatus = {
  ticketRef: string;
  status: string;
  priority: string;
};
export type ManagedSupportDependencies = {
  authenticate?: ManagedSupportAuthenticator;
  verifySource?: (
    mode: SourceMode,
    target: SupportTarget,
    source: unknown,
    reference?: string,
  ) => Promise<SupportSourceProof | null>;
  lifecycle?: (target: SupportTarget) => Promise<Record<string, unknown>>;
  verify: (
    target: SupportTarget,
    operation: SupportOperation,
  ) => Promise<boolean>;
  lookup: (
    target: SupportTarget,
    reference: string,
  ) => Promise<TicketStatus | null>;
};
export async function handleManagedSupport(
  request: Request,
  deps: ManagedSupportDependencies,
): Promise<Response> {
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "cache-control": "no-store" } });
  if (request.method !== "POST")
    return reply(405, { error: "method_not_allowed" });
  if (!deps.authenticate) return reply(503, { error: "support_unavailable" });
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    return reply(415, { error: "invalid_content_type" });
  try {
    const raw = await boundedJson(request),
      body = raw as Record<string, unknown>;
    const operation = body?.operation as SupportOperation;
    if (
      ![
        "connection.lifecycle",
        "connection.verify",
        "connection.readiness",
        "support_ticket_lookup",
        "support_output_access",
      ].includes(operation)
    )
      throw new TypeError();
    exact(
      body,
      operation === "support_ticket_lookup"
        ? ["target", "operation", "source", "parameters"]
        : operation === "support_output_access"
          ? ["target", "operation", "source"]
          : ["target", "operation"],
    );
    const target = parseTarget(body.target);
    const actor = await deps.authenticate(request, operation);
    if (!actor) return reply(401, { error: "workload_not_authorized" });
    if (
      (actor.accountId !== undefined && actor.accountId !== target.accountId) ||
      (actor.tenantId !== undefined && actor.tenantId !== target.tenantId)
    )
      return reply(403, { error: "support_not_authorized" });
    if (operation === "connection.lifecycle") {
      if (!deps.lifecycle) return reply(503, { error: "support_unavailable" });
      return reply(200, await deps.lifecycle(target));
    }
    if (
      operation !== "support_ticket_lookup" &&
      operation !== "support_output_access"
    ) {
      if (!(await deps.verify(target, operation)))
        return reply(403, { error: "support_not_authorized" });
      return reply(200, { ok: true, target, manifest: SUPPORT_MANIFEST });
    }
    const ref =
      operation === "support_ticket_lookup"
        ? ticketRef(exact(body.parameters, ["ticketRef"]).ticketRef)
        : undefined;
    const proof = await deps.verifySource?.(
      operation === "support_ticket_lookup" ? "lookup" : "output",
      target,
      body.source,
      ref,
    );
    if (!proof) return reply(403, { error: "support_not_authorized" });
    if (operation === "support_output_access")
      return reply(200, {
        ok: true,
        target,
        disclosureId: proof.disclosureId,
        digest: proof.digest,
        allowed: true,
      });
    const ticket = await deps.lookup(target, ref!);
    if (proof.expiresAt <= Date.now())
      return reply(403, { error: "support_not_authorized" });
    if (!ticket) return reply(404, { error: "ticket_not_found" });
    if (
      ticket.ticketRef !== ref ||
      typeof ticket.status !== "string" ||
      !ticket.status.trim() ||
      ticket.status.length > 64 ||
      /[\u0000-\u001f\u007f]/.test(ticket.status) ||
      !["low", "normal", "high", "urgent"].includes(ticket.priority)
    )
      throw Error();
    return reply(200, {
      ok: true,
      target,
      ticket: {
        reference: ref,
        status: ticket.status,
        priority: ticket.priority,
      },
    });
  } catch (error) {
    return error instanceof TypeError || error instanceof SyntaxError
      ? reply(400, { error: "invalid_request" })
      : reply(503, { error: "support_unavailable" });
  }
}
