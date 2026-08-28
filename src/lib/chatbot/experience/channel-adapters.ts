import type { ChannelType, InboundMessagePayload } from "../types";
import type { ChatStreamType } from "@/lib/types";

export class ChannelAdapters {
  /**
   * Normalizes incoming Web Chat & Mobile payloads
   */
  static normalizeWebChat(body: {
    tenantId?: string;
    sessionId: string;
    stream: ChatStreamType;
    customerName: string;
    customerEmail?: string;
    content: string;
    isMobile?: boolean;
  }): InboundMessagePayload {
    return {
      channel: body.isMobile ? "mobile" : "web_chat",
      tenantId: body.tenantId || "tenant_default",
      sessionId: body.sessionId,
      senderId: body.customerEmail || `anon_${body.sessionId.slice(-6)}`,
      senderName: body.customerName,
      senderEmail: body.customerEmail,
      content: body.content,
      stream: body.stream,
      metadata: { isMobile: Boolean(body.isMobile) },
    };
  }

  /**
   * Normalizes incoming WhatsApp Business Webhook payloads
   */
  static normalizeWhatsApp(body: {
    object?: string;
    entry?: Array<{
      id: string;
      changes: Array<{
        value: {
          messaging_product: string;
          metadata: { display_phone_number: string; phone_number_id: string };
          contacts?: Array<{ profile: { name: string }; wa_id: string }>;
          messages?: Array<{
            id: string;
            from: string;
            text?: { body: string };
            type: string;
          }>;
        };
      }>;
    }>;
  }): InboundMessagePayload | null {
    try {
      const change = body.entry?.[0]?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (!message || !message.text?.body) return null;

      const phone = message.from;
      const name = contact?.profile?.name || `WhatsApp User (${phone.slice(-4)})`;
      const content = message.text.body;

      return {
        channel: "whatsapp",
        tenantId: "tenant_default",
        sessionId: `wa_${phone}`,
        senderId: phone,
        senderName: name,
        senderPhone: phone,
        content,
        stream: "customers",
        metadata: { waMessageId: message.id, phoneNumberId: change?.metadata?.phone_number_id },
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalizes incoming Email Webhook / Ingest payloads
   */
  static normalizeEmail(body: {
    from: string;
    to: string;
    subject: string;
    textBody: string;
    messageId?: string;
  }): InboundMessagePayload {
    const emailMatch = body.from.match(/<([^>]+)>/) || [null, body.from];
    const email = (emailMatch[1] || body.from).trim().toLowerCase();
    const nameMatch = body.from.match(/^([^<]+)/);
    const name = nameMatch ? nameMatch[1].trim().replace(/["']/g, "") : email.split("@")[0];

    // Detect stream from recipient address or subject
    let stream: ChatStreamType = "customers";
    const toLower = body.to.toLowerCase();
    const subLower = body.subject.toLowerCase();

    if (toLower.includes("contractor") || toLower.includes("vendor") || subLower.includes("work order")) {
      stream = "contractors";
    } else if (toLower.includes("sales") || toLower.includes("info") || subLower.includes("enquiry")) {
      stream = "enquiries";
    }

    return {
      channel: "email",
      tenantId: "tenant_default",
      sessionId: `email_${email.replace(/[^a-z0-9]/gi, "_")}`,
      senderId: email,
      senderName: name,
      senderEmail: email,
      content: `Subject: ${body.subject}\n\n${body.textBody}`,
      stream,
      metadata: { subject: body.subject, messageId: body.messageId },
    };
  }

  /**
   * Normalizes incoming Voice Call transcripts & Telephony events
   */
  static normalizeVoice(body: {
    callSid: string;
    callerNumber: string;
    callerName?: string;
    transcript: string;
    stream?: ChatStreamType;
  }): InboundMessagePayload {
    return {
      channel: "voice",
      tenantId: "tenant_default",
      sessionId: `voice_${body.callSid}`,
      senderId: body.callerNumber,
      senderName: body.callerName || `Caller (${body.callerNumber.slice(-4)})`,
      senderPhone: body.callerNumber,
      content: body.transcript,
      stream: body.stream || "customers",
      metadata: { callSid: body.callSid },
    };
  }

  /**
   * Formats outbound message tailored for the target channel
   */
  static formatOutbound(channel: ChannelType, text: string, citations?: Array<{ title: string }>): string {
    if (channel === "voice") {
      // Clean markdown tags for natural speech synthesis
      return text.replace(/[*_#`[\]()]/g, "").replace(/\n+/g, ". ").trim();
    }
    if (channel === "whatsapp") {
      // WhatsApp supports *bold*, _italic_, ~strike~
      return text;
    }
    if (channel === "email") {
      let emailFormatted = text;
      if (citations && citations.length > 0) {
        emailFormatted += `\n\n---\nReferences:\n${citations.map((c) => `• ${c.title}`).join("\n")}`;
      }
      return emailFormatted;
    }
    // Web Chat & Mobile return rich markdown
    return text;
  }
}
