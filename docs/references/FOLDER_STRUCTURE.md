# 📁 Aivora - Project Folder Structure

## Overview

The Aivora project is organized for clarity, scalability, and ease of navigation. All components are logically grouped with clear naming conventions.

---

## Root Level Files

```
Aivora/
├── README.md                      # Main project documentation
├── START_HERE.md                  # Master entry point
├── Start-Aivora.ps1               # One-command launcher script
├── package.json                   # Root dependencies
└── package-lock.json              # Lock file
```

### Key Root Files

| File | Purpose |
|------|---------|
| `README.md` | Complete project documentation with architecture diagrams |
| `START_HERE.md` | Master guide (read this first!) |
| `Start-Aivora.ps1` | Automated launcher (PowerShell) |

---

## Main Directories

### 📚 `/docs/` - Documentation Hub

**Purpose:** Centralized documentation for all aspects of the project

```
docs/
├── INDEX.md                       # Documentation index & navigation
├── PROJECT_STATUS.md              # Overall project status
├── quickstart/                    # Quick start guides
│   ├── GETTING_STARTED.md               # New user guide
│   ├── LOCAL_RUN.md                    # How to run locally
│   └── QUICK_COMMANDS.md                # Development commands
├── references/                    # Reference documentation
│   ├── CONTRIBUTING.md                 # Development guidelines
│   ├── TROUBLESHOOTING.md              # Problem solving
│   ├── FOLDER_STRUCTURE.md             # Navigation guide
│   └── QUICK_COMMANDS.md                # Command reference
├── technical/                     # Technical documentation
│   └── PROJECT_COMPLETE.md             # Final status
├── guides/                        # Detailed implementation guides
│   ├── README_LANGGRAPH.md             # LangGraph overview
│   ├── IMPLEMENTATION_SUMMARY.md       # What was built
│   ├── LANGGRAPH_IMPLEMENTATION_COMPLETE.md
│   ├── README_UPDATES_SUMMARY.md       # README changes
│   └── WHATSAPP_UPDATE.txt             # WhatsApp-ready message
└── architecture/                  # Architecture diagrams (reserved for future)
```

**When to use:**
- **docs/INDEX.md** → Navigate all documentation
- **docs/quickstart/** → Get started quickly
- **docs/references/** → Use while working
- **docs/guides/** → Deep dives and reference
- **docs/PROJECT_STATUS.md** → Check overall status

### 🎨 `/Frontend/` - React Dashboard

**Purpose:** Web application for business owners

```
Frontend/
├── src/                           # Source code
│   ├── components/                # Reusable React components
│   │   ├── ui/                       # Shadcn/ui components
│   │   └── bizpilot/                 # Business-specific components
│   ├── hooks/                     # Custom React hooks
│   ├── routes/                    # Route definitions
│   ├── lib/                       # Utility functions
│   └── ...
├── public/                        # Static assets
├── supabase/                      # Supabase configs
├── README.md                      # Frontend-specific docs
├── package.json                   # Dependencies
├── vite.config.ts                 # Vite configuration
└── ...
```

**Key Technologies:**
- React 18
- TanStack Start
- Vite
- Tailwind CSS
- Supabase Client

### 🔧 `/aivora-rag-service/` - Backend (FastAPI + LangGraph)

**Purpose:** AI orchestration, knowledge base, LLM integration

```
aivora-rag-service/
├── app/                           # Main application code
│   ├── api/                       # API routes
│   │   └── routes.py                 # All API endpoints
│   ├── services/                  # Business logic services
│   │   ├── orchestration_service.py   # ⭐ LangGraph orchestrator
│   │   ├── intent_classifier.py      # ⭐ Intent classification & NLP
│   │   ├── llm_service.py            # LLM integration
│   │   ├── kb_service.py             # Knowledge base
│   │   ├── database_service.py       # Database operations
│   │   ├── embedding_service.py      # Embeddings
│   │   └── calendly_service.py       # Calendly integration
│   ├── tools/                     # Tool execution
│   │   └── executor.py               # Execute tools (booking, etc)
│   ├── prompts/                   # Prompt templates
│   │   └── templates.py              # Prompt building
│   ├── models/                    # Pydantic models
│   ├── schemas/                   # API schemas
│   ├── core/                      # Configuration
│   ├── db/                        # Database config
│   └── main.py                    # App entry point
├── migrations/                    # Database migrations
├── tests/                         # Test suite
│   ├── test_orchestration.py      # ⭐ LangGraph tests
│   └── test_service.py
├── README.md                      # Backend documentation
├── requirements.txt               # Python dependencies
├── LANGGRAPH_SUMMARY.md           # LangGraph overview
├── LANGGRAPH_IMPLEMENTATION.md    # LangGraph technical details
├── LANGGRAPH_INTEGRATION_EXAMPLE.md # Integration guide
├── LANGGRAPH_QUICK_REFERENCE.md   # API reference
├── Dockerfile                     # Container configuration
└── docker-compose.yml             # Local dev environment
```

**⭐ LangGraph Files:**
- `app/services/orchestration_service.py` - State machine orchestrator
- `app/services/intent_classifier.py` - NLP models
- `tests/test_orchestration.py` - Comprehensive tests
- `LANGGRAPH_*.md` - Documentation files

### 📋 `/Project-Documents/` - Design & Requirements

**Purpose:** Product and technical specification documents

```
Project-Documents/
├── 01_PRD.md                      # Product Requirements Document
├── 02_TRD.md                      # Technical Requirements Document
├── 03_App_Flow.md                 # Application flow documentation
├── 04_UI_UX_Brief.md              # UI/UX specifications
├── 05_Backend_Schema.md           # Database schema
└── 06_Implementation_Plan.md      # Implementation roadmap
```

### 🗄️ `/supabase/` - Database Configuration

**Purpose:** Supabase configuration and metadata

```
supabase/
├── .branches/                     # Branch metadata
├── .temp/                         # Temporary files
└── snippets/                      # SQL snippets
```

---

## Quick File Reference

### Documentation Files (Organized by Purpose)

| Purpose | Location |
|---------|----------|
| **Getting Started** | `docs/quickstart/GETTING_STARTED.md` |
| **Local Setup** | `docs/quickstart/LOCAL_RUN.md` |
| **Commands** | `docs/quickstart/QUICK_COMMANDS.md` or `docs/references/QUICK_COMMANDS.md` |
| **Troubleshooting** | `docs/references/TROUBLESHOOTING.md` |
| **Contributing** | `docs/references/CONTRIBUTING.md` |
| **Folder Guide** | `docs/references/FOLDER_STRUCTURE.md` |
| **Main Overview** | `README.md` |
| **Doc Index** | `docs/INDEX.md` |
| **LangGraph Start** | `docs/guides/README_LANGGRAPH.md` |
| **LangGraph Technical** | `aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md` |
| **LangGraph Integration** | `aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md` |
| **API Reference** | `aivora-rag-service/LANGGRAPH_QUICK_REFERENCE.md` |
| **Status** | `docs/PROJECT_STATUS.md` |

### Code Files (Key Locations)

| Component | Location |
|-----------|----------|
| **API Routes** | `aivora-rag-service/app/api/routes.py` |
| **LangGraph Orchestrator** | `aivora-rag-service/app/services/orchestration_service.py` |
| **Intent Classifier** | `aivora-rag-service/app/services/intent_classifier.py` |
| **LLM Integration** | `aivora-rag-service/app/services/llm_service.py` |
| **Knowledge Base** | `aivora-rag-service/app/services/kb_service.py` |
| **Tests** | `aivora-rag-service/tests/test_orchestration.py` |
| **Frontend App** | `Frontend/src/` |
| **Database Schema** | `Project-Documents/05_Backend_Schema.md` |

---

## Directory Tree (Visual)

```
Aivora/
│
├── 📖 Root Documentation
│   ├── README.md ⭐ MAIN REFERENCE
│   ├── START_HERE.md ⭐ MASTER ENTRY POINT
│   └── Start-Aivora.ps1
│
├── 📚 docs/ (Documentation Hub)
│   ├── INDEX.md (Navigation)
│   ├── PROJECT_STATUS.md
│   ├── quickstart/
│   │   ├── GETTING_STARTED.md
│   │   ├── LOCAL_RUN.md
│   │   └── QUICK_COMMANDS.md
│   ├── references/
│   │   ├── CONTRIBUTING.md
│   │   ├── TROUBLESHOOTING.md
│   │   ├── FOLDER_STRUCTURE.md (this file)
│   │   └── QUICK_COMMANDS.md
│   ├── technical/
│   │   └── PROJECT_COMPLETE.md
│   └── guides/
│       ├── README_LANGGRAPH.md
│       ├── IMPLEMENTATION_SUMMARY.md
│       ├── LANGGRAPH_IMPLEMENTATION_COMPLETE.md
│       ├── README_UPDATES_SUMMARY.md
│       └── WHATSAPP_UPDATE.txt
│
├── 🎨 Frontend/ (React Dashboard)
│   ├── src/
│   │   ├── components/
│   │   ├── routes/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── 🔧 aivora-rag-service/ (Backend)
│   ├── app/
│   │   ├── api/ (API routes)
│   │   ├── services/ ⭐ (Business logic)
│   │   │   ├── orchestration_service.py ⭐ (LangGraph)
│   │   │   ├── intent_classifier.py ⭐ (NLP)
│   │   │   ├── llm_service.py
│   │   │   └── kb_service.py
│   │   ├── tools/ (Tool execution)
│   │   ├── prompts/ (Templates)
│   │   └── ...
│   ├── tests/
│   │   └── test_orchestration.py ⭐
│   ├── requirements.txt
│   ├── LANGGRAPH_SUMMARY.md
│   ├── LANGGRAPH_IMPLEMENTATION.md
│   ├── LANGGRAPH_INTEGRATION_EXAMPLE.md
│   ├── LANGGRAPH_QUICK_REFERENCE.md
│   └── ...
│
├── 📋 Project-Documents/ (Specs)
│   ├── 01_PRD.md
│   ├── 02_TRD.md
│   ├── 03_App_Flow.md
│   ├── 04_UI_UX_Brief.md
│   ├── 05_Backend_Schema.md
│   └── 06_Implementation_Plan.md
│
├── 🗄️ supabase/ (Database Config)
│
└── 📦 Configuration Files
    ├── package.json
    ├── package-lock.json
    └── (.env files - NOT in git)
```

---

## File Organization Principles

### 1. **Documentation Centralization**
- Root level: Essential, quick-start docs only
- `/docs/`: All organized documentation
  - `/docs/quickstart/`: Get started quickly
  - `/docs/references/`: Use while working
  - `/docs/guides/`: Detailed deep-dives
  - `/docs/technical/`: Technical reference
- Component folders: Component-specific docs
- Guide principle: "START_HERE.md → README.md → docs/INDEX.md"

### 2. **Code Organization**
- By functionality (not by file type)
- `/services/` for business logic
- `/api/` for HTTP handlers
- `/tools/` for tool execution
- `/models/` for data structures

### 3. **Clear Naming**
- `LANGGRAPH_*` files clearly marked
- `README_` for guides
- `_EXAMPLE` for reference implementations
- Descriptive folder names

### 4. **Scalability**
- `/docs/architecture/` reserved for diagrams
- `/docs/guides/` for detailed guides
- Each component has its own README
- No deep nesting (max 3 levels usually)

---

## For Different Users

### 👨‍💻 New Developer
**Start here:**
1. `START_HERE.md` (2 min overview)
2. `docs/quickstart/GETTING_STARTED.md` (5 min)
3. `docs/quickstart/LOCAL_RUN.md` (follow setup)
4. `README.md` (20 min overview)
5. Explore `/Frontend/` or `/aivora-rag-service/`

### 🤖 AI/ML Engineer
**Start here:**
1. `docs/guides/README_LANGGRAPH.md`
2. `aivora-rag-service/LANGGRAPH_IMPLEMENTATION.md`
3. `aivora-rag-service/app/services/orchestration_service.py`

### 📊 Project Manager
**Start here:**
1. `README.md`
2. `docs/PROJECT_STATUS.md`
3. `Project-Documents/01_PRD.md`

### 🚀 DevOps / Deployment
**Start here:**
1. `docs/quickstart/LOCAL_RUN.md`
2. `aivora-rag-service/Dockerfile`
3. `Frontend/` deployment config

### 🤝 Contributor
**Start here:**
1. `docs/references/CONTRIBUTING.md`
2. `docs/quickstart/GETTING_STARTED.md`
3. `docs/references/QUICK_COMMANDS.md`

---

## File Size & Complexity

| File | Type | Size | Complexity |
|------|------|------|-----------|
| `orchestration_service.py` | Code | ~300 lines | Medium |
| `intent_classifier.py` | Code | ~220 lines | Medium |
| `test_orchestration.py` | Tests | ~250 lines | Low |
| `LANGGRAPH_IMPLEMENTATION.md` | Docs | ~500 lines | Reference |
| `README.md` | Docs | ~600 lines | Complex |
| `GETTING_STARTED.md` | Docs | ~350 lines | Simple |

---

## Navigation Tips

### "I'm lost, where should I start?"
→ `START_HERE.md`

### "How does the whole system work?"
→ `README.md`

### "How do I set up locally?"
→ `docs/quickstart/LOCAL_RUN.md`

### "What's the LangGraph orchestration?"
→ `docs/guides/README_LANGGRAPH.md`

### "How do I integrate LangGraph?"
→ `aivora-rag-service/LANGGRAPH_INTEGRATION_EXAMPLE.md`

### "Where's the API reference?"
→ `aivora-rag-service/LANGGRAPH_QUICK_REFERENCE.md`

### "What's the project status?"
→ `docs/PROJECT_STATUS.md`

### "Where's all the documentation?"
→ `docs/INDEX.md`

### "I'm stuck!"
→ `docs/references/TROUBLESHOOTING.md`

### "How do I contribute?"
→ `docs/references/CONTRIBUTING.md`

---

## Maintenance Notes

- ✅ Clean structure maintained
- ✅ Documentation centralized in `/docs/`
- ✅ Code organized by function
- ✅ Clear naming conventions
- ✅ Scalable for growth
- ✅ Root level clean (5 essential files only)

### Adding New Files

**Documentation:**
- **Quick guides** → `/docs/quickstart/`
- **References** → `/docs/references/`
- **Technical** → `/docs/technical/`
- **Detailed guides** → `/docs/guides/`
- **Diagrams** → `/docs/architecture/`

**Code:**
- **Services** → `/aivora-rag-service/app/services/`
- **API Routes** → `/aivora-rag-service/app/api/`
- **Tests** → `/aivora-rag-service/tests/`

**Design:**
- **Specs** → `/Project-Documents/`

---

## Quick Commands

```bash
# View main README
code README.md

# View all docs
code docs/INDEX.md

# View LangGraph docs
code docs/guides/README_LANGGRAPH.md

# View backend structure
code aivora-rag-service/

# View frontend structure
code Frontend/

# Start local environment
powershell -ExecutionPolicy Bypass -File .\Start-Aivora.ps1
```

---

**Last Updated:** October 2026
**Status:** Clean, Organized, Production-Ready
**Version:** 1.0 with LangGraph
