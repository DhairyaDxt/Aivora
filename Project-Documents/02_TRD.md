# Technical Requirements Document (TRD)
## BizPilot — Architecture & Technical Design
*Version 1.0, July 2026*

---

## 1. Guiding Principles

1. **API-first, modular monolith to start.** Don't over-engineer microservices before you have the load to justify them. Split out only the pieces with genuinely different scaling/runtime needs (voice media handling, AI orchestration).
2. **OAuth/managed-provisioning over manual keys, everywhere possible** (drives the credential design in PRD §5).
3. **Security by design:** secrets never touch application DB in plaintext; tenant isolation enforced at the database layer, not just the application layer.
4. **Every customer-facing service has a sandbox twin** (Preview mode) that exercises the same code path as production without sending real messages/calls or costing real money.
5. **Build vs. buy is a first-class decision**, not an afterthought — see Implementation Plan §2 for the full analysis. This TRD describes the "build most of it" path but flags the "buy the hard part" alternative at each relevant point.

---

## 2. High-Level Architecture

(See the architecture diagram above.)

- **Client layer:** Owner Dashboard (web app), and three customer-facing channels: phone call, WhatsApp, website chat/booking widget.
- **Platform core:**
  - **AI Orchestration Service** — owns the conversation loop: retrieves knowledge base context (RAG), calls the LLM, calls tools (check availability, book appointment, transfer to human), and adapts output per channel (text for WhatsApp/web, audio for voice).
  - **Booking Engine** — availability computation, conflict prevention, reminders, calendar sync.
  - **Storage & Vault** — tenant data, conversation logs, and the encrypted credential vault.
- **External integrations:** Twilio (voice + numbers), Meta WhatsApp Cloud API, LLM/STT/TTS providers, Google/Microsoft Calendar, Stripe/Razorpay.

---

## 3. Tech Stack Recommendation

| Layer | Recommendation | Why |
|---|---|---|
| Dashboard frontend | Next.js + TypeScript, TailwindCSS, shadcn/ui | Fast iteration, good DX, SSR for marketing/onboarding pages |
| Embeddable widgets (chat/booking on customer sites) | Vanilla JS / lightweight web component | Must be tiny and framework-agnostic to embed on any customer site |
| Core backend API | Node.js (NestJS), TypeScript | Excellent for webhook-heavy, I/O-bound workloads (Twilio/Meta webhooks); shares types with frontend |
| AI orchestration service | Python (FastAPI) | Best ecosystem for LLM orchestration, embeddings, RAG tooling; talks to core API over internal REST/gRPC |
| Primary database | PostgreSQL (+ `pgvector` extension) | Relational integrity for tenants/bookings; pgvector avoids running a separate vector DB early on |
| Cache / queue | Redis (cache, rate limiting, Redis Streams for async jobs) | Simple, proven, low-ops |
| Object storage | S3-compatible (AWS S3 / Cloudflare R2) | Call recordings, transcripts, uploaded assets, website media |
| Secrets management | AWS KMS / GCP Secret Manager, or HashiCorp Vault at larger scale | Envelope encryption; app DB stores only references, never raw secrets |
| Auth | Clerk / Auth0, or NextAuth if rolling your own | Email/OTP + Google/Microsoft SSO; avoid building auth from scratch |
| Infra | Start on managed platforms (Render/Railway/Fly.io) → migrate to Kubernetes (EKS/GKE) once concurrency demands it | Don't build for scale you don't have yet |
| IaC | Terraform | Reproducible environments |
| Observability | OpenTelemetry + Grafana/Prometheus (or Datadog), Sentry for errors | Voice latency and webhook failures need first-class tracing |
| CI/CD | GitHub Actions, preview deployments per PR for the dashboard | |
| Payments | Stripe (global) + Razorpay (India) | Dual-provider by tenant region |

---

## 4. Voice AI Pipeline — Two Paths

**Path A — build it yourself:**
Twilio Voice (Media Streams) → real-time STT (Deepgram) → LLM (configurable, e.g. a fast/cheap model for simple turns, escalate to a stronger model for complex ones) → real-time TTS (ElevenLabs or Azure/Google Neural) → back to Twilio.
- Pros: full control, cost optimization at scale.
- Cons: you own latency tuning, interruption/barge-in handling, voicemail detection — this is the single hardest part of the whole product to get *feeling natural*.

**Path B — use a managed voice-AI orchestration layer under the hood** (e.g. Twilio's own ConversationRelay combined with a realtime LLM API, or a dedicated voice-AI infra provider) and build BizPilot's business logic (knowledge base, booking, persona config) as the layer on top.
- Pros: dramatically faster time-to-market, latency already solved by a specialist.
- Cons: less pricing control, vendor dependency for the core experience.

**Recommendation:** prototype Path B first to validate product-market fit fast; revisit Path A once voice minutes justify the engineering investment in owning the pipeline. This decision materially changes the Implementation Plan timeline — see that document's Build vs. Buy section.

Regardless of path: every voice interaction opens with a mandatory AI-disclosure line, and recording consent is jurisdiction-aware (see §8).

---

## 5. WhatsApp Integration Architecture

- Platform registers as a **Meta Tech Provider / Solution Partner**, enabling **Embedded Signup**: the tenant clicks "Connect with Facebook," authorizes via a Meta-hosted popup, and the platform receives a long-lived System User token behind the scenes — the tenant never sees or copies a raw key.
- Fallback: manual System User token entry (WABA ID, Phone Number ID, access token, app secret) for tenants migrating from another BSP.
- **Alternative worth evaluating:** route through a Business Solution Provider (Gupshup, 360dialog, Twilio's WhatsApp API) instead of direct Meta Cloud API. A BSP simplifies business verification and onboarding at the cost of a per-message markup — good for MVP speed, revisit direct integration at scale.
- Message flow: inbound webhook → AI Orchestration Service (with knowledge base context) → outbound via Cloud API, respecting the 24-hour customer-service-window rule (free-form replies inside the window, approved templates required outside it).
- Template messages (reminders, confirmations) are composed in-app and submitted to Meta for approval via API; approval status is polled and surfaced in the dashboard.

---

## 6. Security Architecture

- **Tenant isolation:** every table carries `org_id`; PostgreSQL Row-Level Security (RLS) policies enforce isolation at the database layer as defense-in-depth beyond application-level checks.
- **Secrets vault:** credentials table stores only a `secret_ref` pointing to a KMS/Vault-encrypted value — never the raw token, Account SID, or Auth Token. Per-tenant encryption keys where feasible.
- **Encryption:** TLS 1.3 in transit, AES-256 at rest.
- **RBAC:** Owner/Admin/Agent/Viewer roles enforced at the API layer, not just the UI.
- **Rate limiting & abuse protection:** per-tenant and per-IP rate limits on webhook and API endpoints; abuse queue in the internal Admin Panel for flagged conversations.
- **Prompt injection mitigation:** system prompts hardened against customer-supplied text trying to override instructions (e.g. a WhatsApp message saying "ignore previous instructions"); tool-calling scoped so the LLM can never execute anything beyond the explicit booking/FAQ/transfer tool set.
- **PII handling:** transcripts and call recordings are scanned/redacted for payment card numbers; healthcare-vertical tenants are flagged as requiring a higher compliance tier (see §8).
- **Audit log:** every credential change, service deploy, and billing change is recorded with actor, timestamp, and before/after state.

---

## 7. Scalability & Performance

- **Voice concurrency:** media/AI worker processes scale horizontally behind a queue; set a per-tenant concurrent-call cap tied to plan tier to bound cost exposure.
- **WhatsApp webhook processing:** must acknowledge Meta's webhook within its required response window, then process asynchronously via a queue — never process synchronously inside the webhook handler.
- **Website delivery:** static assets served via CDN; each tenant site is pre-built/rendered rather than server-rendered per request where possible.
- **Database:** read replicas for analytics queries so reporting never contends with transactional booking writes.

---

## 8. Compliance & Regulatory (technical requirements)

| Requirement | Technical handling |
|---|---|
| Call recording consent | Configurable disclosure greeting injected at call start; region-aware default (stricter default in two-party-consent jurisdictions) |
| AI-agent disclosure | Same greeting mechanism; increasingly required by emerging AI-disclosure regulations for voice/chat bots |
| WhatsApp opt-in | Booking/contact forms capture explicit opt-in before any proactive (template) message is scheduled |
| India — SMS/voice registration (DLT via TRAI) | Guided checklist in-app; the registration itself happens on the government/telecom portal directly and can't be automated — platform stores the resulting entity/template IDs once obtained |
| US — 10DLC registration for A2P messaging | Automate submission via Twilio's registration APIs where the tenant is a US entity |
| Data deletion (GDPR "right to be forgotten," India DPDP Act) | Admin tool to purge a specific customer's conversation/call/booking data on request, with cascading deletion across Postgres, object storage, and vector index |
| Healthcare vertical (HIPAA-adjacent, US) | Flag as a separate compliance tier requiring BAA-eligible sub-processors; not all AI/voice vendors offer BAAs — vendor selection differs for this tier |

---

## 9. Environments

- **dev / staging / prod** — standard separation, staging mirrors prod with sandboxed third-party credentials (Twilio/Meta test numbers).
- **Tenant sandbox (Preview mode):** a flagged execution mode that runs the identical AI Orchestration and Booking Engine code paths as production, but writes to a `is_sandbox=true` partition of conversation/appointment data, never sends real WhatsApp/SMS/calls, and doesn't count toward billing usage. This is what powers the in-browser test call, the simulated WhatsApp chat, and the staging website URL described in PRD §3.7.

---

## 10. Third-Party API Summary

| Provider | Purpose |
|---|---|
| Twilio | Voice calls, phone number provisioning (via Subaccounts), SMS |
| Meta WhatsApp Cloud API | WhatsApp messaging, Embedded Signup, template management |
| Deepgram (or equivalent) | Real-time speech-to-text |
| ElevenLabs / Azure / Google Neural | Text-to-speech |
| OpenAI / Anthropic (configurable) | LLM for conversation + tool-calling |
| Google Calendar / Microsoft Graph | Calendar sync (OAuth) |
| Stripe / Razorpay | Subscription billing + optional booking deposits |
| AWS KMS / Vault | Secrets encryption |
| S3 / Cloudflare R2 | Recordings, transcripts, media assets |
