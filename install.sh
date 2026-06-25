#!/usr/bin/env bash
# install.sh – sermon-prepair Installation für macOS und Linux
set -euo pipefail

# ── Farben ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "  ${RED}✗${NC}  $*"; exit 1; }
info() { echo -e "  ${BLUE}→${NC}  $*"; }
step() { echo -e "\n${BOLD}$*${NC}"; }

# ── Pfade ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
COMMANDS_DIR="$CLAUDE_DIR/commands"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
MCP_JS="$REPO_DIR/packages/mcp-sermon-prep/dist/index.js"

echo ""
echo -e "${BOLD}sermon-prepair – Gottesdienst-Vorbereitung${NC}"
echo -e "Installationsverzeichnis: ${BLUE}$REPO_DIR${NC}"

# ── 1. Voraussetzungen ───────────────────────────────────────────────────────
step "1/4  Voraussetzungen prüfen"

# Node.js ≥ 18
if ! command -v node &>/dev/null; then
  fail "Node.js nicht gefunden. Bitte installiere Node.js 18+ von https://nodejs.org/"
fi
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $(node --version) gefunden – Version 18+ wird benötigt."
fi
ok "Node.js $(node --version)"

# npm ≥ 7
if ! command -v npm &>/dev/null; then
  fail "npm nicht gefunden."
fi
NPM_MAJOR=$(npm --version | cut -d. -f1)
if [ "$NPM_MAJOR" -lt 7 ]; then
  fail "npm $(npm --version) gefunden – Version 7+ wird benötigt."
fi
ok "npm $(npm --version)"

# Claude Code (optional, aber empfohlen)
if command -v claude &>/dev/null; then
  CLAUDE_VER=$(claude --version 2>/dev/null || echo "unbekannt")
  ok "Claude Code $CLAUDE_VER"
else
  warn "Claude Code nicht gefunden – bitte installieren: https://claude.ai/code"
  warn "MCP-Server und Skill werden trotzdem eingerichtet."
fi

# ── 2. Abhängigkeiten ────────────────────────────────────────────────────────
step "2/4  npm-Abhängigkeiten installieren / aktualisieren"

cd "$REPO_DIR"
info "npm install …"
npm install
ok "Abhängigkeiten aktuell"

# ── 3. MCP-Server bauen ──────────────────────────────────────────────────────
step "3/4  MCP-Server kompilieren"

info "npm run build …"
npm run build
ok "Build erfolgreich → $MCP_JS"

# ── 4. Claude-Integration ────────────────────────────────────────────────────
step "4/4  Claude-Integration einrichten"

mkdir -p "$COMMANDS_DIR"

# Skill-Dateien
cp "$REPO_DIR/.claude/commands/gottesdienst.md" "$COMMANDS_DIR/gottesdienst.md"
ok "Skill:    $COMMANDS_DIR/gottesdienst.md"

cp "$REPO_DIR/.claude/commands/gottesdienst-template.html" "$COMMANDS_DIR/gottesdienst-template.html"
ok "Template: $COMMANDS_DIR/gottesdienst-template.html"

# MCP in ~/.claude/settings.json eintragen (via Node.js – kein jq nötig)
info "MCP-Server in $SETTINGS_FILE eintragen …"
node --input-type=module <<EOF
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const settingsPath = '${SETTINGS_FILE}';
let settings = {};
if (existsSync(settingsPath)) {
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
}
settings.mcpServers ??= {};
const existing = settings.mcpServers['sermon-prep'];
settings.mcpServers['sermon-prep'] = { command: 'node', args: ['${MCP_JS}'] };
mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(existing ? 'aktualisiert' : 'neu eingetragen');
EOF
ok "MCP registriert in: $SETTINGS_FILE"

# ── Fertig ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Installation abgeschlossen.${NC}"
echo ""
echo "  Starte Claude Code neu und verwende den Skill mit:"
echo -e "  ${BOLD}/gottesdienst 2026-06-28${NC}"
echo ""
