import { supportWorkspaceUrl } from "@/lib/tenant-host";

export function invitationEmail(email: string, tenantSlug: string, token: string) {
  const url = supportWorkspaceUrl(tenantSlug, "/accept-invite");
  // A fragment is not sent in HTTP requests, proxy logs, or referrer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return {
    from: process.env.RESEND_FROM_EMAIL || "SupportV8 <notifications@servicev8.com>",
    to: [email], subject: "You’re invited to a SupportV8 workspace",
    text: `You have been invited to the ${tenantSlug} SupportV8 workspace.\n\nVerify your email and choose a password on SupportV8:\n${url.toString()}\n\nThis single-use link expires in 24 hours. Opening it does not activate your account. Only submit the form if you expected this invitation.\n\nIf the link expires or setup fails, ask your workspace administrator to send a new invitation.\n\nThe SupportV8 team`,
  };
}
export async function sendInvitationEmail(email: string, tenantSlug: string, token: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
  if (!apiKey) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8000), redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(invitationEmail(email, tenantSlug, token)),
    });
    return response.ok;
  } catch { return false; }
}
