import { NextResponse } from "next/server";
import { RequestAuthError } from "./request-tenant";
import { AccountError } from "./account-members";
import { InvitationError } from "./invitation-store";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser API clients still require signed authentication.
  const url = new URL(request.url);
  // Next may expose its internal HTTP URL behind the TLS ingress. Compare the
  // browser origin to Host (preserved by ingress), never an arbitrary forwarded host.
  const host = (request.headers.get("host") || url.host).toLowerCase();
  let source: URL;
  try { source = new URL(origin); }
  catch { throw new RequestAuthError("Invalid request origin.", 403); }
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (source.origin !== origin || source.host !== host || (source.protocol !== "https:" && !(local && source.protocol === "http:"))) {
    throw new RequestAuthError("Account changes must originate in this workspace.", 403);
  }
}

export function accountError(error: unknown) {
  const known = error instanceof AccountError || error instanceof RequestAuthError || error instanceof InvitationError;
  return NextResponse.json({ success: false, error: known ? error.message : "Account service is unavailable. Please try again." }, { status: known ? error.status : 503 });
}
