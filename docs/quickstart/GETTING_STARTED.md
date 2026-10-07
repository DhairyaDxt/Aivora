# 🚀 Aivora - Getting Started Guide

## What is Aivora?

**AI-powered business automation for local service brands**

Aivora combines:
- 🗣️ Voice receptionist (Vapi)
- 💬 WhatsApp chatbot (Meta)
- 🌐 Website builder
- 🧠 Intelligent orchestration (LangGraph)
- 📚 Knowledge-base backed responses
- 📞 Human escalation handling

---

## Quick Navigation

### 👤 I'm a...

**Product Manager / Non-Technical**
→ Read [README.md](../../README.md) (5-10 min overview)

**Developer (First Time)**
1. Read [README.md](../../README.md)
2. Follow [LOCAL_RUN.md](../LOCAL_RUN.md) to set up
3. Check `docs/INDEX.md` for detailed docs

**Developer (Implementing LangGraph)**
→ Go to [docs/guides/README_LANGGRAPH.md](../guides/README_LANGGRAPH.md)

**AI/ML Engineer**
→ Read [aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md](../../aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md)

---

## 5-Minute Overview

### How It Works

```
1. CUSTOMER CONTACTS
   Phone (Vapi) / WhatsApp (Meta) / Website

2. INTELLIGENT ROUTING
   ✓ Classify intent (booking, info, complaint, escalate)
   ✓ Analyze sentiment (positive/negative/neutral)
   ✓ Extract details (dates, times, services)

3. SMART HANDLING
   ✓ Answer from knowledge base
   ✓ Check availability & book
   ✓ Escalate to human if needed
   ✓ Take message if unavailable

4. CUSTOMER GETS RESPONSE
   Phone call / WhatsApp message / Website chat
```

### Key Technology

| Component | Purpose |
|-----------|---------|
| **Frontend** | React dashboard for business owners |
| **RAG Service** | FastAPI backend with LangGraph orchestration |
| **Database** | Supabase (Postgres + auth + vectors) |
| **Voices** | Vapi (telephony), Meta (messaging), Calendly (booking) |
| **AI Models** | OpenAI, Anthropic, Gemini (language) + HuggingFace (NLP) |

---

## Getting Started

### Option 1: Run Locally (Recommended)

**Prerequisites:**
- Docker (for Supabase)
- Node.js + npm
- Python 3.9+
- PowerShell (Windows)

**Steps:**
```bash
# 1. Start everything with one command
powershell -ExecutionPolicy Bypass -File .\Start-Aivora.ps1

# 2. Open browser
# Frontend: http://localhost:8081
# RAG Service: http://localhost:8001

# 3. Read LOCAL_RUN.md for detailed instructions
```

### Option 2: Manual Setup

```bash
# Frontend
cd Frontend
npm install
npm run dev

# RAG Service (new terminal)
cd aivora-rag-service
pip install -r requirements.txt
uvicorn app.main:app --reload

# Supabase (new terminal)
cd Frontend
npx supabase start
```

---

## File Structure

```
Aivora/
├── README.md                    ← Main project documentation
├── LOCAL_RUN.md                 ← How to run locally
├── START_HERE.md                ← Master entry point
├── Start-Aivora.ps1             ← One-command launcher
│
├── docs/                         ← Documentation hub
│   ├── INDEX.md                 ← Documentation index
│   ├── PROJECT_STATUS.md        ← Current status
│   ├── quickstart/              ← Quick start guides
│   │   ├── GETTING_STARTED.md   ← This file
│   │   ├── LOCAL_RUN.md
│   │   └── QUICK_COMMANDS.md
│   ├── references/              ← Reference docs
│   │   ├── CONTRIBUTING.md
│   │   ├── TROUBLESHOOTING.md
│   │   └── FOLDER_STRUCTURE.md
│   ├── technical/               ← Technical docs
│   │   └── PROJECT_COMPLETE.md
│   └── guides/                  ← Detailed guides
│       ├── README_LANGGRAPH.md
│       └── ...
│
├── Frontend/                     ← React dashboard
├── aivora-rag-service/          ← FastAPI + LangGraph
├── Project-Documents/           ← Design & requirements
└── supabase/                    ← Database config
```

---

## Key Concepts

### Multi-Tenant Architecture
Each business (organization) is completely isolated:
- Separate database records
- Own knowledge base
- Own configuration
- Own conversation history

### Knowledge-Base Backed AI
The AI doesn't just respond generically—it uses the business's own information:
- Upload business details
- Upload documents
- Store services & pricing
- AI uses this context in responses

### Intent-Based Routing (New with LangGraph)
Instead of trying to do everything, the system decides what to do:
- **Booking** → Check availability → Confirm
- **Information** → Search KB → Answer
- **Complaint** → Detect frustration → Escalate
- **Default** → Generate response

---

## LangGraph Orchestration (NEW)

Aivora now uses **LangGraph** for intelligent multi-agent decision-making.

### What This Means

**Before:** "Call LLM and hope it responds correctly"
**After:** "Classify intent → Analyze sentiment → Route to handler"

### Key Features

✅ **Intent Classification** (8 types)
- Booking, information, complaint, escalation, etc.

✅ **Sentiment Analysis**
- Detects frustrated customers
- Auto-escalates if negative

✅ **Entity Extraction**
- Dates, times, phone numbers, services
- Auto-fills booking parameters

✅ **Smart Routing**
- Explicit decisions at each step
- Traceable, debuggable

✅ **Graceful Fallbacks**
- Booking fails → Take message
- Tool error → Try again

---

## Common Tasks

### Setup for First Time
→ Follow [LOCAL_RUN.md](../LOCAL_RUN.md)

### Create a Business Profile
1. Open http://localhost:8081
2. Sign up
3. Enter business details
4. Configure voice receptionist
5. Add knowledge base

### Test Voice Calling
1. Configure Vapi credentials (get from Vapi.com)
2. Set phone number
3. Call your number
4. Talk to the AI receptionist

### Test WhatsApp
1. Configure Meta/WhatsApp credentials
2. Send a message to your WhatsApp business number
3. Get AI response

### Integrate LangGraph
→ Follow [aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md](../../aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Business Owner                     │
│            (Dashboard at :8081)                     │
└──────────────┬──────────────────────────────────────┘
               │
     ┌─────────┴──────────────┐
     │                        │
 ┌───▼────────┐      ┌───────▼──────┐
 │  Frontend  │      │  Supabase    │
 │  (React)   │      │  (Data)      │
 └────────────┘      └──────────────┘
     │
     │ Webhooks
     │
 ┌───▼──────────────────────────────┐
 │   External Providers             │
 │  Vapi / WhatsApp / Calendly      │
 └────────────┬──────────────────────┘
              │
     ┌────────▼─────────────────┐
     │  aivora-rag-service      │
     │  (FastAPI + Python)      │
     │                          │
     │  ┌────────────────────┐  │
     │  │ LangGraph          │  │
     │  │ Orchestrator       │  │
     │  │                    │  │
     │  │ • Intent Classify  │  │
     │  │ • Sentiment Analyze│  │
     │  │ • Entity Extract   │  │
     │  │ • Smart Routing    │  │
     │  └────────────────────┘  │
     │                          │
     │  ┌────────────────────┐  │
     │  │ Knowledge Base     │  │
     │  │ Vector Search      │  │
     │  └────────────────────┘  │
     │                          │
     │  ┌────────────────────┐  │
     │  │ LLM Integration    │  │
     │  │ Tool Execution     │  │
     │  └────────────────────┘  │
     │                          │
     └──────────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         │                      │
    ┌────▼──────┐      ┌───────▼────┐
    │ OpenAI    │      │ Anthropic  │
    │ Gemini    │      │ Other LLMs │
    └───────────┘      └────────────┘
```

---

## Environment Setup

### Frontend `.env.local`
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VAPI_API_KEY=your_vapi_key
ORCHESTRATION_SHARED_SECRET=your_secret
RAG_SERVICE_URL=http://localhost:8001
```

### RAG Service `.env`
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key
ORCHESTRATION_SHARED_SECRET=your_secret
```

---

## Documentation by Topic

| Topic | Location |
|-------|----------|
| **Getting Started** | [LOCAL_RUN.md](../LOCAL_RUN.md) |
| **Architecture** | [README.md](../../README.md#architecture) |
| **How It Works** | [README.md](../../README.md#how-it-works) |
| **LangGraph** | [docs/guides/README_LANGGRAPH.md](../guides/README_LANGGRAPH.md) |
| **Integration** | [aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md](../../aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md) |
| **API Reference** | [aivora-rag-service/LANGGRAPH_QUICK_REFERENCE.md](../../aivora-rag-service/LANGGRAPH_QUICK_REFERENCE.md) |
| **Troubleshooting** | [docs/INDEX.md](../INDEX.md) |

---

## Need Help?

### Common Issues

**"Supabase won't start"**
- Make sure Docker is running
- Check ports 54321 (Postgres) and 54322 (Studio) are free

**"Python dependencies fail"**
- Use Python 3.9+
- Try: `pip install --upgrade pip` then `pip install -r requirements.txt`

**"Can't connect to RAG service"**
- Make sure it's running on port 8001
- Check: `http://localhost:8001/health`

**"Frontend won't load"**
- Make sure port 8081 is free
- Check console for errors: F12 in browser

### Get More Help

- **Frontend issues:** Check `Frontend/README.md`
- **Backend issues:** Check `aivora-rag-service/README.md`
- **LangGraph issues:** Check `aivora-rag-service/LANGGRAPH_QUICK_REFERENCE.md`
- **General questions:** See `docs/INDEX.md`

---

## Project Status

✅ Frontend - Production ready
✅ RAG Service - Production ready
✅ LangGraph Orchestration - Production ready
✅ Documentation - Complete

**Next Step:** [LOCAL_RUN.md](../LOCAL_RUN.md)

---

**Happy coding! 🚀**
