/**
 * SupportV8 Resend Email Dispatcher
 * Sends structured, machine-parsable lead notifications to leads@servicev8.com
 */

export interface LeadEmailPayload {
  leadId: string;
  workEmail: string;
  fullName?: string;
  companyName: string;
  targetTenant: string;
  optInEmail: boolean;
  capturedAt: string;
  ipAddress?: string;
}

export interface SendLeadEmailResult {
  success: boolean;
  resendEmailId?: string;
  subject: string;
  to: string;
  error?: string;
}

export class ResendService {
  private static RESEND_API_URL = "https://api.resend.com/emails";

  /**
   * Generates a deterministic, machine-parsable subject line
   * Format: [LEAD:SUPPORTV8_SANDBOX] <Company> | <TENANT> | <Email>
   */
  public static generateLeadSubject(payload: LeadEmailPayload): string {
    const tenantUpper = (payload.targetTenant || "ACME").toUpperCase();
    return `[LEAD:SUPPORTV8_SANDBOX] ${payload.companyName} | ${tenantUpper} | ${payload.workEmail}`;
  }

  /**
   * Generates a structured plain text body for email parsers and sales reps
   */
  public static generateLeadBody(payload: LeadEmailPayload): string {
    const tenantLabel =
      payload.targetTenant === "meridian"
        ? "MERIDIAN (Field Dispatch & Contractor Desk)"
        : "ACME (SaaS Customer Care & Billing Desk)";

    return `[LEAD:SUPPORTV8_SANDBOX]
=============================================================
LEAD_SOURCE: supportv8_sandbox_demo
LEAD_ID: ${payload.leadId}
WORK_EMAIL: ${payload.workEmail}
COMPANY_NAME: ${payload.companyName}
FULL_NAME: ${payload.fullName || "Not provided"}
TARGET_TENANT: ${payload.targetTenant}
TARGET_VERTICAL: ${tenantLabel}
EMAIL_OPT_IN: ${payload.optInEmail ? "true" : "false"}
CAPTURED_AT: ${payload.capturedAt}
IP_ADDRESS: ${payload.ipAddress || "127.0.0.1"}
=============================================================

A new prospect has requested live operator access to the SupportV8 sandbox demo.

CRM PARSER TAGS:
#lead #supportv8 #sandbox_demo #${payload.targetTenant}`;
  }

  /**
   * Dispatches lead email to leads@servicev8.com via Resend API
   */
  public static async dispatchLeadEmail(payload: LeadEmailPayload): Promise<SendLeadEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL || "SupportV8 <notifications@servicev8.com>";
    const toAddress = process.env.LEADS_INBOX_EMAIL || "leads@servicev8.com";
    const subject = this.generateLeadSubject(payload);
    const textBody = this.generateLeadBody(payload);

    if (!apiKey || process.env.NODE_ENV === "test") {
      // In tests or when API key is unconfigured, return mock successful response
      return {
        success: true,
        resendEmailId: `resend_mock_${Date.now()}`,
        subject,
        to: toAddress,
      };
    }

    try {
      const response = await fetch(this.RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [toAddress],
          subject,
          text: textBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn("[supportV8] Resend API dispatch warning:", data);
        return {
          success: false,
          subject,
          to: toAddress,
          error: data?.message || "Failed to send email via Resend",
        };
      }

      return {
        success: true,
        resendEmailId: data.id,
        subject,
        to: toAddress,
      };
    } catch (err: unknown) {
      console.warn("[supportV8] Resend dispatch exception:", err);
      return {
        success: false,
        subject,
        to: toAddress,
        error: err instanceof Error ? err.message : "Network error contacting Resend API",
      };
    }
  }
}
