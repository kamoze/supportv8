# Design Spec: Mobile Access PWA & Client Email/OTP Authentication

**Date**: 2026-10-03  
**Status**: Approved (Brainstorming Complete)  
**Target Subsystems**: Mobile PWA Shell, Client Email/OTP Authentication, Client Ticket Tracking, Mobile Chat  

---

## 1. Executive Summary & Goals

This specification defines the architecture and implementation for **Mobile Access** in SupportV8:
1. **Progressive Web App (PWA) Infrastructure**: Enable customers/clients to install the Support portal onto their mobile devices (iOS & Android) with standalone display mode, custom theme colors, service worker caching, and an app-like navigation bar.
2. **Client Email/OTP Authentication**: Allow clients to securely log into their account without password fatigue using a 6-digit one-time password dispatched to their email address, scoped strictly to the tenant workspace.
3. **Authenticated Mobile Chat**: Enable clients to engage directly in real-time support chat from mobile devices with zero-friction pre-authentication (skipping intake forms when logged in) and instant audio feedback.
4. **Client Request & Ticket Tracking**: Provide authenticated clients with a dedicated "Requests" tab to monitor the live status of their active cases, with one-tap transition into chat for any specific ticket.

---

## 2. PWA Infrastructure & Mobile App Shell

### 2.1 Web App Manifest (`public/manifest.webmanifest`)
- **Metadata**:
  - `name`: Tenant-branded application name (e.g. `Acme Client Support`, defaulting to `SupportV8 Client Portal`).
  - `short_name`: `Support`.
  - `start_url`: `/?source=pwa`.
  - `display`: `standalone` (removes mobile browser navigation bar and URL input for full native app experience).
  - `background_color`: `#090E15`.
  - `theme_color`: `#0B1017`.
  - `orientation`: `portrait-primary`.
  - `icons`:
    - `192x192`: SVG/PNG icon for mobile home screens.
    - `512x512`: High-resolution maskable icon for splash screens and app switchers.

### 2.2 Layout & Meta Tags (`src/app/layout.tsx`)
- Include essential mobile PWA meta tags:
  - `<meta name="mobile-web-app-capable" content="yes" />`
  - `<meta name="apple-mobile-web-app-capable" content="yes" />`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`
  - `<link rel="manifest" href="/manifest.webmanifest" />`

### 2.3 Service Worker (`public/sw.js`)
- Pre-caches core static assets: fonts, icons, CSS tokens, and offline fallback shell.
- Network-first caching strategy for dynamic API routes (`/api/portal/*`, `/api/chat/*`).
- Cache-first strategy for static image and font assets.
- Graceful offline fallback page when connectivity is lost.

### 2.4 Mobile App Shell & Bottom Navigation Dock
- On viewports `< 768px` (mobile), the client view activates the mobile app shell:
  - Header: Displays tenant logo, support name, and verification badge.
  - PWA Install Banner: Dismissible banner prompting mobile Safari/Chrome users to "Add to Home Screen".
  - Bottom Navigation Dock (fixed above `env(safe-area-inset-bottom)`):
    - **Chat**: Live conversational messaging with AI and support staff.
    - **Requests**: Status dashboard of customer's active and resolved tickets.
    - **Help**: Instant search across published knowledge runbooks.
    - **Account**: Email/OTP sign-in, active session information, and contact preferences.

---

## 3. Client Authentication Subsystem (Email + OTP)

### 3.1 Extended OTP Engine (`src/lib/auth/otp-store.ts`)
- Add purpose `"client-access"` to `OtpPurpose`.
- Generate 6-digit cryptographically secure verification code (`randomInt(100_000, 1_000_000)`).
- Hash storage with `scrypt` salt and 10-minute TTL.
- Enforce strict brute-force limits: maximum 5 verification attempts before invalidating the code.
- Rate limiting: max 3 codes per email per 10 minutes, max 10 codes per IP per 10 minutes.

### 3.2 Email Delivery Service (`src/lib/services/resend-service.ts`)
- Use `ResendService.dispatchOtpEmail`:
  - Scoped to `(email, tenantSlug)`.
  - Content specifies tenant support name and clear 6-digit code.
  - Safe fallback for test/offline environments with `debugCode` exposed only under `process.env.NODE_ENV === "test"`.

### 3.3 Client Auth Endpoints

#### `POST /api/portal/auth/otp/send`
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "tenantSlug": "acme"
  }
  ```
- **Validation**:
  - Validates RFC-compliant email address.
  - Validates tenant existence.
  - Enforces IP and email rate limits.
- **Response**:
  ```json
  {
    "success": true,
    "message": "A 6-digit verification code has been dispatched to customer@example.com.",
    "email": "customer@example.com"
  }
  ```

#### `POST /api/portal/auth/otp/verify`
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "code": "849120",
    "tenantSlug": "acme"
  }
  ```
- **Verification Logic**:
  - Verifies code using `otpStore.verify("client-access", email, code, tenantSlug)`.
  - Resolves or creates customer entity in `supportv8.customers` matching `email`.
  - Signs client session token `supportv8_client_token` embedding `{ email, tenantSlug, customerId }`.
  - Sets secure cookie and returns token in response payload.
- **Response**:
  ```json
  {
    "success": true,
    "clientToken": "<jwt_or_signed_token>",
    "customer": {
      "id": "cust_12345",
      "name": "Sarah Jenkins",
      "email": "customer@example.com",
      "company": "Acme Corp",
      "activeTicketsCount": 2
    }
  }
  ```

#### `GET /api/portal/auth/me`
- Validates the client session token from `Authorization: Bearer <token>` or cookie.
- Returns current customer identity, active tickets count, and verified status.

---

## 4. Mobile Chat & Ticket Tracking Integration

### 4.1 Authenticated Mobile Chat (`src/components/chat/SupportChatWidget.tsx`)
- **Intake Form Bypass**:
  - When a client is logged in, their verified name and email are automatically bound to the chat session.
  - The initial intake questionnaire is skipped, immediately launching into the active conversation stream.
- **Dynamic Mobile Viewport**:
  - Uses CSS dynamic viewport units (`100dvh`) to prevent iOS/Android on-screen keyboard from hiding the input bar.
  - Seamlessly docks above the bottom navigation bar.
- **Session Persistence**:
  - Stores `clientChatSessionId` in `localStorage` scoped by tenant.
  - Automatically recovers conversation upon mobile app background/foreground transitions.

### 4.2 Client Ticket Tracking (`/api/portal/tickets`)
- **Endpoint `GET /api/portal/tickets`**:
  - Requires authenticated client session.
  - Queries `supportv8.issues` filtered by `customer_email = $1 AND tenant_id = $2`.
  - Returns:
    ```json
    {
      "success": true,
      "tickets": [
        {
          "id": "TCK-8821",
          "title": "Order refund review and token credit",
          "status": "In progress",
          "updatedAt": "12 minutes ago",
          "assignedTo": "Customer Success",
          "publicNotes": "Your refund is being processed."
        }
      ]
    }
    ```
- **One-Tap Chat Link**:
  - Each ticket card features a **"Chat About Case"** action that switches to the Chat tab with `topic: "Ticket TCK-8821"` pre-filled.
- **Unauthenticated Fallback**:
  - Prompts customer to sign in via Email/OTP to view full history, while retaining the single ticket reference tracker (`TCK-8821`, `WO-7741`).

---

## 5. Security & Boundary Isolation

1. **Strict Tenant Scoping**:
   - A client session token for `acme` cannot access tickets, chat, or auth state in `meridian` or any other tenant.
2. **Least Privilege Client Access**:
   - Client tokens can only read their own tickets and interact with customer-facing chat streams. Internal operator queues, admin endpoints, and team settings remain completely inaccessible.
3. **Brute Force & Rate Limit Protection**:
   - 5 attempts per OTP code before revocation.
   - Per-IP and per-email rate limiting on OTP issuance.
4. **Zero Password Storage**:
   - Authentication is purely ephemeral and token-based via OTP.

---

## 6. Verification & Test Plan

1. **Unit & Integration Tests**:
   - `test/portal-client-otp-auth.test.ts`:
     - Test OTP issue rate limits and store backend.
     - Test verification with correct and incorrect codes.
     - Test token generation, tenant isolation, and `/api/portal/auth/me`.
   - `test/portal-client-tickets.test.ts`:
     - Verify client can only retrieve tickets linked to their verified email.
     - Verify unauthenticated requests return 401.
   - `test/pwa-mobile-manifest.test.ts`:
     - Verify `manifest.webmanifest` contains valid PWA keys (name, display: standalone, icons, theme_color).
     - Verify service worker static asset caching.
2. **Invariants**:
   - Lines 1831–2033 in `src/app/page.tsx` must **NEVER** be modified.
   - UI titles and labels $\le 2$ words.
   - Zero emojis or raw unicode arrows (only modern FlatIcons).
   - Full test suite passes with 0 regressions.
