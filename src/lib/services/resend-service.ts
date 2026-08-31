/**
 * SupportV8 Resend Email Dispatcher
 * Sends structured, machine-parsable lead notifications to leads@servicev8.com
 * and secure 6-digit OTP verification codes to registering administrators.
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
  needsAssessment?: string[];
  ticketVolume?: string;
}

export interface SendLeadEmailResult {
  success: boolean;
  resendEmailId?: string;
  subject: string;
  to: string;
  error?: string;
}

export interface OtpEmailPayload {
  email: string;
  code: string;
  companyName?: string;
  tenantSlug?: string;
}

export interface SendOtpEmailResult {
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

    const needsList =
      payload.needsAssessment && payload.needsAssessment.length > 0
        ? payload.needsAssessment.map((n) => `  - ${n}`).join("\n")
        : "  - General AI Support Sandbox Exploration";

    return `[LEAD:SUPPORTV8_SANDBOX]
=============================================================
LEAD_SOURCE: supportv8_sandbox_demo
LEAD_ID: ${payload.leadId}
WORK_EMAIL: ${payload.workEmail}
COMPANY_NAME: ${payload.companyName}
FULL_NAME: ${payload.fullName || "Not provided"}
TARGET_TENANT: ${payload.targetTenant}
TARGET_VERTICAL: ${tenantLabel}
TICKET_VOLUME: ${payload.ticketVolume || "Unspecified"}
EMAIL_OPT_IN: ${payload.optInEmail ? "true" : "false"}
CAPTURED_AT: ${payload.capturedAt}
IP_ADDRESS: ${payload.ipAddress || "127.0.0.1"}

STATED AI SUPPORT REQUIREMENTS:
${needsList}
=============================================================

A new prospect has requested live operator access to the SupportV8 sandbox demo.

CRM PARSER TAGS:
#lead #supportv8 #sandbox_demo #${payload.targetTenant}`;
  }

  /**
   * Dispatches lead email to leads@servicev8.com via Resend API
   */
  public static async dispatchLeadEmail(payload: LeadEmailPayload): Promise<SendLeadEmailResult> {
    const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
    const fromAddress = process.env.RESEND_FROM_EMAIL || "SupportV8 <notifications@servicev8.com>";
    const toAddress = process.env.LEADS_INBOX_EMAIL || "leads@servicev8.com";
    const subject = this.generateLeadSubject(payload);
    const textBody = this.generateLeadBody(payload);

    if (!apiKey || process.env.NODE_ENV === "test") {
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

  /**
   * Dispatches 6-digit OTP verification code to a registering user's email via Resend API
   */
  public static async dispatchOtpEmail(payload: OtpEmailPayload): Promise<SendOtpEmailResult> {
    const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
    const fromAddress = process.env.RESEND_FROM_EMAIL || "SupportV8 <notifications@servicev8.com>";
    const toAddress = payload.email.trim().toLowerCase();
    const subject = `[supportv8] Your Verification Code: ${payload.code}`;
    const company = payload.companyName || "your workspace";
    const domain = payload.tenantSlug ? `${payload.tenantSlug}.support.servicev8.com` : "support.servicev8.com";

    const textBody = `Hello,

Your 6-digit verification code for ${company} (${domain}) is:

${payload.code}

This code will expire in 10 minutes. If you did not request this sign up, please ignore this email.

Best regards,
The servicev8 Team
https://servicev8.com`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #0b1017; color: #eaf1f8; padding: 32px; border-radius: 16px; border: 1px solid #1e2b3a;">
        <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 10px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">support<span style="color: #2ed8b6;">v8</span></h2>
        </div>
        <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">Confirm your registration</h1>
        <p style="font-size: 14px; color: #8e9aa8; line-height: 1.5; margin-bottom: 24px;">
          Use the 6-digit verification code below to complete provisioning for <strong>${company}</strong> (<code style="color: #2ed8b6;">${domain}</code>).
        </p>
        <div style="background-color: #121a24; border: 1px solid #2ed8b6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2ed8b6; font-family: monospace;">${payload.code}</span>
        </div>
        <p style="font-size: 12px; color: #6b7c8d; line-height: 1.4; margin-bottom: 20px;">
          This code is valid for 10 minutes. For security, never share this code with anyone.
        </p>
        <div style="border-top: 1px solid #1e2b3a; padding-top: 16px; font-size: 11px; color: #6b7c8d;">
          &copy; ${new Date().getFullYear()} servicev8 &bull; Autonomous Service Infrastructure
        </div>
      </div>
    `;

    console.log(`[supportV8 Auth] Dispatching OTP code ${payload.code} to ${toAddress}`);

    if (!apiKey || process.env.NODE_ENV === "test") {
      return {
        success: true,
        resendEmailId: `resend_mock_otp_${Date.now()}`,
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
          html: htmlBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn("[supportV8] Resend OTP dispatch warning:", data);
        return {
          success: false,
          subject,
          to: toAddress,
          error: data?.message || "Failed to send OTP email via Resend",
        };
      }

      return {
        success: true,
        resendEmailId: data.id,
        subject,
        to: toAddress,
      };
    } catch (err: unknown) {
      console.warn("[supportV8] Resend OTP dispatch exception:", err);
      return {
        success: false,
        subject,
        to: toAddress,
        error: err instanceof Error ? err.message : "Network error contacting Resend API",
      };
    }
  }
}
