#Requires -Version 5.1
<#
.SYNOPSIS
    Starts the full Aivora AI Voice Receptionist stack.

.DESCRIPTION
    Launches in order:
      1. Docker Desktop (if not already running)
      2. Local Supabase  (database, auth, storage)
      3. RAG / AI Orchestration service  (port 8001)
      4. Frontend Vite dev server  (port 8081)

    Each service opens in its own colour-coded PowerShell window.
    A status summary is printed at the end and the browser opens automatically.

.PARAMETER Reset
    Wipes the local Supabase database and re-applies all migrations from
    scratch. Use on a fresh machine or after schema changes.

.PARAMETER SkipDockerCheck
    Skip the Docker Desktop readiness wait (useful if you know Docker is
    already running and want a faster start).

.EXAMPLE
    .\Start-Aivora.ps1

.EXAMPLE
    .\Start-Aivora.ps1 -Reset
#>

param(
    [switch]$Reset,
    [switch]$SkipDockerCheck
)

# Use Continue so that native-command stderr never throws a terminating error.
# We check $LASTEXITCODE explicitly wherever we need to detect failures.
$ErrorActionPreference = 'Continue'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$Root        = $PSScriptRoot
$FrontendDir = Join-Path $Root "Frontend"
$RagDir      = Join-Path $Root "aivora-rag-service"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
function Write-Header([string]$Text) {
    Write-Host ""
    Write-Host ("-" * 60) -ForegroundColor DarkGray
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray
}
function Write-Step([string]$Text) { Write-Host "  >> $Text" -ForegroundColor Yellow    }
function Write-Ok([string]$Text)   { Write-Host "  OK  $Text" -ForegroundColor Green    }
function Write-Warn([string]$Text) { Write-Host "  !!  $Text" -ForegroundColor DarkYellow }
function Write-Err([string]$Text)  { Write-Host "  ERR $Text" -ForegroundColor Red      }

# Run a native command quietly, capturing all output (stdout + stderr merged).
# Returns the combined output as a single string.
function Invoke-Native([string]$Exe, [string[]]$ArgList) {
    $out = & $Exe @ArgList 2>&1
    return ($out -join "`n")
}

# Test whether a URL responds with a non-5xx status code.
function Test-Http([string]$Uri, [int]$TimeoutSec = 3) {
    try {
        $r = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction SilentlyContinue
        return ($r.StatusCode -lt 500)
    } catch {
        # Invoke-WebRequest throws on 4xx in some PS versions
        if ($_.Exception.Response) {
            return ($_.Exception.Response.StatusCode.value__ -lt 500)
        }
        return $false
    }
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
Write-Header "Aivora -- Pre-flight checks"

# 1. Required directories
foreach ($dir in @($FrontendDir, $RagDir)) {
    if (-not (Test-Path $dir)) {
        Write-Err "Directory not found: $dir"
        exit 1
    }
}
Write-Ok "Project directories found"

# 2. Docker Desktop
if (-not $SkipDockerCheck) {
    Write-Step "Checking Docker Desktop..."
    $dockerRunning = $false

    for ($i = 1; $i -le 30; $i++) {
        # Suppress all output; we only care about the exit code
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) { $dockerRunning = $true; break }

        if ($i -eq 1) {
            Write-Warn "Docker Desktop is not responding -- trying to start it..."
            $dockerExe = "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerExe) {
                Start-Process $dockerExe -ErrorAction SilentlyContinue
            } else {
                Write-Warn "Could not find Docker Desktop.exe -- please open Docker Desktop manually."
            }
        }
        Write-Host "    waiting for Docker... ($i / 30)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }

    if (-not $dockerRunning) {
        Write-Err "Docker Desktop did not start within 90 s. Open it manually and rerun."
        exit 1
    }
    Write-Ok "Docker Desktop is running"
}

# 3. Node / npm
$nodeVer = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Node.js not found. Install from https://nodejs.org"
    exit 1
}
Write-Ok "Node $nodeVer"

# 4. Frontend .env.local
$envLocal = Join-Path $FrontendDir ".env.local"
if (-not (Test-Path $envLocal)) {
    Write-Err ".env.local not found at $envLocal"
    Write-Host "    Copy Frontend\.env.local.example to Frontend\.env.local and fill in your API keys." -ForegroundColor DarkGray
    exit 1
}
Write-Ok "Frontend\.env.local present"

# 5. RAG .env
$ragEnv = Join-Path $RagDir ".env"
if (-not (Test-Path $ragEnv)) {
    Write-Err ".env not found at $ragEnv"
    Write-Host "    Copy aivora-rag-service\.env.local.example to aivora-rag-service\.env and fill in OPENAI_API_KEY." -ForegroundColor DarkGray
    exit 1
}
Write-Ok "aivora-rag-service\.env present"

# 6. Warn on empty / placeholder credentials
$envContent = Get-Content $envLocal -Raw
$ragContent  = Get-Content $ragEnv  -Raw
$missing = [System.Collections.Generic.List[string]]::new()

if ($envContent -match 'VAPI_API_KEY\s*=\s*($|\r|\n|PASTE)') {
    $missing.Add("VAPI_API_KEY  (Frontend\.env.local)")
}
if ($ragContent -match 'OPENAI_API_KEY\s*=\s*($|\r|\n|PASTE)') {
    $missing.Add("OPENAI_API_KEY  (aivora-rag-service\.env)")
}
if ($missing.Count -gt 0) {
    Write-Warn "These API keys look empty -- voice calls and RAG will not work:"
    foreach ($m in $missing) { Write-Host "      - $m" -ForegroundColor DarkYellow }
    Write-Host ""
    $ans = Read-Host "  Continue anyway? [y/N]"
    if ($ans -notmatch '^[Yy]') { exit 0 }
}

# ---------------------------------------------------------------------------
# npm install (skip if node_modules is up to date)
# ---------------------------------------------------------------------------
Write-Header "Frontend -- npm install"

$nmDir   = Join-Path $FrontendDir "node_modules"
$pkgJson = Join-Path $FrontendDir "package.json"

$needsInstall = $false
if (-not (Test-Path $nmDir)) {
    $needsInstall = $true
    Write-Step "node_modules not found -- running npm install"
} elseif ((Get-Item $pkgJson).LastWriteTime -gt (Get-Item $nmDir).LastWriteTime) {
    $needsInstall = $true
    Write-Step "package.json is newer than node_modules -- running npm install"
} else {
    Write-Ok "node_modules is up to date -- skipping install"
}

if ($needsInstall) {
    Push-Location $FrontendDir
    npm install --silent 2>&1 | Out-Null
    $installExit = $LASTEXITCODE
    Pop-Location
    if ($installExit -ne 0) {
        Write-Err "npm install failed (exit $installExit). Run 'npm install' manually in Frontend\ to see errors."
        exit 1
    }
    Write-Ok "npm install complete"
}

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------
Write-Header "Supabase -- local database"

# Kong returns 404 on / -- anything below 500 means it is up.
$supabaseUp = Test-Http "http://127.0.0.1:54321"

if ($supabaseUp -and -not $Reset) {
    Write-Ok "Supabase is already running -- skipping start"
} else {
    if ($Reset) {
        Write-Step "Reset flag set -- stopping Supabase and wiping volumes..."
        Push-Location $FrontendDir
        $null = npx --yes supabase stop --no-backup 2>&1
        Pop-Location
        Write-Ok "Supabase stopped and volumes cleared"
    }

    Write-Step "Starting Supabase (first run downloads images -- can take a few minutes)..."

    # Launch supabase start in a background job so we can poll in parallel
    $supaJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        $null = npx --yes supabase start 2>&1
    } -ArgumentList $FrontendDir

    $supaReady = $false
    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 3
        if (Test-Http "http://127.0.0.1:54321") { $supaReady = $true; break }
        if ($i % 5 -eq 0) {
            Write-Host "    still waiting for Supabase... ($($i * 3)s / 180s)" -ForegroundColor DarkGray
        }
    }

    $null = Stop-Job  $supaJob -ErrorAction SilentlyContinue
    Remove-Job $supaJob -ErrorAction SilentlyContinue

    if (-not $supaReady) {
        Write-Err "Supabase did not become ready in 3 minutes."
        Write-Host "    Try: cd Frontend && npx supabase start" -ForegroundColor DarkGray
        exit 1
    }
    Write-Ok "Supabase is up at http://127.0.0.1:54321"
}

# Apply / push migrations
if ($Reset) {
    Write-Step "Applying all migrations (db reset)..."
    Push-Location $FrontendDir
    # Capture output; filter to the interesting lines for display
    $dbOut = npx --yes supabase db reset 2>&1
    $dbExit = $LASTEXITCODE
    Pop-Location

    # Print only meaningful lines (suppress spinner/progress noise)
    $dbOut | ForEach-Object {
        $line = "$_"
        if ($line -match 'Applying|Finished|ERROR|error|failed') {
            Write-Host "    $line" -ForegroundColor DarkGray
        }
    }

    # supabase CLI exits 0 even on some errors; also check for error text
    $dbFailed = ($dbExit -ne 0) -or ($dbOut -match 'ERROR|failed')
    if ($dbFailed) {
        Write-Err "supabase db reset reported an error. Check output above."
        exit 1
    }
    Write-Ok "All migrations applied"
} else {
    Write-Step "Pushing any pending migrations..."
    Push-Location $FrontendDir
    $dbOut = npx --yes supabase db push 2>&1
    Pop-Location
    $dbOut | ForEach-Object {
        $line = "$_"
        if ($line -match 'Applying|Finished|up to date|No migrations|ERROR|error') {
            Write-Host "    $line" -ForegroundColor DarkGray
        }
    }
    Write-Ok "Migrations up to date"
}

# ---------------------------------------------------------------------------
# RAG / AI Orchestration service (port 8001)
# ---------------------------------------------------------------------------
Write-Header "RAG / AI Orchestration service (port 8001)"

if (Test-Http "http://localhost:8001/health") {
    Write-Ok "RAG service already running at http://localhost:8001"
} else {
    Write-Step "Launching RAG service in a new window (docker compose up --build)..."

    # Build the command string for the child window
    $ragCmd = "& {" +
        " `$host.UI.RawUI.WindowTitle = 'Aivora - RAG Service';" +
        " Set-Location '$RagDir';" +
        " Write-Host '=== Aivora RAG Service ===' -ForegroundColor Cyan;" +
        " docker compose up --build" +
        " }"

    Start-Process powershell -ArgumentList @("-NoExit", "-Command", $ragCmd)

    Write-Step "Waiting for RAG service to become healthy (up to 90 s)..."
    $ragReady = $false
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 3
        if (Test-Http "http://localhost:8001/health") { $ragReady = $true; break }
        if ($i % 5 -eq 0) {
            Write-Host "    still waiting... ($($i * 3)s / 90s)" -ForegroundColor DarkGray
        }
    }

    if ($ragReady) {
        Write-Ok "RAG service is healthy at http://localhost:8001/health"
    } else {
        Write-Warn "RAG service did not respond in 90 s -- check the RAG window for errors."
        Write-Warn "The frontend will still start; RAG features won't work until it's healthy."
    }
}

# ---------------------------------------------------------------------------
# Frontend -- Vite dev server
# ---------------------------------------------------------------------------
Write-Header "Frontend -- Vite dev server"

Write-Step "Launching Vite in a new window..."

# Call vite directly (not via npm run dev) so CLI flags are passed correctly.
# npm's -- separator does not forward unknown flags to the underlying binary in npm v10+.
$feCmd = "& {" +
    " `$host.UI.RawUI.WindowTitle = 'Aivora - Frontend';" +
    " Set-Location '$FrontendDir';" +
    " Write-Host '=== Aivora Frontend ===' -ForegroundColor Green;" +
    " npx vite dev --host 0.0.0.0 --port 4000 --strictPort" +
    " }"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $feCmd)

# vite.config.ts pins the dev server to port 4000 with strictPort.
# TanStack Start's SSR handler takes ~20-30 s to warm up after Vite binds the port,
# so we wait for an actual HTTP 200 before opening the browser.
$frontendUrl = "http://localhost:4000"

# Phase 1 -- wait for Vite to bind port 4000 (TCP, fast)
Write-Step "Waiting for Vite to bind port 4000 (up to 30 s)..."
$vitebound = $false
for ($wait = 1; $wait -le 15; $wait++) {
    Start-Sleep -Seconds 2
    try {
        $tcp  = New-Object System.Net.Sockets.TcpClient
        $conn = $tcp.BeginConnect("localhost", 4000, $null, $null)
        $ok   = $conn.AsyncWaitHandle.WaitOne(500)
        $tcp.Close()
        if ($ok) { $viteBound = $true; break }
    } catch {}
    if ($wait % 5 -eq 0) {
        Write-Host "    still waiting for Vite... ($($wait * 2)s / 30s)" -ForegroundColor DarkGray
    }
}

if (-not $viteBound) {
    Write-Warn "Vite did not bind port 4000 in 30 s -- check the green window."
}

# Phase 2 -- wait for SSR to warm up (HTTP 200, takes ~25 s)
Write-Step "Vite is up -- waiting for SSR to warm up (up to 60 s)..."
$ssrReady = $false
for ($wait = 1; $wait -le 30; $wait++) {
    Start-Sleep -Seconds 2
    if (Test-Http $frontendUrl -TimeoutSec 2) { $ssrReady = $true; break }
    if ($wait % 5 -eq 0) {
        Write-Host "    SSR still warming up... ($($wait * 2)s / 60s)" -ForegroundColor DarkGray
    }
}

if ($ssrReady) {
    Write-Ok "Frontend is live at $frontendUrl"
} else {
    Write-Warn "SSR did not respond in 60 s -- browser opening anyway. Refresh if you see a 404."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Header "All services started"
Write-Host ""
Write-Host "  Service                  URL" -ForegroundColor White
Write-Host ("  " + "-" * 55) -ForegroundColor DarkGray
Write-Host "  Frontend (UI)            $frontendUrl  (pinned)" -ForegroundColor Green
Write-Host "  RAG / AI Orchestration   http://localhost:8001/health" -ForegroundColor Cyan
Write-Host "  Supabase API             http://127.0.0.1:54321" -ForegroundColor Magenta
Write-Host "  Supabase Studio (DB UI)  http://127.0.0.1:54323" -ForegroundColor Magenta
Write-Host "  Supabase Email catcher   http://127.0.0.1:54324" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Tips:" -ForegroundColor White
Write-Host "    Signup confirmation emails -> http://127.0.0.1:54324" -ForegroundColor DarkGray
Write-Host "    Close each coloured window to stop that service" -ForegroundColor DarkGray
Write-Host "    Full reset:  .\Start-Aivora.ps1 -Reset" -ForegroundColor DarkGray
Write-Host "    For live Vapi calls, expose the RAG service with a tunnel:" -ForegroundColor DarkGray
Write-Host "      ngrok http 8001" -ForegroundColor DarkGray
Write-Host "    Then in Supabase Studio run:" -ForegroundColor DarkGray
Write-Host "      update app_config set orchestration_enabled=true, orchestration_url='https://YOUR_TUNNEL/v1/chat/completions' where id=true;" -ForegroundColor DarkGray
Write-Host "    Then press Save/Sync in the Voice Builder." -ForegroundColor DarkGray
Write-Host ""

# Open frontend in default browser
try { Start-Process $frontendUrl } catch {}
