# ⚡ Quick Commands Reference

## 🚀 Project Startup

### One-Command Start (Windows)
```bash
powershell -ExecutionPolicy Bypass -File .\Start-Aivora.ps1
```

### Manual Start (All Platforms)

**Terminal 1 - Supabase**
```bash
cd Frontend
npx supabase start
```

**Terminal 2 - RAG Service**
```bash
cd aivora-rag-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 3 - Frontend**
```bash
cd Frontend
npm install
npm run dev
```

---

## 📍 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:8081 | Dashboard & UI |
| **RAG Service** | http://localhost:8001 | API backend |
| **Health Check** | http://localhost:8001/health | Service status |
| **Supabase Studio** | http://localhost:54323 | Database UI |

---

## 🧪 Testing

### Run All Tests
```bash
cd aivora-rag-service
pytest tests/ -v
```

### Run LangGraph Tests
```bash
cd aivora-rag-service
pytest tests/test_orchestration.py -v
```

### Run Specific Test
```bash
cd aivora-rag-service
pytest tests/test_orchestration.py::TestIntentClassification::test_classify_booking_intent -v
```

### Run with Output
```bash
cd aivora-rag-service
pytest tests/test_orchestration.py -v -s
```

---

## 📦 Dependency Management

### Install Python Dependencies
```bash
cd aivora-rag-service
pip install -r requirements.txt
```

### Upgrade Python Packages
```bash
pip install --upgrade pip
pip install -r requirements.txt --upgrade
```

### Install Node Dependencies
```bash
cd Frontend
npm install
```

### Update Node Packages
```bash
cd Frontend
npm update
```

---

## 🔨 Development Commands

### Frontend Development
```bash
cd Frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format code
```

### Backend Development
```bash
cd aivora-rag-service
uvicorn app.main:app --reload              # Hot reload
uvicorn app.main:app --reload --port 8001  # Custom port
python -m pytest tests/ -v                 # Run tests
```

### Database
```bash
cd Frontend
npx supabase start     # Start local Supabase
npx supabase stop      # Stop Supabase
npx supabase db pull   # Pull schema changes
npx supabase db push   # Push migrations
```

---

## 🔧 Environment Setup

### Create Python Virtual Environment
```bash
cd aivora-rag-service
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### Setup Environment Files

**Frontend (.env.local)**
```bash
cp Frontend/.env.local.example Frontend/.env.local
# Edit Frontend/.env.local with your values
```

**RAG Service (.env)**
```bash
cp aivora-rag-service/.env.example aivora-rag-service/.env
# Edit aivora-rag-service/.env with your values
```

---

## 🔍 Debugging

### Check Service Health
```bash
# RAG Service
curl http://localhost:8001/health

# Frontend (browser)
# Open DevTools: F12
```

### View Logs

**RAG Service**
```bash
# Check console output in terminal
# Or check rag-start.log
cat aivora-rag-service/rag-start.log
```

**Frontend**
```bash
# Browser console
# Press F12 → Console tab
```

### Test API Endpoint
```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Authorization: Bearer your_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"org_id": "xxx", "service_id": "yyy"}
  }'
```

---

## 📊 Database Commands

### Access Database
```bash
# Through Supabase Studio
# Go to http://localhost:54323

# Through psql (if installed)
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

### View Orchestration Logs
```sql
SELECT * FROM orchestration_logs ORDER BY created_at DESC LIMIT 10;
```

### Check Conversation History
```sql
SELECT * FROM conversations WHERE org_id = 'your_org_id' LIMIT 5;
```

### View Messages
```sql
SELECT * FROM messages WHERE conversation_id = 'your_conversation_id';
```

---

## 🧹 Cleanup & Maintenance

### Clear Python Cache
```bash
cd aivora-rag-service
find . -type d -name __pycache__ -exec rm -r {} +
find . -type f -name "*.pyc" -delete
```

### Clear Node Modules
```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

### Reset Local Database
```bash
cd Frontend
npx supabase stop
rm -rf supabase/.branches supabase/.temp
npx supabase start
```

### Clean Build Artifacts
```bash
cd Frontend
rm -rf dist .output
npm run build
```

---

## 📝 Useful Patterns

### Test Intent Classification Locally
```bash
cd aivora-rag-service
python -c "
import asyncio
from app.services.intent_classifier import IntentClassifier

async def test():
    classifier = IntentClassifier()
    result = await classifier.classify_intent('I want to book an appointment')
    print(result)

asyncio.run(test())
"
```

### Check Model Download
```bash
python -c "from transformers import pipeline; pipeline('zero-shot-classification')"
```

### Run Single Service
```bash
# Just RAG Service (without frontend)
cd aivora-rag-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## 🚨 Common Issues & Solutions

### Port Already in Use
```bash
# Find process using port 8001
lsof -i :8001  # macOS/Linux
netstat -ano | findstr :8001  # Windows

# Kill process (Windows)
taskkill /PID <PID> /F

# Or use different port
uvicorn app.main:app --port 8002
```

### Python Module Not Found
```bash
# Ensure you're in virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Supabase Won't Start
```bash
# Make sure Docker is running
docker ps

# Check ports are free (54321, 54322)
# Reset database
npx supabase stop
rm -rf supabase/.branches supabase/.temp
npx supabase start
```

### Node Dependencies Issues
```bash
# Clear everything
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Or use npm ci for exact versions
npm ci
```

---

## 📚 Additional Resources

| Resource | Location |
|----------|----------|
| **Project Start** | `docs/quickstart/GETTING_STARTED.md` |
| **Setup Guide** | `docs/quickstart/LOCAL_RUN.md` |
| **Full Docs** | `docs/INDEX.md` |
| **Folder Structure** | `docs/references/FOLDER_STRUCTURE.md` |
| **Project Status** | `docs/PROJECT_STATUS.md` |
| **LangGraph Guide** | `docs/guides/README_LANGGRAPH.md` |

---

## 💡 Pro Tips

### Use npm scripts shortcuts
```bash
npm run dev      # Instead of npm run development
npm run build    # Instead of npm run production:build
```

### Use Python virtual environment
```bash
# Always use virtual env to avoid conflicts
python -m venv venv
source venv/bin/activate  # macOS/Linux
```

### Keep secrets in .env only
```bash
# Never commit .env files
# Use .env.example as template
# Only .example files belong in git
```

### Check health regularly
```bash
# During development
curl http://localhost:8001/health

# Should return
# {"status": "healthy", "service": "aivora-rag"}
```

---

## 🔗 Quick Links

- **GitHub**: Repository root
- **Frontend Dev**: http://localhost:8081
- **Backend API**: http://localhost:8001
- **Database Studio**: http://localhost:54323
- **Documentation**: `docs/INDEX.md`

---

**Last Updated:** October 2026
**Status:** Complete & Current
