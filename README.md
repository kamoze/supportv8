# supportV8 — AI Customer Support Intelligence & Governed Automation

[![CI & Build Validation](https://github.com/kamoze/supportv8/actions/workflows/ci.yml/badge.svg)](https://github.com/kamoze/supportv8/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker-redoosolutions%2Fsupportv8-blue.svg)](https://hub.docker.com/r/redoosolutions/supportv8)
[![Domain](https://img.shields.io/badge/domain-support.servicev8.com-teal.svg)](https://support.servicev8.com)

**supportV8** is the enterprise AI customer support intelligence, interaction, and governed automation layer for the **ServiceV8** agentic operating system.

---

## 🚀 Key Capabilities

1. **Focused Agentic Resolution Work Desk (`/workspace`)**:
   - 3-Pane live omnichannel resolution queue (Chat, Email, Telephony).
   - Customer 360 ARR context ($420k ARR, lifetime ticket timeline).
   - Autonomous 1-click OrderV8 refund token dispatcher and cross-vertical handoffs.

2. **Knowledge Suite & Semantic Topology Graph (`/knowledge`)**:
   - Direct S3 Vault document upload (`.pdf`, `.docx`, `.xlsx`, `.md`, `.json`, `.csv`).
   - KnowledgeV8-aligned concept curation & RBAC group tagging (`support-tier1`, `finance-billing`, `infra-ops`).
   - In-place RAG retrieval chunk editor with 1536-dim vector re-embedding.
   - GrowthV8-inspired 2D cluster force topology canvas and columnar lifecycle trace flow.

3. **Governance & AI Safety Controls (`/governance`)**:
   - **BYOM (Bring Your Own Model)**: Route to Anthropic Claude 3.5, OpenAI GPT-4o, Google Gemini, Groq, or Local Ollama.
   - **Vector Embeddings**: Configurable 384, 1024, 1536, or 3072-dim embeddings (OpenAI, Voyage, Cohere, FastEmbed).
   - **ForgeGW (Action Gateway)**: Zero-trust cryptographic execution proxy with mandatory `X-Idempotency-Key` and mutual TLS (mTLS).
   - **Full Immutable Audit Logs**: SHA-256 hash chaining and raw JSON payload inspection.

4. **Multi-Tenant Global Portal (`/signup`)**:
   - Instant subdomain slug provisioning (`https://[subdomain].support.servicev8.com`).
   - Visual password strength scoring and math challenge verification.
   - 5-Stage cloud provisioning stepper (PostgreSQL RLS, Redis cache, Keycloak realm).

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 15 (App Router, Standalone output)
- **Runtime**: Node.js 22 LTS / Bun
- **Styling**: Vanilla CSS + Tailwind design tokens (Dark Obsidian `#0B1017`, Radiant Electric Teal `#2ED8B6`)
- **Vectors**: PostgreSQL `pgvector` (1536-dim cosine similarity embeddings)
- **Chat system of record**: PostgreSQL (`supportv8.chat_sessions`, `chat_messages`, `workdesk_items`, and transactional `chat_outbox`)
- **Tenant boundary**: verified Keycloak `tenant_id` claim + forced PostgreSQL RLS; Redis is transient only
- **Container**: Multi-stage lightweight Alpine Docker image (`redoosolutions/supportv8:web-latest`)
- **Ingress URL**: `https://support.servicev8.com`

---

## 🐳 Docker & Local Development

### Run Locally:
```bash
# Install dependencies
npm install

# Run Vitest test suite
npx vitest run

# Start development server
PORT=3005 npm run dev
```

### Build Docker Container:
```bash
docker build -t redoosolutions/supportv8:web-latest .
docker run -p 3005:3005 redoosolutions/supportv8:web-latest
```

---

## ☸️ Kubernetes & Production Ingress

Deployed via `servicev8-devops/apps/supportv8`:
- **Domain**: `https://support.servicev8.com`
- **Wildcard Subdomains**: `https://*.support.servicev8.com`
- **Internal Service**: `http://supportv8.default.svc.cluster.local:3005`
- **Certificates**: Let's Encrypt automated TLS via cert-manager.

Chat writes connect as the least-privilege `supportv8_app` role through
PgBouncer on port 6432. Each operation starts a transaction and sets
`app.current_tenant_id` locally before issuing any query. Customer chat is
scoped by the hosted tenant domain; operator work-desk access requires a
verified SupportV8 Keycloak access token carrying the matching `tenant_id`.
Operator routes also require an explicit `support_operator`, `support_cx_lead`,
or `support_superadmin` realm role. WhatsApp and email ingress fail closed by
default; WhatsApp verifies Meta's raw-body HMAC before parsing, while email
remains disabled until a provider-specific verifier is configured.

---

## 📄 License
Proprietary & Confidential — ServiceV8 Enterprise Infrastructure.
