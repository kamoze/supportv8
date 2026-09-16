import { headers } from "next/headers";
import { authorizeRuntimeSupportRequest } from "@/lib/service-app/runtime-session";
import { runtimeSupportTicketReader } from "@/lib/service-app/runtime-ticket-reader";
import { RuntimeWorkspace } from "./runtime-workspace";
import "./runtime.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Support workspace | SupportV8",
  robots: { index: false, follow: false },
};
export default async function RuntimePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; ticket?: string; view?: string }>;
}) {
  const h = await headers(),
    host = h.get("host") ?? "",
    cookie = h.get("cookie") ?? "",
    request = new Request("http://127.0.0.1/runtime", {
      headers: { host, cookie },
    });
  let auth;
  try {
    auth = await authorizeRuntimeSupportRequest(request);
  } catch {
    return <RuntimeWorkspace domain={safeDomain(host)} state="unavailable" />;
  }
  if (!auth)
    return <RuntimeWorkspace domain={safeDomain(host)} state="denied" />;
  const scope = {
    accountId: auth.session.accountId,
    tenantId: auth.session.tenantId,
    verticalId: "runtime" as const,
    installationId: auth.session.installationId,
    workspaceId: auth.session.workspaceId,
    subject: auth.session.sub,
  };
  try {
    const query = await searchParams;
    if (
      query.view &&
      !["overview", "workspace", "issues"].includes(query.view)
    ) {
      return (
        <RuntimeWorkspace
          domain={auth.session.tenantDomain}
          role={auth.role}
          state="ready"
          view={query.view}
        />
      );
    }
    const page = await runtimeSupportTicketReader.list(scope, {
        limit: 30,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      }),
      selected = query.ticket
        ? await runtimeSupportTicketReader.get(scope, query.ticket)
        : (page.tickets[0] ?? null);
    return (
      <RuntimeWorkspace
        domain={auth.session.tenantDomain}
        role={auth.role}
        page={page}
        selected={selected}
        selectionRequested={Boolean(query.ticket)}
        state={page.tickets.length ? "ready" : "empty"}
        cursor={query.cursor}
        view={query.view}
      />
    );
  } catch {
    return (
      <RuntimeWorkspace
        domain={auth.session.tenantDomain}
        state="unavailable"
      />
    );
  }
}
function safeDomain(host: string) {
  const value = host.split(":")[0]?.split(".")[0] ?? "workspace";
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ? value
    : "workspace";
}
