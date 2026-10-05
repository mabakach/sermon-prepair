#Requires -Version 5.1
# install.ps1 – sermon-prepair Installation für Windows (PowerShell)
# Aufruf: .\install.ps1
# Falls Execution Policy blockiert: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function Write-Step  { param($Text) Write-Host "`n$Text" -ForegroundColor White }
function Write-Ok    { param($Text) Write-Host "  $([char]0x2713)  $Text" -ForegroundColor Green }
function Write-Warn  { param($Text) Write-Host "  !  $Text" -ForegroundColor Yellow }
function Write-Info  { param($Text) Write-Host "  ->  $Text" -ForegroundColor Cyan }
function Write-Fail  {
  param($Text)
  Write-Host "  $([char]0x00D7)  $Text" -ForegroundColor Red
  exit 1
}

# Versionszahl als [int[]] für Vergleiche
function Get-VersionParts {
  param([string]$v)
  ($v -replace '^[^0-9]*','') -split '\.' | ForEach-Object { [int]$_ }
}

# ── Pfade ────────────────────────────────────────────────────────────────────
$RepoDir     = $PSScriptRoot
$ClaudeDir   = Join-Path $HOME '.claude'
$CommandsDir = Join-Path $ClaudeDir 'commands'
$McpJs       = Join-Path $RepoDir 'packages\mcp-sermon-prep\dist\index.js'

Write-Host ""
Write-Host "sermon-prepair – Gottesdienst-Vorbereitung" -ForegroundColor White
Write-Host "Installationsverzeichnis: $RepoDir" -ForegroundColor Cyan

# ── 1. Voraussetzungen ───────────────────────────────────────────────────────
Write-Step "1/5  Voraussetzungen prüfen"

# Node.js >= 18
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Fail "Node.js nicht gefunden. Bitte installiere Node.js 18+ von https://nodejs.org/"
}
$NodeBin     = $nodeCmd.Source
$nodeVersion = (node --version) -replace '^v',''
$nodeMajor   = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 18) {
  Write-Fail "Node.js v$nodeVersion gefunden – Version 18+ wird benötigt."
}
Write-Ok "Node.js v$nodeVersion ($NodeBin)"

# npm >= 7
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  Write-Fail "npm nicht gefunden."
}
$npmVersion = npm --version
$npmMajor   = [int]($npmVersion -split '\.')[0]
if ($npmMajor -lt 7) {
  Write-Fail "npm $npmVersion gefunden – Version 7+ wird benötigt."
}
Write-Ok "npm $npmVersion"

# Claude Code (optional)
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if ($claudeCmd) {
  $claudeVersion = (claude --version 2>$null) ?? 'unbekannt'
  Write-Ok "Claude Code $claudeVersion"
} else {
  Write-Warn "Claude Code nicht gefunden – bitte installieren: https://claude.ai/code"
  Write-Warn "MCP-Server und Skill werden trotzdem eingerichtet."
}

# ── 2. Abhängigkeiten ────────────────────────────────────────────────────────
Write-Step "2/5  npm-Abhängigkeiten installieren / aktualisieren"

Set-Location $RepoDir
Write-Info "npm install ..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install fehlgeschlagen." }
Write-Ok "Abhängigkeiten aktuell"

# ── 3. MCP-Server bauen ──────────────────────────────────────────────────────
Write-Step "3/5  MCP-Server kompilieren"

Write-Info "npm run build ..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build fehlgeschlagen." }
Write-Ok "Build erfolgreich -> $McpJs"

# ── 4. Claude-Integration ────────────────────────────────────────────────────
Write-Step "4/5  Claude-Integration einrichten"

# Verzeichnis anlegen
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null

# Skill-Dateien kopieren
Copy-Item -Force `
  (Join-Path $RepoDir '.claude\commands\gottesdienst.md') `
  (Join-Path $CommandsDir 'gottesdienst.md')
Write-Ok "Skill:    $CommandsDir\gottesdienst.md"

Copy-Item -Force `
  (Join-Path $RepoDir '.claude\commands\gottesdienst-template.html') `
  (Join-Path $CommandsDir 'gottesdienst-template.html')
Write-Ok "Template: $CommandsDir\gottesdienst-template.html"


# MCP via claude mcp add eintragen (--scope user → ~/.claude/settings.json)
Write-Info "MCP-Server registrieren ..."
claude mcp remove --scope user sermon-prep 2>$null
claude mcp add --scope user sermon-prep -- $NodeBin $McpJs
if ($LASTEXITCODE -ne 0) { Write-Fail "claude mcp add fehlgeschlagen." }
Write-Ok "MCP registriert (Scope: user)"

# ── 5. Bildgenerierung ───────────────────────────────────────────────────────
Write-Step "5/5  Bildgenerierung (optional, für --bild)"
Write-Info "Bildgenerierung (--bild) ist unter Windows nicht verfügbar (nur macOS mit Apple Silicon)."

# ── Fertig ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Installation abgeschlossen." -ForegroundColor Green
Write-Host ""
Write-Host "  Starte Claude Code neu und verwende den Skill mit:"
Write-Host "  /gottesdienst 2026-06-28" -ForegroundColor White
Write-Host ""
