# 🔧 Troubleshooting Guide

## Common Issues & Solutions

---

## 🚀 Startup Issues

### Issue: "Start-Aivora.ps1 won't run"

**Symptoms:**
- PowerShell says "cannot be loaded because running scripts is disabled"

**Solutions:**

1. **Allow script execution (temporary)**
```bash
powershell -ExecutionPolicy Bypass -File .\Start-Aivora.ps1
```

2. **Allow for current user (permanent)**
```bash
powershell -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

3. **Run manually instead**
```bash
# Terminal 1
cd Frontend && npm run dev

# Terminal 2
cd aivora-rag-service && uvicorn app.main:app --reload

# Terminal 3
cd Frontend && npx supabase start
```

---

### Issue: "Docker is not running"

**Symptoms:**
- "Cannot connect to Docker daemon"
- Supabase won't start

**Solutions:**

1. **Start Docker Desktop**
   - Windows/Mac: Open Docker Desktop application
   - Linux: `sudo systemctl start docker`

2. **Verify Docker is running**
```bash
docker ps
```

3. **If still failing**
```bash
# Restart Docker
docker restart

# Or reinstall Docker
# https://docs.docker.com/get-docker/
```

---

### Issue: "Port already in use"

**Symptoms:**
- "Address already in use" error
- Service won't start

**Solutions:**

1. **Check what's using the port**
```bash
# macOS/Linux
lsof -i :8001
lsof -i :8081
lsof -i :54321

# Windows
netstat -ano | findstr :8001
netstat -ano | findstr :8081
netstat -ano | findstr :54321
```

2. **Kill the process**
```bash
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

3. **Or use different port**
```bash
# RAG Service on 8002
uvicorn app.main:app --port 8002

# Frontend on 3000
npm run dev -- --port 3000
```

---

## 🐍 Python & Dependencies

### Issue: "ModuleNotFoundError: No module named 'xxx'"

**Symptoms:**
- "No module named 'langgraph'"
- "No module named 'fastapi'"

**Solutions:**

1. **Activate virtual environment**
```bash
# macOS/Linux
source aivora-rag-service/venv/bin/activate

# Windows
aivora-rag-service\venv\Scripts\activate
```

2. **Install dependencies**
```bash
cd aivora-rag-service
pip install -r requirements.txt
```

3. **If still failing, upgrade pip**
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. **Or reinstall all**
```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt --upgrade
```

---

### Issue: "Python version incompatible"

**Symptoms:**
- "This script requires Python 3.9+"
- Version error messages

**Solutions:**

1. **Check Python version**
```bash
python --version
python3 --version
```

2. **Ensure 3.9 or higher**
   - Download from https://www.python.org/
   - Minimum: Python 3.9
   - Recommended: Python 3.10+

3. **Use specific Python version**
```bash
python3.10 -m pip install -r requirements.txt
python3.10 -m uvicorn app.main:app --reload
```

---

### Issue: "pip install hangs or times out"

**Symptoms:**
- Installation takes forever
- Network timeout errors

**Solutions:**

1. **Use different index**
```bash
pip install -r requirements.txt -i https://pypi.org/simple/
```

2. **Increase timeout**
```bash
pip install -r requirements.txt --default-timeout=1000
```

3. **Install packages one by one**
```bash
pip install langgraph
pip install langchain
# etc.
```

---

## 📦 Node & Frontend

### Issue: "npm command not found"

**Symptoms:**
- "npm: command not found"
- "npm is not recognized"

**Solutions:**

1. **Install Node.js**
   - Download from https://nodejs.org/
   - Minimum: 18.x LTS
   - Recommended: 20.x LTS

2. **Verify installation**
```bash
node --version
npm --version
```

3. **Restart terminal** after installation

---

### Issue: "npm install fails"

**Symptoms:**
- ERESOLVE unable to resolve dependency
- ERR! code E409

**Solutions:**

1. **Clear npm cache**
```bash
npm cache clean --force
```

2. **Delete and reinstall**
```bash
rm -rf node_modules package-lock.json
npm install
```

3. **Use npm ci (safer)**
```bash
npm ci
```

4. **Try different registry**
```bash
npm install --registry https://registry.npmjs.org/
```

---

### Issue: "Vite dev server won't start"

**Symptoms:**
- "EADDRINUSE" (port in use)
- Blank screen in browser

**Solutions:**

1. **Try different port**
```bash
npm run dev -- --port 3000
```

2. **Check browser console** (F12)
   - Look for error messages
   - Check Network tab for failed requests

3. **Restart everything**
```bash
# Kill all processes
# Clear cache
rm -rf node_modules dist .output
npm install
npm run dev
```

---

## 🗄️ Database Issues

### Issue: "Supabase won't start"

**Symptoms:**
- "Cannot create container"
- "Port 54321 in use"

**Solutions:**

1. **Ensure Docker is running**
```bash
docker ps
```

2. **Check ports are free**
```bash
# 54321, 54322 should be free
lsof -i :54321
lsof -i :54322
```

3. **Reset Supabase**
```bash
cd Frontend
npx supabase stop
rm -rf supabase/.branches supabase/.temp
npx supabase start
```

4. **Full reset**
```bash
docker system prune -a
cd Frontend
npx supabase start
```

---

### Issue: "Can't connect to database"

**Symptoms:**
- "Connection refused"
- "ECONNREFUSED"

**Solutions:**

1. **Verify Supabase is running**
```bash
npx supabase status
```

2. **Check connection string**
```bash
# Should be something like:
# postgresql://postgres:postgres@localhost:54322/postgres
```

3. **Verify credentials in .env**
```bash
cat aivora-rag-service/.env | grep SUPABASE
```

4. **Restart Supabase**
```bash
npx supabase stop
npx supabase start
```

---

### Issue: "Migration failed"

**Symptoms:**
- "Database migration error"
- Schema mismatch errors

**Solutions:**

1. **Check migration status**
```bash
npx supabase migration list
```

2. **Reset to clean state** (loses data)
```bash
npx supabase db reset
```

3. **Pull latest schema**
```bash
npx supabase db pull
```

---

## 🧠 API & Backend

### Issue: "Health check fails"

**Symptoms:**
- `curl http://localhost:8001/health` returns error
- Service won't respond

**Solutions:**

1. **Verify service is running**
```bash
ps aux | grep uvicorn  # macOS/Linux
tasklist | findstr uvicorn  # Windows
```

2. **Check port**
```bash
lsof -i :8001  # macOS/Linux
netstat -ano | findstr :8001  # Windows
```

3. **Restart service**
```bash
# Kill old process
# Start new one
cd aivora-rag-service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

---

### Issue: "LangGraph models won't load"

**Symptoms:**
- "Model not found" error
- First startup takes very long

**Solutions:**

1. **Understand it's normal**
   - First run: 2-5 seconds (model download ~800MB)
   - Subsequent runs: ~100ms (cached)

2. **Pre-download models**
```bash
python -c "from transformers import pipeline; pipeline('zero-shot-classification')"
```

3. **Check disk space**
   - Need ~2GB free for models
   - Models stored in ~/.cache/huggingface/

4. **Manual download location**
```bash
export HF_HOME=/custom/path
python -c "from transformers import pipeline; pipeline('zero-shot-classification')"
```

---

### Issue: "API returns 401 Unauthorized"

**Symptoms:**
- "Invalid authentication"
- "Authorization required"

**Solutions:**

1. **Check shared secret**
```bash
# In your request
curl -H "Authorization: Bearer your_secret" http://localhost:8001/...

# Should match ORCHESTRATION_SHARED_SECRET in .env
cat aivora-rag-service/.env | grep ORCHESTRATION
```

2. **Verify headers**
```bash
# Should include both
curl -H "Authorization: Bearer your_secret" \
     -H "Content-Type: application/json" \
     http://localhost:8001/...
```

3. **Reset secrets**
```bash
# Generate new secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update both .env files
# Restart service
```

---

## 🌐 Frontend Issues

### Issue: "Blank white page"

**Symptoms:**
- Page loads but shows nothing
- No console errors

**Solutions:**

1. **Check browser console** (F12)
   - Look for errors
   - Check Network tab

2. **Check if backend is running**
```bash
curl http://localhost:8001/health
```

3. **Clear browser cache**
   - Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
   - Clear all data

4. **Hard refresh**
   - Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

### Issue: "Can't authenticate / Login fails"

**Symptoms:**
- Login button doesn't work
- Redirect loop

**Solutions:**

1. **Check Supabase connection**
```bash
# From browser console
fetch('http://localhost:54323')
```

2. **Verify VITE env variables**
```bash
cat Frontend/.env.local | grep VITE_SUPABASE
```

3. **Check Supabase is running**
```bash
npx supabase status
```

4. **Restart frontend**
```bash
cd Frontend
npm run dev
```

---

## 🔍 Debugging Tips

### Enable Debug Mode

**Python**
```bash
export DEBUG=1
uvicorn app.main:app --reload --log-level debug
```

**Node/Frontend**
```bash
set DEBUG=*  # Windows
export DEBUG=*  # macOS/Linux
npm run dev
```

### Check Logs

**RAG Service**
```bash
# View file
tail -f aivora-rag-service/rag-start.log

# Or check terminal output
```

**Frontend**
```bash
# Browser console (F12)
# Network tab shows all requests
```

**Database**
```bash
# Through Supabase Studio
http://localhost:54323
```

---

## 🆘 Advanced Troubleshooting

### Full System Reset
```bash
# Stop everything
npx supabase stop
npm install # or yarn

# Clear all caches
npm cache clean --force
pip cache purge
docker system prune -a

# Reinstall everything
rm -rf node_modules venv
npm install
python -m venv venv
pip install -r requirements.txt

# Start fresh
npx supabase start
npm run dev
uvicorn app.main:app --reload
```

### Collect Debug Info
```bash
# Versions
python --version
node --version
npm --version
docker --version

# Status
docker ps
npx supabase status
curl http://localhost:8001/health

# System info
# macOS: system_profiler SPHardwareDataType
# Windows: systeminfo
# Linux: uname -a
```

### Get Help
1. Check `docs/quickstart/QUICK_COMMANDS.md` for command reference
2. Review `docs/INDEX.md` for documentation
3. Check `aivora-rag-service/README.md` for backend issues
4. Check `Frontend/README.md` for frontend issues

---

## 📞 Still Stuck?

### Check These Resources
- [ ] `docs/quickstart/GETTING_STARTED.md` - Basic setup
- [ ] `docs/quickstart/LOCAL_RUN.md` - Detailed setup
- [ ] `docs/references/QUICK_COMMANDS.md` - Command reference
- [ ] `docs/references/FOLDER_STRUCTURE.md` - Navigate codebase
- [ ] `docs/INDEX.md` - Documentation hub

### Information to Include in Bug Report
- [ ] Exact error message
- [ ] Steps to reproduce
- [ ] Python/Node versions
- [ ] Operating system
- [ ] What you've already tried

---

**Last Updated:** October 2026
**Status:** Comprehensive & Updated
