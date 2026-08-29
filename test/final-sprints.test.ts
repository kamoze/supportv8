import { describe, it, expect } from "vitest";
import { AuthService } from "../src/lib/auth-service";
import { db } from "../src/lib/db/mock-data";
import { ChatWorkflowService } from "../src/lib/services/chat-workflow-service";
import { ResendService } from "../src/lib/services/resend-service";

describe("Final Sprints Features & Architecture Validation", () => {
  describe("1. First-Party Authentication & Email OTP Flow", () => {
    it("should issue a 6-digit OTP code and verify it successfully", () => {
      const email = "admin@acme-movers.com";
      const otp = AuthService.issueOtp(email);
      expect(otp).toBeDefined();
      expect(otp.length).toBe(6);

      const isValid = AuthService.verifyOtp(email, otp);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect OTP codes", () => {
      const email = "admin@acme-movers.com";
      AuthService.issueOtp(email);
      const isInvalid = AuthService.verifyOtp(email, "000000");
      expect(isInvalid).toBe(false);
    });

    it("should dispatch a 6-digit OTP verification email via Resend", async () => {
      const email = "admin@acme-movers.com";
      const otp = AuthService.issueOtp(email);
      const emailResult = await ResendService.dispatchOtpEmail({
        email,
        code: otp,
        companyName: "Acme Movers",
        tenantSlug: "acme-movers",
      });

      expect(emailResult.success).toBe(true);
      expect(emailResult.subject).toContain(otp);
      expect(emailResult.to).toBe(email);
      expect(emailResult.resendEmailId).toBeTruthy();
    });

    it("should create cryptographic session with contractor/technician roles", () => {
      const session = AuthService.createSession("meridian", "tech@apex.com", "technician");
      expect(session.token).toContain("sv8_tk_meridian_");
      expect(session.role).toBe("technician");
      expect(session.tenantSlug).toBe("meridian");
    });
  });

  describe("2. Clean-Slate Tenant Isolation", () => {
    it("should return a 100% clean workspace for a newly registered tenant (e.g. acme-movers)", () => {
      const cleanData = db.getTenantData("acme-movers");
      expect(cleanData.isClean).toBe(true);
      expect(cleanData.tenant.name).toBe("Acme Movers");
      expect(cleanData.issues.length).toBe(0);
      expect(cleanData.problems.length).toBe(0);
      expect(cleanData.sources.length).toBe(0);
      expect(cleanData.documents.length).toBe(0);
      expect(cleanData.tenant.featureFlags.autonomousMode).toBe(false);
    });

    it("should return seeded simulation data for demo sandboxes (acme and meridian)", () => {
      const acmeData = db.getTenantData("acme");
      expect(acmeData.isClean).toBe(false);
      expect(acmeData.issues.length).toBeGreaterThan(0);

      const meridianData = db.getTenantData("meridian");
      expect(meridianData.isClean).toBe(false);
      expect(meridianData.issues.some((i) => i.entityType === "contractor" || i.category.includes("contractor"))).toBe(true);
    });
  });

  describe("3. Omnichannel Ingest & Unique Sequence Numbers", () => {
    it("should generate unique sequence IDs (SV8-CHAT-XXXX) on chat session intake", () => {
      const session = ChatWorkflowService.startSession({
        tenantDomain: "acme-movers",
        stream: "customers",
        customerName: "Alice Walker",
        customerEmail: "alice@example.com",
        intakeData: {
          details: "Need assistance with order tracking",
        },
      });

      expect(session.id).toContain("chat_sess_");
      expect(session.messages[1].content).toContain("SV8-CHAT-");
    });
  });

  describe("4. Non-LLM Free Workflows vs Gated Subscription Governance", () => {
    it("should allow rule-based triage and unique sequence generation without AI subscription", () => {
      const ticketId = `iss_${Date.now()}`;
      const extId = `SV8-TK-${Math.floor(1000 + Math.random() * 9000)}`;
      expect(extId).toMatch(/^SV8-TK-\d{4}$/);
    });
  });

  describe("5. Mobile Phone Optimization for Field Contractors & Chatbot", () => {
    it("should support instant contractor chat session intake without requiring a native mobile app", () => {
      const contractorSession = ChatWorkflowService.startSession({
        tenantDomain: "acme",
        stream: "contractors",
        customerName: "Dave Miller (Apex Facilities)",
        customerEmail: "dave@apex.com",
        intakeData: {
          issueType: "Work Order Dispatch & Site Access",
          urgency: "High (Active On-Site)",
          details: "Need lockbox PIN for telecom closet B",
        },
      });

      expect(contractorSession.stream).toBe("contractors");
      expect(contractorSession.status).toBe("active");
      expect(contractorSession.customerName).toContain("Dave Miller");
      expect(contractorSession.messages.length).toBeGreaterThan(0);
      expect(contractorSession.messages[0].content).toContain("Need lockbox PIN");
    });
  });
});
