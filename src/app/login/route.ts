import { NextRequest, NextResponse } from "next/server";
import { POST as authenticate } from "@/app/api/auth/login/route";
import { validateIngressHost, safeNextPath } from "@/lib/tenant-host";
import { botProofFailure } from "@/lib/auth/bot-challenge";
import { BotProofError } from "@/lib/auth/bot-transaction";
import { withinBotDeadline } from "@/lib/auth/bot-gateway";

export const dynamic = "force-dynamic";

/** One native browser form and one credential implementation. */
export async function GET(req: NextRequest) {
  const checked = validateIngressHost(req.headers.get("host"), req.headers.get("x-forwarded-host"));
  if (!checked.valid) return NextResponse.json({ error: checked.error }, { status: checked.status || 400 });
  const target = new URL("/", req.url); target.searchParams.set("signin", "1");
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  if (next !== "/") target.searchParams.set("next", next);
  return NextResponse.redirect(target, { status: 302, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

async function formBody(req: NextRequest): Promise<Record<string, string>> {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(5000)]), reader = req.body?.getReader();
  if (!reader) throw new BotProofError();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await withinBotDeadline(reader.read(), signal); if (next.done) break;
      size += next.value.byteLength; if (size > 16_384) throw new BotProofError(); chunks.push(next.value);
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  const params = new URLSearchParams(Buffer.concat(chunks, size).toString("utf8"));
  const body: Record<string, string> = {};
  for (const [key, value] of params) {
    if (Object.hasOwn(body, key) || !["email", "password", "workspace", "tenantSlug", "challengeId", "botToken"].includes(key)) throw new BotProofError();
    body[key] = value;
  }
  if (body.workspace && body.tenantSlug && body.workspace !== body.tenantSlug) throw new BotProofError();
  return { ...body, tenantSlug: body.tenantSlug || body.workspace || "" };
}

export async function POST(req: NextRequest) {
  try {
    const isForm = req.headers.get("content-type")?.split(";", 1)[0].trim() === "application/x-www-form-urlencoded";
    let credentialRequest = req;
    if (isForm) {
      const body = await formBody(req), headers = new Headers(req.headers);
      headers.set("content-type", "application/json"); headers.delete("content-length");
      credentialRequest = new NextRequest(req.url, { method: "POST", headers, body: JSON.stringify(body), signal: req.signal });
    }
    const response = await authenticate(credentialRequest);
    if (!response.ok) return response;
    const next = safeNextPath(req.nextUrl.searchParams.get("next"));
    if (!isForm) return NextResponse.json({ ...await response.json(), redirectUrl: next }, { headers: response.headers });
    const redirect = NextResponse.redirect(new URL(next, req.url), 302);
    for (const cookie of response.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
    redirect.headers.set("cache-control", "no-store"); return redirect;
  } catch (error) { return botProofFailure(error); }
}
