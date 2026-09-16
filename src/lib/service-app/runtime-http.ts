import type { SupportRuntimeScope } from "./runtime-access";
import { authorizeRuntimeSupportRequest } from "./runtime-session";
import {
  runtimeSupportTicketReader,
  type SupportTicketPage,
  type SupportTicketSummary,
} from "./runtime-ticket-reader";
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
  return json({ error: "ticket service unavailable" }, 503);
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
