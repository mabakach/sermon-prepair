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
$RepoDir      = $PSScriptRoot
$ClaudeDir    = Join-Path $HOME '.claude'
$CommandsDir  = Join-Path $ClaudeDir 'commands'
$SettingsFile = Join-Path $ClaudeDir 'settings.json'
$McpJs        = Join-Path $RepoDir 'packages\mcp-sermon-prep\dist\index.js'

Write-Host ""
Write-Host "sermon-prepair – Gottesdienst-Vorbereitung" -ForegroundColor White
Write-Host "Installationsverzeichnis: $RepoDir" -ForegroundColor Cyan

# ── 1. Voraussetzungen ───────────────────────────────────────────────────────
Write-Step "1/4  Voraussetzungen prüfen"

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
Write-Step "2/4  npm-Abhängigkeiten installieren / aktualisieren"

Set-Location $RepoDir
Write-Info "npm install ..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install fehlgeschlagen." }
Write-Ok "Abhängigkeiten aktuell"

# ── 3. MCP-Server bauen ──────────────────────────────────────────────────────
Write-Step "3/4  MCP-Server kompilieren"

Write-Info "npm run build ..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build fehlgeschlagen." }
Write-Ok "Build erfolgreich -> $McpJs"

# ── 4. Claude-Integration ────────────────────────────────────────────────────
Write-Step "4/4  Claude-Integration einrichten"

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

# MCP in settings.json eintragen / aktualisieren
Write-Info "MCP-Server in $SettingsFile eintragen ..."

New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null

$settings = @{}
if (Test-Path $SettingsFile) {
  try {
    $raw = Get-Content $SettingsFile -Raw -Encoding UTF8
    if ($raw.Trim()) {
      $settings = $raw | ConvertFrom-Json -AsHashtable
    }
  } catch {
    Write-Warn "settings.json konnte nicht gelesen werden – wird neu erstellt."
  }
}

if (-not $settings.ContainsKey('mcpServers')) {
  $settings['mcpServers'] = @{}
}

$existed = $settings['mcpServers'].ContainsKey('sermon-prep')
# Pfadtrenner: Windows-Backslash in JSON als Forward-Slash für Node-Kompatibilität
$mcpJsForward  = $McpJs -replace '\\','/'
$nodeBinForward = $NodeBin -replace '\\','/'
$settings['mcpServers']['sermon-prep'] = @{
  command = $nodeBinForward
  args    = @($mcpJsForward)
}

$settings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
$action = if ($existed) { 'aktualisiert' } else { 'neu eingetragen' }
Write-Ok "MCP $action in: $SettingsFile"

# ── Fertig ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Installation abgeschlossen." -ForegroundColor Green
Write-Host ""
Write-Host "  Starte Claude Code neu und verwende den Skill mit:"
Write-Host "  /gottesdienst 2026-06-28" -ForegroundColor White
Write-Host ""
