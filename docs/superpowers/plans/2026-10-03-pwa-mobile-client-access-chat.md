# Mobile Access PWA & Client Email/OTP Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Progressive Web App (PWA) capabilities and client-facing Email/OTP authentication, enabling mobile clients to engage seamlessly in support chat, view their active tickets, and install the portal as a native app.

**Architecture:** Progressive Web App shell with Web App Manifest and Service Worker caching; dedicated Email/OTP authentication endpoint subsystem (`/api/portal/auth/otp/*`) backed by `OtpStore` with purpose `"client-access"`; client-scoped HMAC session tokens; authenticated tickets retrieval API (`/api/portal/tickets`); and a mobile-optimized client navigation dock (`MobileClientAppShell`) integrating with `SupportChatWidget`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Web App Manifest, Service Workers, FlatIcons (`@/components/ui/FlatIcon`), Node crypto (scrypt/HMAC).

**Spec:** [docs/superpowers/specs/2026-10-03-pwa-mobile-client-access-chat-design.md](file:///Users/inigodwin/Developer/GitCode/supportv8/docs/superpowers/specs/2026-10-03-pwa-mobile-client-access-chat-design.md)

## Global Constraints

- Lines 1831–2033 in `src/app/page.tsx` must **NEVER** be modified.
- All UI titles and button labels must be $\le 2$ words.
- Zero emojis, unicode arrows, or raw symbols across UI components (only modern FlatIcons).
- Full test suite must pass with 0 regressions.

---

### Task 1: PWA Core Assets & Metadata

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx:1-45`
- Test: `test/pwa-manifest-and-sw.test.ts`

**Interfaces:**
- Consumes: Static asset paths (`/favicon.svg`)
- Produces: Valid Web App Manifest route `/manifest.webmanifest`, Service Worker `/sw.js`, and PWA meta tags in root layout.

- [ ] **Step 1: Write failing test for PWA manifest and service worker**

Create `test/pwa-manifest-and-sw.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA Manifest & Service Worker", () => {
  it("provides a valid Web App Manifest with required PWA fields", () => {
    const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("SupportV8 Client Portal");
    expect(manifest.short_name).toBe("Support");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/?source=pwa");
    expect(manifest.theme_color).toBe("#0B1017");
    expect(manifest.background_color).toBe("#090E15");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("provides a service worker script for offline shell caching", () => {
    const swPath = resolve(process.cwd(), "public/sw.js");
    expect(existsSync(swPath)).toBe(true);

    const content = readFileSync(swPath, "utf-8");
    expect(content).toContain("addEventListener('install'");
    expect(content).toContain("addEventListener('fetch'");
  });

  it("includes PWA meta tags and manifest link in root layout", () => {
    const layoutPath = resolve(process.cwd(), "src/app/layout.tsx");
    const content = readFileSync(layoutPath, "utf-8");

    expect(content).toContain('rel="manifest"');
    expect(content).toContain('href="/manifest.webmanifest"');
    expect(content).toContain('name="mobile-web-app-capable"');
    expect(content).toContain('name="apple-mobile-web-app-capable"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/pwa-manifest-and-sw.test.ts`  
Expected: FAIL (files do not exist yet)

- [ ] **Step 3: Implement Web App Manifest, Service Worker, and Layout Meta Tags**

1. Create `public/manifest.webmanifest`:
```json
{
  "name": "SupportV8 Client Portal",
  "short_name": "Support",
  "description": "Enterprise customer support intelligence and mobile client portal.",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#090E15",
  "theme_color": "#0B1017",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/favicon.svg",
      "sizes": "192x192 512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

2. Create `public/sw.js`:
```javascript
const CACHE_NAME = 'supportv8-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/family-theme.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Dynamic API and chat streaming requests always bypass cache
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
```

3. Update `src/app/layout.tsx` to include manifest link, mobile web app tags, and service worker registration script.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/pwa-manifest-and-sw.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/sw.js src/app/layout.tsx test/pwa-manifest-and-sw.test.ts
git commit -m "feat(pwa): add web app manifest, service worker, and mobile layout meta tags"
```

---

### Task 2: Client OTP Auth Backend & API Endpoints

**Files:**
- Modify: `src/lib/auth/otp-store.ts:10` (add `"client-access"` to `OtpPurpose`)
- Create: `src/lib/auth/client-token.ts`
- Create: `src/app/api/portal/auth/otp/send/route.ts`
- Create: `src/app/api/portal/auth/otp/verify/route.ts`
- Create: `src/app/api/portal/auth/me/route.ts`
- Test: `test/portal-client-otp-auth.test.ts`

**Interfaces:**
- Consumes: `otpStore.issue`, `otpStore.verify`, `otpStore.enforceIssueRateLimit`, `ResendService.dispatchOtpEmail`
- Produces:
  - `signClientToken(payload: ClientTokenPayload): string`
  - `verifyClientToken(token: string): ClientTokenPayload | null`
  - `POST /api/portal/auth/otp/send` -> `{ success: true, email, message }`
  - `POST /api/portal/auth/otp/verify` -> `{ success: true, clientToken, customer }`
  - `GET /api/portal/auth/me` -> `{ success: true, authenticated: true, customer }`

- [ ] **Step 1: Write failing test for Client OTP Auth endpoints**

Create `test/portal-client-otp-auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signClientToken, verifyClientToken } from "@/lib/auth/client-token";
import { POST as sendOtpHandler } from "@/app/api/portal/auth/otp/send/route";
import { POST as verifyOtpHandler } from "@/app/api/portal/auth/otp/verify/route";
import { GET as meHandler } from "@/app/api/portal/auth/me/route";
import { NextRequest } from "next/server";
import { otpStore } from "@/lib/auth/otp-store";

describe("Client OTP Auth Subsystem", () => {
  const tenantSlug = "acme";
  const email = "client@example.com";

  it("signs and verifies client session tokens with HMAC integrity", () => {
    const payload = {
      email,
      tenantSlug,
      customerId: "cust_12345",
      name: "Sarah Client",
      company: "Acme Client Corp",
    };

    const token = signClientToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = verifyClientToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(email);
    expect(verified?.tenantSlug).toBe(tenantSlug);
    expect(verified?.customerId).toBe("cust_12345");
  });

  it("rejects tampered client tokens", () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifyClientToken(tampered)).toBeNull();
  });

  it("handles POST /api/portal/auth/otp/send successfully", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email, tenantSlug }),
    });

    const res = await sendOtpHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.email).toBe(email);
    expect(body.debugCode).toBeDefined();
  });

  it("handles POST /api/portal/auth/otp/verify and issues client token", async () => {
    // 1. Issue code
    const code = await otpStore.issue("client-access", email, tenantSlug);

    // 2. Verify code
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, tenantSlug }),
    });

    const res = await verifyOtpHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.clientToken).toBeDefined();
    expect(body.customer.email).toBe(email);
  });

  it("validates client session with GET /api/portal/auth/me", async () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1", name: "Sarah Client" });
    const req = new NextRequest("http://localhost:3000/api/portal/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await meHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.customer.email).toBe(email);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/portal-client-otp-auth.test.ts`  
Expected: FAIL (modules not found / not implemented)

- [ ] **Step 3: Implement client token utility and auth routes**

1. Update `src/lib/auth/otp-store.ts`:
   Change line 10 to:
   ```typescript
   export type OtpPurpose = "signup" | "password-recovery" | "client-access";
   ```

2. Create `src/lib/auth/client-token.ts`:
   Implement cryptographic HMAC token creation with 30-day expiry and strict tenant verification.

3. Create `src/app/api/portal/auth/otp/send/route.ts`:
   Implement rate limiting, `otpStore.issue("client-access", email, tenantSlug)`, Resend dispatch, and return JSON.

4. Create `src/app/api/portal/auth/otp/verify/route.ts`:
   Implement `otpStore.verify("client-access", email, code, tenantSlug)`, lookup customer in `db.customers` by email, generate client token, set cookie, and return customer data.

5. Create `src/app/api/portal/auth/me/route.ts`:
   Extract token from `Authorization` header or cookie, verify, and return customer profile.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/portal-client-otp-auth.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/otp-store.ts src/lib/auth/client-token.ts src/app/api/portal/auth/ test/portal-client-otp-auth.test.ts
git commit -m "feat(auth): implement client email/otp authentication and session token verification"
```

---

### Task 3: Client Tickets & Request Tracking API

**Files:**
- Create: `src/app/api/portal/tickets/route.ts`
- Test: `test/portal-client-tickets.test.ts`

**Interfaces:**
- Consumes: `verifyClientToken`, `db.issues`
- Produces: `GET /api/portal/tickets` -> `{ success: true, tickets: ClientTicketSummary[] }`

- [ ] **Step 1: Write failing test for customer tickets API**

Create `test/portal-client-tickets.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { GET as ticketsHandler } from "@/app/api/portal/tickets/route";
import { signClientToken } from "@/lib/auth/client-token";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/mock-data";

describe("Client Tickets API", () => {
  const tenantSlug = "acme";
  const email = "sarah.jenkins@acme-corp.com";

  it("returns 401 Unauthorized when no client token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/tickets");
    const res = await ticketsHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns tickets filtered by authenticated client email", async () => {
    // Ensure test customer issue exists
    if (!db.issues.some((i) => i.customerEmail === email)) {
      db.issues.push({
        id: "TCK-8821",
        title: "Order refund review and token credit",
        status: "in_progress",
        priority: "p2",
        customerName: "Sarah Jenkins",
        customerEmail: email,
        tenantId: "tenant_acme",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await ticketsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.tickets)).toBe(true);
    expect(body.tickets.some((t: any) => t.id === "TCK-8821")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/portal-client-tickets.test.ts`  
Expected: FAIL (route does not exist)

- [ ] **Step 3: Implement `src/app/api/portal/tickets/route.ts`**

Read token from `Authorization` header or cookie `supportv8_client_token`. Query `db.issues` matching `customerEmail` (or in Postgres if `DATABASE_URL` is set). Map to public client summaries with `id`, `title`, `status`, `updatedAt`, `assignedTo`, and `publicNotes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/portal-client-tickets.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/tickets/route.ts test/portal-client-tickets.test.ts
git commit -m "feat(portal): add client tickets tracking api scoped by customer email"
```

---

### Task 4: Mobile Client App Shell & Bottom Navigation in Tenant Portal

**Files:**
- Create: `src/components/portal/MobileClientAppShell.tsx`
- Modify: `src/components/TenantLandingView.tsx`
- Test: `test/mobile-client-app-shell.test.tsx`

**Interfaces:**
- Consumes: `signClientToken`, `verifyClientToken`, FlatIcons (`MessageSquare`, `ListOrdered`, `HelpCircle`, `User`), FlatIcon component
- Produces: `<MobileClientAppShell />` rendering mobile bottom dock with tabs:
  - `Chat` (opens / embeds chat)
  - `Requests` (shows customer ticket list or OTP login prompt)
  - `Help` (scrolls to help search / actions)
  - `Account` (shows verified email, active token, logout or OTP login modal)

- [ ] **Step 1: Write failing component test**

Create `test/mobile-client-app-shell.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MobileClientAppShell } from "@/components/portal/MobileClientAppShell";

describe("MobileClientAppShell", () => {
  it("renders bottom navigation tabs with concise labels", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    expect(screen.getByText("Chat")).toBeDefined();
    expect(screen.getByText("Requests")).toBeDefined();
    expect(screen.getByText("Help")).toBeDefined();
    expect(screen.getByText("Account")).toBeDefined();
  });

  it("opens OTP login modal when Account tab is tapped while unauthenticated", () => {
    render(
      <MobileClientAppShell
        tenantSlug="acme"
        onOpenChat={vi.fn()}
        onOpenHelp={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Account"));
    expect(screen.getByPlaceholderText("client@company.com")).toBeDefined();
    expect(screen.getByText("Verify")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mobile-client-app-shell.test.tsx`  
Expected: FAIL (component not found)

- [ ] **Step 3: Implement `MobileClientAppShell.tsx` and integrate into `TenantLandingView.tsx`**

1. Create `src/components/portal/MobileClientAppShell.tsx`:
   - State for `activeTab`: `"chat" | "requests" | "help" | "account"`.
   - Client token management (`localStorage.getItem("supportv8_client_token")`).
   - OTP input and verification flow with 6-digit input and Resend cooldown timer.
   - Ticket list view rendering customer tickets fetched from `/api/portal/tickets`.
   - Fixed bottom navigation bar with `@/components/ui/FlatIcon` icons.
   - PWA Install prompt handler (`window.addEventListener("beforeinstallprompt")`).
2. Update `src/components/TenantLandingView.tsx`:
   - Render `<MobileClientAppShell />` alongside the existing desktop layout.
   - Support smooth tab jumping between help, tickets, and chat.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/mobile-client-app-shell.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/MobileClientAppShell.tsx src/components/TenantLandingView.tsx test/mobile-client-app-shell.test.tsx
git commit -m "feat(mobile): add mobile client app shell and bottom navigation dock"
```

---

### Task 5: Mobile Chat Auto-Authentication & Keyboard Layout Optimization

**Files:**
- Modify: `src/components/chat/SupportChatWidget.tsx`
- Test: `test/mobile-chat-widget.test.tsx`

**Interfaces:**
- Consumes: `supportv8:client-authenticated` custom event, client token
- Produces: Chat widget automatically pre-populates verified customer identity and skips intake form; supports mobile `100dvh` layout and dock height offset.

- [ ] **Step 1: Write failing test for authenticated mobile chat behavior**

Create `test/mobile-chat-widget.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";

describe("SupportChatWidget Mobile Client Auth", () => {
  it("bypasses intake form when pre-authenticated client identity is present", () => {
    localStorage.setItem(
      "supportv8_client_session_acme",
      JSON.stringify({
        email: "sarah@jenkins.com",
        name: "Sarah Jenkins",
        tenantSlug: "acme",
      })
    );

    render(<SupportChatWidget tenantSlug="acme" />);

    // Trigger open chat event
    act(() => {
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
    });

    // In authenticated state, customer name & email inputs are bypassed directly to chat message input
    expect(screen.queryByPlaceholderText("Your full name")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mobile-chat-widget.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Update `SupportChatWidget.tsx`**

- On mount, check `localStorage` for `supportv8_client_session_${tenantSlug}` or listen for `supportv8:client-authenticated`.
- If client identity is present, initialize session with `name` and `email` pre-set and `activeStep` set directly to `"chat"`.
- Apply dynamic viewport height styling (`max-h-[calc(100dvh-5rem)]` on mobile) to accommodate on-screen keyboards and bottom dock navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/mobile-chat-widget.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/SupportChatWidget.tsx test/mobile-chat-widget.test.tsx
git commit -m "feat(chat): bypass intake form for authenticated mobile clients and optimize mobile dvh viewport"
```

---

### Task 6: End-to-End Verification & Full Regression Run

**Files:**
- Test all new test suites
- Full `npm test`
- Typecheck: `npx tsc --noEmit`
- Verify invariants:
  - Lines 1831–2033 in `src/app/page.tsx` remain untouched.
  - UI labels and titles $\le 2$ words.
  - Zero emojis or raw unicode arrows (modern FlatIcons only).

- [ ] **Step 1: Run all new PWA and Client Auth tests**

Run:
```bash
npx vitest run test/pwa-manifest-and-sw.test.ts test/portal-client-otp-auth.test.ts test/portal-client-tickets.test.ts test/mobile-client-app-shell.test.tsx test/mobile-chat-widget.test.tsx
```
Expected: PASS (all tests pass)

- [ ] **Step 2: Run full test suite**

Run: `npm test`  
Expected: PASS (all 850+ tests pass with zero regressions)

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`  
Expected: 0 errors

- [ ] **Step 4: Commit and push**

```bash
git push origin main
```
