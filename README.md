<div align="center">

# Aivora

**AI-powered business automation for local service brands**

Voice receptionist · WhatsApp automation · Website generation · Knowledge-base-backed AI orchestration

![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-FF4154?logo=reactquery&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

</div>

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How it works](#how-it-works)
- [Data model](#data-model)
- [Repository structure](#repository-structure)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Core business flow](#core-business-flow)
- [Design principles](#design-principles)
- [Documentation](#documentation)

---

## Overview

Aivora is an AI-powered business automation platform for local service brands. It combines a customer dashboard, AI voice receptionist flows, WhatsApp automation, website generation, and a knowledge-base-backed orchestration layer that can answer questions, handle bookings, and escalate to humans when needed.

The repository has three parts: a **frontend app**, a **Python RAG and orchestration service**, and a **local Supabase data layer**. A single startup script wires them together so the full stack runs locally with minimal setup.

Aivora helps a business owner do four things quickly:

| Step | What the owner does |
| --- | --- |
| 1 | Create an organization and onboarding profile |
| 2 | Configure a voice receptionist for phone calls |
| 3 | Connect WhatsApp and website experiences |
| 4 | Power the AI with business context stored in a structured knowledge base |

The platform is meant to feel like an operating system for AI-first customer service, while staying grounded in a simple SaaS flow: **configure business data, connect channels, preview, go live.**

---

## Architecture

```mermaid
flowchart TB
  Owner["Business owner<br/>Dashboard and onboarding"]
  Customer["Customers<br/>Phone, WhatsApp, Website"]

  subgraph FE["Frontend: React, TanStack Start, Vite, Tailwind"]
    UI["Auth and org setup<br/>Service config<br/>Knowledge-base UI<br/>Voice, WhatsApp, Website pages"]
    WH["Public webhook routes<br/>/api/public/vapi-webhook<br/>/api/public/whatsapp-webhook"]
  end

  subgraph Providers["External channel providers"]
    Vapi["Vapi voice layer<br/>Phone numbers, IVR, calls<br/>Call webhooks, tool callbacks"]
    WA["WhatsApp / Meta<br/>Inbound messages, bot replies<br/>Human handoff"]
  end

  subgraph SB["Supabase"]
    Auth["Auth"]
    PG["Postgres<br/>RLS and org-scoped data"]
    Storage["Storage"]
  end

  subgraph RAG["aivora-rag-service: FastAPI, Python + LangGraph"]
    Orch["Org config loading<br/>Vector KB retrieval<br/>Prompt assembly<br/>Model routing<br/>Tool execution<br/>Conversation logging"]
    LG["LangGraph Orchestration<br/>Intent classification<br/>State machine routing<br/>Sentiment analysis<br/>Entity extraction<br/>Auto-escalation logic"]
  end

  LLM["OpenAI / Anthropic / Gemini<br/>LLM responses and embeddings"]

  Owner --> UI
  Customer --> Vapi
  Customer --> WA
  UI --> SB
  Vapi --> WH
  WA --> WH
  WH -->|"persist events"| PG
  WH -->|"message + org_id + service_id"| Orch
  Orch -->|"config, KB vectors, logs"| PG
  Orch --> LLM
```

| Component | Responsibility |
| --- | --- |
| **Frontend** | Dashboard, onboarding, service configuration, knowledge-base UI, preview flows, and the public webhook endpoints |
| **Supabase** | Multi-tenant auth, Postgres data with RLS, file storage, and vector metadata |
| **Vapi** | Telephony: phone numbers, IVR and calls, call webhooks, tool callbacks |
| **WhatsApp / Meta** | Inbound messages, bot replies, human handoff |
| **aivora-rag-service** | Retrieval, prompt construction, model routing, tool calls, conversation logging |
| **LangGraph Orchestration** | Multi-agent state machine, intent classification, sentiment analysis, entity extraction, smart routing |
| **LLM providers** | Language model responses and embeddings |

---

## How it works

### 1. Organization onboarding

```mermaid
sequenceDiagram
  autonumber
  actor Owner as Business owner
  participant App as Frontend dashboard
  participant DB as Supabase

  Owner->>App: Sign up
  App->>DB: Create organizations row
  App->>DB: Create matching org_members row
  Owner->>App: Enter business details
  App->>DB: Create business_profiles row<br/>name, timezone, languages, hours, vertical
  App-->>Owner: Redirect to service setup flow
```

### 2. Service setup

The dashboard manages several service channels for the same organization. Each channel is tied to a `services` row and channel-specific configuration in Supabase.

```mermaid
flowchart LR
  Org["Organization"] --> Voice["Voice receptionist"]
  Org --> WhatsApp["WhatsApp business assistant"]
  Org --> Website["Website presence"]
  Voice --> S1[("services row +<br/>channel config")]
  WhatsApp --> S2[("services row +<br/>channel config")]
  Website --> S3[("services row +<br/>channel config")]
```

### 3. Knowledge-base retrieval and multi-agent orchestration

The AI layer uses LangGraph for intelligent decision-making. It reads organization-scoped configuration, classifies intent, performs sentiment analysis, and queries knowledge-base entries before it responds.

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant CH as Phone or WhatsApp
  participant FE as Frontend webhook
  participant RAG as aivora-rag-service
  participant LG as LangGraph Orchestrator
  participant DB as Supabase
  participant LLM as LLM provider

  C->>CH: Asks a question
  CH->>FE: Provider event
  FE->>RAG: Message with org_id and service_id
  RAG->>DB: Load org, business and service config
  RAG->>LLM: Embed the customer message
  RAG->>DB: Vector similarity search over org knowledge base
  DB-->>RAG: Top matching chunks
  RAG->>LG: Message + KB chunks + config
  LG->>LG: Classify intent (booking/info/complaint/escalate)
  LG->>LG: Analyze sentiment (POSITIVE/NEGATIVE/NEUTRAL)
  LG->>LG: Extract entities (dates, times, services)
  LG->>LG: Route to handler (state machine)
  alt KB Answer
    LG->>LLM: Prompt with KB context
    LLM-->>LG: Grounded answer
  else Booking
    LG->>LG: Check availability
    LG->>LG: Execute booking tool
  else Escalate
    LG->>LG: Detect urgency or sentiment
    LLM-->>LG: Escalation flag
  end
  LG-->>RAG: Response + metadata
  RAG->>DB: Log orchestration decision
  RAG-->>FE: Reply or action
  FE-->>CH: Respond to customer
```

### 4. Multi-agent orchestration with LangGraph state machine

The LangGraph orchestration layer decides what action to take based on intent classification and sentiment analysis:

```mermaid
flowchart TD
  Msg["Incoming message or call turn"] --> Classify["Classify Intent<br/>(zero-shot)"]
  Classify -->|Intent + Sentiment| Sentiment["Analyze Sentiment<br/>(POSITIVE/NEGATIVE/NEUTRAL)"]
  Sentiment -->|Entities Extracted| Route{"Route to Handler<br/>(State Machine)"}
  
  Route -->|"KB Answer"| KB["Search Knowledge Base<br/>& Generate Response"]
  Route -->|"Booking"| Avail["Check Availability<br/>(Calendly)"]
  Route -->|"Complaint"| Detect{"Negative +<br/>Urgency?"}
  Route -->|"Default"| Generate["Generate Response"]
  
  Avail -->|"Slots Available"| Book["Book Appointment<br/>(Execute Tool)"]
  Book -->|"Success"| Confirm["Send Confirmation"]
  Book -->|"Failure"| Fallback["Take Message<br/>(Fallback)"]
  
  Detect -->|"Yes"| Escalate["Escalate to Human<br/>(Transfer Call)"]
  Detect -->|"No"| Generate
  
  KB --> Log["Log Decision<br/>(Decision Trail)"]
  Confirm --> Log
  Fallback --> Log
  Escalate --> Log
  Generate --> Log
  
  Log --> Response["Return Response<br/>+ Metadata"]
```

**Graph Nodes:**
- `classify_intent` - Zero-shot classification (8 intent types)
- `search_kb` - Vector search over knowledge base
- `check_availability` - Calendly API call
- `execute_tools` - Booking/messaging tools
- `generate_response` - LLM response generation
- `escalate` - Human handoff with context

**Routing Logic:**
- KB Answer → search_kb → generate_response → END
- Booking → check_availability → execute_tools → escalate/success
- Complaint + negative sentiment → escalate → END
- Default → generate_response → END

### 5. Webhook and event handling

The frontend exposes webhook endpoints that receive provider callbacks:

- `/api/public/vapi-webhook`
- `/api/public/whatsapp-webhook`

```mermaid
flowchart LR
  Event["Provider callback<br/>call or chat event"] --> Verify{"Signature valid?"}
  Verify -->|"No"| Reject["Reject request"]
  Verify -->|"Yes"| Resolve["Resolve org and service"]
  Resolve --> Persist["Persist call or chat event in Supabase"]
  Persist --> Dash["Visible in dashboard timeline"]
  Persist --> Trace["AI orchestration loop stays traceable"]
```

---

## Data model

A simplified view of the core entities described above. See [`Project-Documents/05_Backend_Schema.md`](Project-Documents/05_Backend_Schema.md) for the full schema.

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ ORG_MEMBERS : "has members"
  ORGANIZATIONS ||--|| BUSINESS_PROFILES : "described by"
  ORGANIZATIONS ||--o{ SERVICES : "owns"

  ORGANIZATIONS {
    uuid id PK
  }
  ORG_MEMBERS {
    uuid org_id FK
    uuid user_id
  }
  BUSINESS_PROFILES {
    uuid org_id FK
    string business_name
    string timezone
    string language_preferences
    string business_hours
    string vertical
  }
  SERVICES {
    uuid id PK
    uuid org_id FK
    string channel
  }
```

---

## Repository structure

```text
Aivora/
├── Frontend/                      React app: dashboard, onboarding, webhooks
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── integrations/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── router.tsx
│   │   └── server.ts
│   ├── public/
│   ├── supabase/
│   ├── .env.local.example
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
│
├── aivora-rag-service/            FastAPI RAG and orchestration service
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── services/
│   │   ├── tools/
│   │   └── main.py
│   ├── migrations/
│   ├── tests/
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── supabase/                      Local config and DB metadata
│
├── Project-Documents/             Product and technical documentation
│   ├── 01_PRD.md
│   ├── 02_TRD.md
│   ├── 03_App_Flow.md
│   ├── 04_UI_UX_Brief.md
│   ├── 05_Backend_Schema.md
│   └── 06_Implementation_Plan.md
│
├── Start-Aivora.ps1               One-command local launcher
├── README.md
├── LOCAL_RUN.md
├── package.json
└── package-lock.json
```

---

## Tech stack

| Layer | Stack | Purpose |
| --- | --- | --- |
| Frontend | React, TanStack Start, Vite, Tailwind | Dashboard, onboarding, preview flows, app shell |
| Data and auth | Supabase Postgres, Auth, Storage | Multi-tenant app data, org management, auth, file upload |
| Voice | Vapi | Telephony orchestration, call WebSockets, assistant events |
| AI / Orchestration | LangGraph, LangChain, FastAPI, Python | Multi-agent state machine, intent classification, sentiment analysis, entity extraction |
| Knowledge Base | FastAPI, Python, pgvector | Knowledge-base search, RAG, prompt construction, model routing |
| Model providers | OpenAI, Anthropic, Gemini | LLM responses and embeddings |
| NLP Models | HuggingFace Transformers | Zero-shot classification, sentiment analysis, entity recognition |
| Integrations | Meta WhatsApp, Twilio, Calendly | Channel integration and business tooling |

---

## Getting started

**Prerequisites:** Docker (for local Supabase), Node.js with npm, Python 3 with pip, and PowerShell for the launcher script.

### Quick start

The easiest way to bring up the full stack is the PowerShell launcher at the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Aivora.ps1
```

```mermaid
flowchart LR
  A["Check Docker<br/>is running"] --> B["Check frontend and<br/>RAG service folders"]
  B --> C["Validate required<br/>env files"]
  C --> D["Install frontend<br/>deps if needed"]
  D --> E["Start local<br/>Supabase"]
  E --> F["Run RAG service<br/>port 8001"]
  F --> G["Start frontend<br/>port 8081"]
  G --> H["Open app in<br/>browser"]
```

| Service | Port |
| --- | --- |
| RAG service | `8001` |
| Frontend dev server | `8081` |

### Manual startup

<details>
<summary>Run each part yourself</summary>

**Frontend**

```bash
cd Frontend
npm install
npm run dev
```

**RAG service**

```bash
cd aivora-rag-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Local Supabase**

```bash
cd Frontend
npx supabase start
```

</details>

---

## Environment configuration

> [!WARNING]
> Never commit `.env` files or the Supabase service role key. Only the `.example` files belong in git.

### Frontend

Copy `Frontend/.env.local.example` to `Frontend/.env.local` and fill in the required keys.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for the browser client |
| `VAPI_API_KEY` | Vapi API key |
| `ORCHESTRATION_SHARED_SECRET` | Shared secret used between the frontend and the RAG service |
| `RAG_SERVICE_URL` | Where the frontend reaches the RAG service |
| Provider keys | Meta / WhatsApp, Twilio, Calendly and OAuth credentials |

### RAG service

Copy `aivora-rag-service/.env.example` to `aivora-rag-service/.env` and configure:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key (keep secret) |
| `OPENAI_API_KEY` | OpenAI provider key |
| `ANTHROPIC_API_KEY` | Anthropic provider key |
| `GEMINI_API_KEY` | Gemini provider key |
| `ORCHESTRATION_SHARED_SECRET` | Must match the frontend value |
| `APP_PORT` | Port the service listens on |
| `KB_TOP_K` | How many knowledge-base chunks to retrieve per query |
| `KB_SCORE_THRESHOLD` | Minimum similarity score for a chunk to be used |

---

## Core business flow

```mermaid
flowchart TD
  A["1. Sign up and create<br/>business profile"] --> B["2. Configure service channels<br/>and org settings"]
  B --> C["3. Add business information<br/>and knowledge-base content"]
  C --> D["4. Connect voice, WhatsApp<br/>or website channels"]
  D --> E["5. Test in preview mode"]
  E --> F{"Credentials and<br/>preview checks pass?"}
  F -->|"No"| B
  F -->|"Yes"| G["6. Go live"]
  G --> H["7. Monitor conversations, logs,<br/>usage and escalations"]
```

---

## Design principles

| Principle | What it means |
| --- | --- |
| **Multi-tenant by design** | Org-scoped records and service objects keep each business isolated |
| **Knowledge-driven AI** | Business data and knowledge-base entries guide responses instead of a generic bot |
| **Provider abstraction** | New channels plug in without reworking the core conversation loop |
| **Event-first traceability** | Every call and chat interaction is stored so it can be analyzed and resolved |
| **Preview before publish** | Test the assistant before activating it live |

---

## AI Orchestration with LangGraph

Aivora uses **LangGraph** for intelligent multi-agent decision-making. Instead of a simple prompt-response loop, each customer message flows through a state machine that classifies intent, analyzes sentiment, extracts entities, and routes to the appropriate handler.

### Key Features

| Feature | Capability | Benefit |
| --- | --- | --- |
| **Intent Classification** | Detects 8 intent types (booking, info, complaint, escalate, etc.) | Routes customers to the right handler |
| **Sentiment Analysis** | POSITIVE/NEGATIVE/NEUTRAL tracking across conversation | Auto-escalates frustrated customers |
| **Entity Extraction** | Emails, phone numbers, dates, times, services | Auto-fills booking parameters |
| **State Machine Routing** | Explicit decisions at each step | Traceable, debuggable, scalable |
| **Automatic Escalation** | Detects urgency + negative sentiment | Prevents customer frustration loops |
| **Tool Execution** | Graceful fallbacks when operations fail | Booking fails → take message |

### Architecture

```mermaid
flowchart LR
  Input["Customer Message"] --> IC["Intent Classifier<br/>(Zero-shot)"]
  IC --> SA["Sentiment Analysis"]
  SA --> EE["Entity Extraction"]
  EE --> SM["State Machine<br/>(LangGraph)"]
  
  SM --> N1["Search KB"]
  SM --> N2["Check Availability"]
  SM --> N3["Execute Tool"]
  SM --> N4["Escalate"]
  
  N1 --> GR["Generate Response"]
  N2 --> GR
  N3 --> GR
  N4 --> GR
  
  GR --> Output["Response + Metadata"]
```

### Documentation

For detailed information on LangGraph implementation, see:
- [`README_LANGGRAPH.md`](README_LANGGRAPH.md) - Complete guide
- [`aivora-rag-service/LANGGRAPH_SUMMARY.md`](aivora-rag-service/LANGGRAPH_SUMMARY.md) - Features & benefits
- [`aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md`](aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md) - Technical details
- [`aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md`](aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md) - Integration guide

---

## Documentation

| Document | Covers |
| --- | --- |
| [`Project-Documents/01_PRD.md`](Project-Documents/01_PRD.md) | Product requirements |
| [`Project-Documents/02_TRD.md`](Project-Documents/02_TRD.md) | Technical requirements |
| [`Project-Documents/03_App_Flow.md`](Project-Documents/03_App_Flow.md) | Application flow |
| [`Project-Documents/04_UI_UX_Brief.md`](Project-Documents/04_UI_UX_Brief.md) | UI and UX brief |
| [`Project-Documents/05_Backend_Schema.md`](Project-Documents/05_Backend_Schema.md) | Backend schema |
| [`Project-Documents/06_Implementation_Plan.md`](Project-Documents/06_Implementation_Plan.md) | Implementation plan |
| [`LOCAL_RUN.md`](LOCAL_RUN.md) | Running the project locally |
| [`README_LANGGRAPH.md`](README_LANGGRAPH.md) | LangGraph orchestration guide |
| [`aivora-rag-service/LANGGRAPH_SUMMARY.md`](aivora-rag-service/LANGGRAPH_SUMMARY.md) | LangGraph features and benefits |
| [`aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md`](aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md) | LangGraph technical implementation |
| [`aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md`](aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md) | LangGraph integration guide |

---

> **Status:** this repository is still evolving. The architecture is intentionally layered so the product can scale from a local launch to a production SaaS platform without a complete rewrite of the AI orchestration layer.