import type { SupportRuntimeScope } from "./runtime-access";
import { authorizeRuntimeSupportRequest } from "./runtime-session";
import {
  runtimeSupportTicketReader,
  type CreateSupportTicket,
  type SupportTicketPage,
  type SupportTicketSummary,
} from "./runtime-ticket-reader";
import { trustedRuntimeTenantHost } from "./runtime-session";
const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
const scopeFrom = (
  auth: NonNullable<Awaited<ReturnType<typeof authorizeRuntimeSupportRequest>>>,
): SupportRuntimeScope => ({
  accountId: auth.session.accountId,
  tenantId: auth.session.tenantId,
  verticalId: "runtime",
  installationId: auth.session.installationId,
  workspaceId: auth.session.workspaceId,
  subject: auth.session.sub,
});
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "invalid_ticket_query" || message === "invalid_ticket_cursor")
    return json({ error: "invalid ticket request" }, 400);
  if (message === "support_access_denied")
    return json({ error: "support access denied" }, 403);
  if (message === "support_manage_denied")
    return json({ error: "support management permission required" }, 403);
  if (message === "unsupported_ticket_source")
    return json({ error: "ticket source requires its native editor" }, 409);
  return json({ error: "ticket service unavailable" }, 503);
}
const priorities = new Set(["low", "normal", "high", "urgent"]),
  statuses = new Set([
    "open",
    "in_progress",
    "escalated",
    "resolved",
    "closed",
  ]);
function writeOrigin(request: Request) {
  const host = trustedRuntimeTenantHost(request),
    origin = request.headers.get("origin");
  return Boolean(host && origin === `https://${host}`);
}
async function boundedBody(request: Request) {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  )
    throw new Error("invalid_ticket_body");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 16_384))
    throw new Error("invalid_ticket_body");
  if (!request.body) throw new Error("invalid_ticket_body");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        size += value.byteLength;
        if (size > 16_384) throw new Error("invalid_ticket_body");
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const raw = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new Error("invalid_ticket_body");
  }
}
function creation(value: Record<string, unknown>): CreateSupportTicket {
  if (
    Object.keys(value).some(
      (k) => !["customerName", "summary", "priority"].includes(k),
    ) ||
    typeof value.customerName !== "string" ||
    !value.customerName.trim() ||
    value.customerName.length > 255 ||
    typeof value.summary !== "string" ||
    !value.summary.trim() ||
    value.summary.length > 5000 ||
    (value.priority !== undefined &&
      (typeof value.priority !== "string" || !priorities.has(value.priority)))
  )
    throw new Error("invalid_ticket_body");
  return {
    customerName: value.customerName.trim(),
    summary: value.summary.trim(),
    priority: (value.priority ?? "normal") as CreateSupportTicket["priority"],
  };
}
function updates(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  if (
    !keys.length ||
    keys.some((k) => !["summary", "priority", "status"].includes(k)) ||
    (value.summary !== undefined &&
      (typeof value.summary !== "string" ||
        !value.summary.trim() ||
        value.summary.length > 5000)) ||
    (value.priority !== undefined &&
      (typeof value.priority !== "string" ||
        !priorities.has(value.priority))) ||
    (value.status !== undefined &&
      (typeof value.status !== "string" || !statuses.has(value.status)))
  )
    throw new Error("invalid_ticket_body");
  return {
    ...(value.summary !== undefined ? { summary: value.summary.trim() } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
  } as Parameters<typeof runtimeSupportTicketReader.update>[2];
}
export async function handleRuntimeTicketList(
  request: Request,
  deps: {
    authorize?: typeof authorizeRuntimeSupportRequest;
    list?: (
      scope: SupportRuntimeScope,
      input: { limit?: number; cursor?: string },
    ) => Promise<SupportTicketPage>;
  } = {},
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(null, {
      status: 405,
      headers: { ...headers, allow: "GET" },
    });
  let auth;
  try {
    auth = await (deps.authorize ?? authorizeRuntimeSupportRequest)(request);
  } catch {
    return json({ error: "ticket service unavailable" }, 503);
  }
  if (!auth) return json({ error: "authentication required" }, 401);
  try {
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some(
        (k) => k !== "limit" && k !== "cursor",
      ) ||
      url.searchParams.getAll("limit").length > 1 ||
      url.searchParams.getAll("cursor").length > 1
    )
      return json({ error: "invalid ticket request" }, 400);
    const raw = url.searchParams.get("limit"),
      limit = raw === null ? undefined : Number(raw);
    return json(
      await (
        deps.list ??
        runtimeSupportTicketReader.list.bind(runtimeSupportTicketReader)
      )(scopeFrom(auth), {
        ...(limit === undefined ? {} : { limit }),
        ...(url.searchParams.has("cursor")
          ? { cursor: url.searchParams.get("cursor")! }
          : {}),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function handleRuntimeTicketCreate(
  request: Request,
  deps: {
    authorize?: typeof authorizeRuntimeSupportRequest;
    create?: typeof runtimeSupportTicketReader.create;
  } = {},
) {
  if (request.method !== "POST")
    return new Response(null, {
      status: 405,
      headers: { ...headers, allow: "POST" },
    });
  if (!writeOrigin(request))
    return json({ error: "same-origin request required" }, 403);
  try {
    const auth = await (deps.authorize ?? authorizeRuntimeSupportRequest)(
      request,
    );
    if (!auth) return json({ error: "authentication required" }, 401);
    if (auth.role !== "support:manage")
      return json({ error: "support management permission required" }, 403);
    const value = creation(await boundedBody(request));
    return json(
      await (
        deps.create ??
        runtimeSupportTicketReader.create.bind(runtimeSupportTicketReader)
      )(scopeFrom(auth), value),
      201,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "invalid_ticket_body")
      return json({ error: "invalid ticket request" }, 400);
    return failure(e);
  }
}
export async function handleRuntimeTicketUpdate(
  request: Request,
  id: string,
  deps: {
    authorize?: typeof authorizeRuntimeSupportRequest;
    update?: typeof runtimeSupportTicketReader.update;
  } = {},
) {
  if (request.method !== "PATCH")
    return new Response(null, {
      status: 405,
      headers: { ...headers, allow: "PATCH" },
    });
  if (!writeOrigin(request))
    return json({ error: "same-origin request required" }, 403);
  try {
    const auth = await (deps.authorize ?? authorizeRuntimeSupportRequest)(
      request,
    );
    if (!auth) return json({ error: "authentication required" }, 401);
    if (auth.role !== "support:manage")
      return json({ error: "support management permission required" }, 403);
    const value = updates(await boundedBody(request)),
      result = await (
        deps.update ??
        runtimeSupportTicketReader.update.bind(runtimeSupportTicketReader)
      )(scopeFrom(auth), id, value);
    return result ? json(result) : json({ error: "ticket not found" }, 404);
  } catch (e) {
    if (e instanceof Error && e.message === "invalid_ticket_body")
      return json({ error: "invalid ticket request" }, 400);
    return failure(e);
  }
}
export async function handleRuntimeTicketDetail(
  request: Request,
  id: string,
  deps: {
    authorize?: typeof authorizeRuntimeSupportRequest;
    get?: (
      scope: SupportRuntimeScope,
      id: string,
    ) => Promise<SupportTicketSummary | null>;
  } = {},
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(null, {
      status: 405,
      headers: { ...headers, allow: "GET" },
    });
  let auth;
  try {
    auth = await (deps.authorize ?? authorizeRuntimeSupportRequest)(request);
  } catch {
    return json({ error: "ticket service unavailable" }, 503);
  }
  if (!auth) return json({ error: "authentication required" }, 401);
  try {
    const value = await (
      deps.get ??
      runtimeSupportTicketReader.get.bind(runtimeSupportTicketReader)
    )(scopeFrom(auth), id);
    return value ? json(value) : json({ error: "ticket not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
