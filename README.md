# Aivora - Multi-tenant AI Voice Receptionist, WhatsApp & Website Platform

Aivora is a multi-tenant SaaS backend for an AI voice receptionist, WhatsApp AI chatbot, and website builder platform for small businesses.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│   apps/api      │◄───►│  apps/ai-orchestrator│
│   (NestJS)      │     │  (FastAPI + Python)  │
│   - Postgres    │     │  - LLM Conversation  │
│   - Redis       │     │  - Tool Calling      │
│   - Auth/RBAC   │     │  - RAG Integration   │
│   - Booking     │     │                      │
└─────────────────┘     └──────────────────────┘
         ▲
         │
    ┌────┴────┐
    │  PostgreSQL + pgvector │
    │  (Multi-tenant with RLS)│
    └────────────────────────┘
```

### Services

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| API | NestJS + TypeScript | 3001 | REST API, Auth, Multi-tenancy, Booking, Voice/WhatsApp/Website Config |
| AI Orchestrator | FastAPI + Python | 8000 | LLM conversation loop, tool calling, RAG |
| PostgreSQL | pgvector/pg16 | 5432 | Primary database with vector embeddings |
| Redis | Redis 7 | 6379 | Caching, BullMQ job queues |

## Quick Start

### Prerequisites

- Node.js 20 LTS
- Python 3.11+
- pnpm 9+
- Docker & Docker Compose
- uv (Python package manager)

### 1. Clone and Install

```bash
git clone <repository>
cd aivora

# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd apps/ai-orchestrator && uv sync && cd ../..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys (at minimum OPENAI_API_KEY for embeddings)
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose -f infra/docker-compose.yml up -d postgres redis

# Or start everything including apps
docker-compose -f infra/docker-compose.yml up -d
```

### 4. Run Migrations & Seed

```bash
# Run database migrations
cd apps/api && pnpm db:migrate

# Seed demo data
pnpm db:seed
```

### 5. Start Development Servers

```bash
# Terminal 1: Start API
cd apps/api && pnpm start:dev

# Terminal 2: Start AI Orchestrator
cd apps/ai-orchestrator && uv run uvicorn app.main:app --reload --port 8000
```

### 6. Verify

- API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/docs
- AI Orchestrator: http://localhost:8000
- Health Check: http://localhost:3001/api/health

## Project Structure

```
aivora/
├── apps/
│   ├── api/                    # NestJS API
│   │   ├── src/
│   │   │   ├── auth/           # Authentication & OTP
│   │   │   ├── tenancy/        # Multi-tenancy & RLS
│   │   │   ├── secrets/        # Secrets vault abstraction
│   │   │   ├── business-profile/
│   │   │   ├── knowledge-base/ # KB with pgvector embeddings
│   │   │   ├── appointments/   # Booking engine
│   │   │   ├── voice/          # Voice receptionist
│   │   │   ├── whatsapp/       # WhatsApp AI chatbot
│   │   │   ├── website/        # Website builder
│   │   │   ├── credentials/    # Credential management
│   │   │   ├── audit/          # Audit logging
│   │   │   └── health/
│   │   └── prisma/             # Schema & migrations
│   │
│   └── ai-orchestrator/        # FastAPI AI service
│       └── app/
│           ├── config.py
│           ├── models.py
│           ├── api_client.py   # Calls apps/api REST endpoints
│           ├── orchestrator.py # LLM conversation loop
│           └── main.py
│
├── packages/
│   └── shared-types/           # TypeScript types shared with frontend
│
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   └── Dockerfile.ai-orchestrator
│
├── turbo.json                  # Turborepo config
├── package.json                # Root package.json (pnpm workspaces)
└── Makefile                    # Common commands
```

## Key Features

### Multi-tenancy with Row-Level Security
- Every tenant-scoped table has `org_id`
- RLS policies enforce isolation at database level
- `TenantContextService` sets `app.current_org_id` per request
- Automated test verifies cross-org isolation

### Authentication
- Email + OTP signup/login
- Google & Microsoft OAuth (structured, mockable)
- JWT access tokens (15min) + refresh tokens (7d) as httpOnly cookies
- RBAC: owner, admin, agent, viewer roles enforced at controller level

### Secrets Vault
- `SecretsProvider` interface with `LocalAesGcmSecretsProvider` (dev) and `AwsKmsSecretsProvider` (prod stub)
- AES-256-GCM encryption, keys from `SECRETS_MASTER_KEY`
- Raw secrets never appear in API responses or logs

### Knowledge Base with RAG
- PDF upload → text extraction → LLM structuring → candidate entries for review
- Embeddings generated on create/update (OpenAI/Anthropic configurable)
- pgvector cosine similarity search via `POST /knowledge-base/search`

### Appointment Booking Engine
- Services with duration, buffers, pricing
- Staff with working hours, service assignments
- Availability calculation respecting hours, buffers, existing bookings
- **Concurrency-safe**: Exclusion constraint prevents double-booking, race condition handled with re-check in transaction
- BullMQ reminder jobs (24h, 1h before)

### Voice Receptionist
- Voice agent config: persona, greeting, voice, escalation, consent
- Twilio phone number search/purchase (with nearby area code fallback)
- Webhook pipeline: Twilio → Deepgram STT → AI Orchestrator → ElevenLabs TTS → Twilio
- Mandatory AI disclosure + consent greeting
- Hardened system prompt against injection
- Tool calling: check_availability, book_appointment, transfer_to_human, take_message
- Sandbox/preview mode (is_sandbox flag, no billing impact)
- Go Live check: preview opened + all credentials connected

### WhatsApp AI Chatbot (Stage 2)
- **Meta Embedded Signup** — OAuth flow for connecting WhatsApp Business Accounts; fallback manual entry
- **Credential Vault** — System User tokens stored encrypted via Stage 1's SecretsProvider
- **Inbound Webhook** — Signature verification, instant ack, BullMQ async processing
- **24-Hour Window Policy** — Free-form replies only within 24h of last customer message; templates required outside
- **AI Conversation Loop** — Reuses Stage 1 orchestrator with WhatsApp channel (buttons/lists/quick replies)
- **Template Management** — Compose, submit to Meta, poll status (pending/approved/rejected)
- **Human Handoff** — Keyword detection + AI-detected frustration → escalate, agent take-over/release
- **Preview/Sandbox** — Identical AI path, `is_sandbox=true`, zero external sends, zero usage records
- **Go-Live Gate** — Preview opened + meta_whatsapp credential connected + webhook configured
- **Opt-In Enforcement** — Proactive templates only for opted-in customers

### Website Builder (Stage 3)
- **Template-based Visual Editor** — 5 starter templates (Salon, Clinic, Restaurant, Generic, Blank) with structured page trees
- **AI Content Pre-fill** — `POST /website/versions/prefill` generates structured page trees from Business Profile + Knowledge Base using LLM
- **Editor Backend** — Autosave draft versions, version history, server-side page-tree schema validation (component types, required props)
- **Embeddable Widgets** — Booking widget (`<aivora-booking>`) and Chat widget (`<aivora-chat>`) as vanilla JS web components; public API scoped by service key
- **Public API** — `GET /public/:key/availability`, `POST /public/:key/appointments`, `POST /public/:key/chat` with per-IP and per-key rate limiting
- **Staging & Publishing** — Static site build from page tree → S3-compatible storage → CDN cache invalidation; atomic publish (old version servable until new confirmed live)
- **Custom Domain** — Guided DNS flow with CNAME/A record instructions; `POST /domain/verify` transitions `not_connected → pending_dns → verified` via real DNS lookup
- **SEO Basics** — Meta title/description per page, auto-generated `sitemap.xml` and `robots.txt` at publish
- **Go-Live Gate** — Preview opened + custom domain verified (subdomain-only sites skip domain check)

### Audit Logging
- Interceptor-based logging for credential changes, service status changes
- Actor, action, resource, before/after state

## API Endpoints

### Authentication
```
POST   /api/v1/auth/signup
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/invite
```

### Business Profile
```
POST   /api/v1/business-profile
GET    /api/v1/business-profile
PUT    /api/v1/business-profile
DELETE /api/v1/business-profile
```

### Knowledge Base
```
POST   /api/v1/knowledge-base
POST   /api/v1/knowledge-base/bulk
GET    /api/v1/knowledge-base
GET    /api/v1/knowledge-base/:id
PUT    /api/v1/knowledge-base/:id
DELETE /api/v1/knowledge-base/:id
POST   /api/v1/knowledge-base/search
POST   /api/v1/knowledge-base/extract
```

### Credentials
```
POST   /api/v1/credentials
GET    /api/v1/credentials
GET    /api/v1/credentials/:id
PUT    /api/v1/credentials/:id
DELETE /api/v1/credentials/:id
POST   /api/v1/credentials/:id/test
```

### Appointments
```
POST   /api/v1/appointments/services
GET    /api/v1/appointments/services
GET    /api/v1/appointments/services/:id
PUT    /api/v1/appointments/services/:id
DELETE /api/v1/appointments/services/:id

POST   /api/v1/appointments/staff
GET    /api/v1/appointments/staff
GET    /api/v1/appointments/staff/:id
PUT    /api/v1/appointments/staff/:id
DELETE /api/v1/appointments/staff/:id

GET    /api/v1/appointments/availability
POST   /api/v1/appointments
GET    /api/v1/appointments
GET    /api/v1/appointments/:id
PUT    /api/v1/appointments/:id
DELETE /api/v1/appointments/:id
POST   /api/v1/appointments/:id/no-show
```

### Voice
```
POST   /api/v1/voice/services/:serviceId/config
GET    /api/v1/voice/services/:serviceId/config
PUT    /api/v1/voice/services/:serviceId/config
DELETE /api/v1/voice/services/:serviceId/config

GET    /api/v1/voice/phone-numbers/search
POST   /api/v1/voice/phone-numbers/purchase
GET    /api/v1/voice/phone-numbers
DELETE /api/v1/voice/phone-numbers/:id

GET    /api/v1/voice/services/:serviceId/go-live-check
POST   /api/v1/voice/services/:serviceId/sandbox-call

POST   /api/v1/voice/webhook/incoming
POST   /api/v1/voice/webhook/status
POST   /api/v1/voice/webhook/recording
POST   /api/v1/voice/webhook/process-speech
```

### WhatsApp
```
# Bot Config
POST   /api/v1/whatsapp/services/:serviceId/config
GET    /api/v1/whatsapp/services/:serviceId/config
PUT    /api/v1/whatsapp/services/:serviceId/config
DELETE /api/v1/whatsapp/services/:serviceId/config

# Meta Embedded Signup
POST   /api/v1/whatsapp/embedded-signup
POST   /api/v1/whatsapp/callback
POST   /api/v1/whatsapp/connect-manual

# Templates
POST   /api/v1/whatsapp/services/:serviceId/templates
GET    /api/v1/whatsapp/services/:serviceId/templates
GET    /api/v1/whatsapp/services/:serviceId/templates/:id
PUT    /api/v1/whatsapp/services/:serviceId/templates/:id/sync
DELETE /api/v1/whatsapp/services/:serviceId/templates/:id
POST   /api/v1/whatsapp/services/:serviceId/templates/send

# Handoff
GET    /api/v1/whatsapp/conversations/escalated
POST   /api/v1/whatsapp/conversations/:id/take-over
POST   /api/v1/whatsapp/conversations/:id/release

# Window Policy
GET    /api/v1/whatsapp/window-check/:customerPhone

# Preview/Sandbox
POST   /api/v1/whatsapp/services/:serviceId/preview
GET    /api/v1/whatsapp/services/:serviceId/preview/history
DELETE /api/v1/whatsapp/services/:serviceId/preview

# Go-Live Check
GET    /api/v1/whatsapp/services/:serviceId/go-live-check

# Webhook (public)
GET    /api/v1/whatsapp/webhook          # Meta verification
POST   /api/v1/whatsapp/webhook          # Inbound messages
```

### Website
```
# Config
POST   /api/v1/website/services/:serviceId/config
GET    /api/v1/website/services/:serviceId/config
PUT    /api/v1/website/services/:serviceId/config
DELETE /api/v1/website/services/:serviceId/config

# Versions (drafts + history)
POST   /api/v1/website/services/:serviceId/versions
GET    /api/v1/website/services/:serviceId/versions
GET    /api/v1/website/services/:serviceId/versions/:id
PUT    /api/v1/website/services/:serviceId/versions/:id
DELETE /api/v1/website/services/:serviceId/versions/:id

# AI Pre-fill
POST   /api/v1/website/services/:serviceId/versions/prefill

# Publishing
POST   /api/v1/website/services/:serviceId/publish
GET    /api/v1/website/services/:serviceId/published

# Custom Domain
GET    /api/v1/website/services/:serviceId/domain/instructions
POST   /api/v1/website/services/:serviceId/domain/verify

# Go-Live Check
GET    /api/v1/website/services/:serviceId/go-live-check

# Public Widgets (no auth, service-key scoped)
GET    /api/v1/public/:serviceKey/availability
POST   /api/v1/public/:serviceKey/appointments
POST   /api/v1/public/:serviceKey/chat
```

### Audit Logs
```
GET    /api/v1/audit-logs
GET    /api/v1/audit-logs/:id
```

## Testing

```bash
# API tests
cd apps/api && pnpm test

# AI Orchestrator tests
cd apps/ai-orchestrator && uv run pytest

# Integration tests (requires Docker)
cd apps/api && pnpm test:e2e
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_ACCESS_SECRET` | JWT access token secret (32+ chars) | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (32+ chars) | Yes |
| `SECRETS_MASTER_KEY` | AES-256-GCM master key (64 hex chars) | Yes |
| `LLM_API_KEY` | LLM API key (AgentRouter, OpenAI, etc.) | Yes |
| `LLM_BASE_URL` | LLM base URL for custom providers | For custom LLM |
| `LLM_MODEL` | LLM model name (e.g., opus-5) | For custom LLM |
| `EMBEDDING_API_KEY` | Embeddings API key | Yes |
| `EMBEDDING_BASE_URL` | Embeddings base URL for custom providers | For custom embeddings |
| `EMBEDDING_MODEL` | Embeddings model name | For custom embeddings |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | For voice |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | For voice |
| `META_APP_ID` | Meta App ID for WhatsApp | For WhatsApp |
| `META_APP_SECRET` | Meta App Secret for WhatsApp | For WhatsApp |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook verify token | For WhatsApp |
| `DEEPGRAM_API_KEY` | Deepgram API key for STT | For voice |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS | For voice |
| `AIVORA_API_KEY` | Internal API key for orchestrator→API | Yes |
| `WIDGET_RATE_LIMITS` | JSON: requestsPerMinute, requestsPerHour | For widgets |
| `STAGING_DOMAIN` | Staging domain for preview (e.g., bizpilot.site) | For website |
| `AWS_S3_BUCKET` | S3 bucket for static site hosting | For website publish |

## Production Deployment

1. Set `NODE_ENV=production`
2. Use `SECRETS_PROVIDER=aws_kms` with valid AWS KMS credentials
3. Configure real OAuth credentials
4. Set up SSL/TLS termination (nginx, ALB, etc.)
5. Use managed PostgreSQL (RDS, Cloud SQL) with pgvector
6. Use managed Redis (ElastiCache, Redis Cloud)
7. Configure S3-compatible storage for recordings
8. Set up monitoring (Prometheus, Grafana, Datadog)

## License

MIT
