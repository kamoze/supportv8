import { describe,expect,it,vi } from "vitest";
import { RuntimeSupportTicketReader } from "@/lib/service-app/runtime-ticket-reader";
import type { SupportRuntimeScope } from "@/lib/service-app/runtime-access";
import type { DatabasePool } from "@/lib/db/pg-client";
import { PostgresClient } from "@/lib/db/pg-client";

const scope:SupportRuntimeScope={accountId:"acct-1",tenantId:"registry-1",verticalId:"runtime",installationId:"install-1",workspaceId:"tenant_rt_1234567890abcdef1234567890abcdef1234567890abcdef",subject:"member-2"};
const access={...scope,capability:"support:read" as const,email:"member@example.test",domain:"acme-support"};
function harness(rows:Record<string,unknown>[]){
  const calls:Array<{sql:string;params?:unknown[]}>=[];
  const query=vi.fn(async(sql:string,params?:unknown[])=>{calls.push({sql,params});return {rows:sql.includes("supportv8.issues")?rows:[]};});
  const pool={connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as DatabasePool;
  const current=vi.fn(async()=>access);
  return {reader:new RuntimeSupportTicketReader({client:new PostgresClient(undefined,pool),resolve:current}),calls,current};
}
const row=(id:string,source:string,updatedAt:string)=>({id,external_id:`ref-${id}`,customer_ref:`customer-${id}`,customer_name:`Customer ${id}`,source_status:"open",priority:"normal",summary:`Summary ${id}`,source,created_at:"2026-09-01T00:00:00.000Z",updated_at:updatedAt});

describe("Runtime Support durable ticket reader",()=>{
  it("returns all sources with a bounded keyset and a scope-bound cursor",async()=>{
    const {reader,calls}=harness([row("voice-1","voice","2026-09-16T12:00:00.000Z"),row("handoff-1","orderv8_handoff","2026-09-16T11:00:00.000Z"),row("email-1","email","2026-09-16T10:00:00.000Z")]);
    const page=await reader.list(scope,{limit:2});
    expect(page.tickets.map(ticket=>ticket.source)).toEqual(["voice","orderv8_handoff"]);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(calls.find(call=>call.sql.includes("FROM supportv8.issues"))?.params).toEqual([scope.workspaceId,3]);
    const next=harness([row("email-1","email","2026-09-16T10:00:00.000Z")]);
    await next.reader.list(scope,{limit:2,cursor:page.nextCursor});
    expect(next.calls.find(call=>call.sql.includes("FROM supportv8.issues"))?.params).toEqual([scope.workspaceId,"2026-09-16T11:00:00.000Z","handoff-1",3]);
    await expect(next.reader.list({...scope,tenantId:"registry-2"},{limit:2,cursor:page.nextCursor})).rejects.toThrow("invalid_ticket_cursor");
  });
  it.each([0,101,1.5])("rejects invalid limit %s",async(limit)=>expect(harness([]).reader.list(scope,{limit})).rejects.toThrow("invalid_ticket_query"));
  it.each([
    ["non-string",42],
    ["empty",""],
    ["oversized","a".repeat(513)],
    ["non-base64url","not+base64/url="],
    ["wrong shape",Buffer.from(JSON.stringify([])).toString("base64url")],
    ["extra field",Buffer.from(JSON.stringify({v:1,scope:"x",updatedAt:"2026-09-16T12:00:00Z",id:"ticket-1",extra:true})).toString("base64url")],
  ])("rejects %s cursor before querying",async(_name,cursor)=>{
    const h=harness([]);
    await expect(h.reader.list(scope,{cursor:cursor as string})).rejects.toThrow("invalid_ticket_cursor");
    expect(h.calls.some(call=>call.sql.includes("FROM supportv8.issues"))).toBe(false);
  });
  it("does exact detail lookup and reauthorizes on every read",async()=>{
    const h=harness([row("ticket-1","chat","2026-09-16T12:00:00.000Z")]);
    expect((await h.reader.get(scope,"ticket-1"))?.ticketRef).toBe("ref-ticket-1");
    await h.reader.list(scope,{limit:10});
    expect(h.current).toHaveBeenCalledTimes(2);
    const sql=h.calls.filter(call=>call.sql.includes("FROM supportv8.issues"));
    expect(sql[0]?.sql).toContain("tenant_id=$1 AND id=$2");
    expect(sql[0]?.params).toEqual([scope.workspaceId,"ticket-1"]);
  });
  it("denies before querying when current access is revoked",async()=>{
    const h=harness([]); (h.reader as unknown as {resolve:unknown}).resolve=async()=>null;
    await expect(h.reader.list(scope,{})).rejects.toThrow("support_access_denied");
    expect(h.calls.some(call=>call.sql.includes("FROM supportv8.issues"))).toBe(false);
  });
  it("creates and updates durable tickets only after a fresh manage check", async () => {
    const h = harness([
      row("ticket-1", "runtime_manual", "2026-09-16T12:00:00.000Z"),
    ]);
    (h.reader as unknown as { resolve: unknown }).resolve = async () => ({
      ...access,
      capability: "support:manage",
    });
    expect(
      (
        await h.reader.create(scope, {
          customerName: "Synthetic Customer",
          summary: "Needs help",
          priority: "high",
        })
      ).id,
    ).toBe("ticket-1");
    expect(
      (await h.reader.update(scope, "ticket-1", { status: "resolved" }))?.id,
    ).toBe("ticket-1");
    const writes = h.calls.filter(
      (call) =>
        call.sql.includes("INSERT INTO supportv8.issues") ||
        call.sql.includes("UPDATE supportv8.issues"),
    );
    expect(writes).toHaveLength(2);
    expect(writes[0]?.params?.[1]).toBe(scope.workspaceId);
    expect(writes[1]?.params?.slice(0, 2)).toEqual([
      scope.workspaceId,
      "ticket-1",
    ]);
  });
  it("blocks durable writes after a fresh downgrade", async () => {
    const h = harness([]);
    await expect(
      h.reader.create(scope, {
        customerName: "Synthetic Customer",
        summary: "Needs help",
        priority: "normal",
      }),
    ).rejects.toThrow("support_manage_denied");
    expect(
      h.calls.some((call) => call.sql.includes("INSERT INTO supportv8.issues")),
    ).toBe(false);
  });
});
