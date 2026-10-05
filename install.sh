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
MCP_JS="$REPO_DIR/packages/mcp-sermon-prep/dist/index.js"

echo ""
echo -e "${BOLD}sermon-prepair – Gottesdienst-Vorbereitung${NC}"
echo -e "Installationsverzeichnis: ${BLUE}$REPO_DIR${NC}"

# ── 1. Voraussetzungen ───────────────────────────────────────────────────────
step "1/5  Voraussetzungen prüfen"

# Node.js ≥ 18
if ! command -v node &>/dev/null; then
  fail "Node.js nicht gefunden. Bitte installiere Node.js 18+ von https://nodejs.org/"
fi
NODE_BIN="$(command -v node)"
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $(node --version) gefunden – Version 18+ wird benötigt."
fi
ok "Node.js $(node --version) ($NODE_BIN)"

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
step "2/5  npm-Abhängigkeiten installieren / aktualisieren"

cd "$REPO_DIR"
info "npm install …"
npm install
ok "Abhängigkeiten aktuell"

# ── 3. MCP-Server bauen ──────────────────────────────────────────────────────
step "3/5  MCP-Server kompilieren"

info "npm run build …"
npm run build
ok "Build erfolgreich → $MCP_JS"

# ── 4. Claude-Integration ────────────────────────────────────────────────────
step "4/5  Claude-Integration einrichten"

mkdir -p "$COMMANDS_DIR"

# Skill-Dateien
cp "$REPO_DIR/.claude/commands/gottesdienst.md" "$COMMANDS_DIR/gottesdienst.md"
ok "Skill:    $COMMANDS_DIR/gottesdienst.md"

cp "$REPO_DIR/.claude/commands/gottesdienst-template.html" "$COMMANDS_DIR/gottesdienst-template.html"
ok "Template: $COMMANDS_DIR/gottesdienst-template.html"

# MCP via claude mcp add eintragen (–scope user → ~/.claude/settings.json)
info "MCP-Server registrieren …"
claude mcp remove --scope user sermon-prep 2>/dev/null || true
claude mcp add --scope user sermon-prep -- "$NODE_BIN" "$MCP_JS"
ok "MCP registriert (Scope: user)"

# ── 5. Bildgenerierung (optional) ────────────────────────────────────────────
step "5/5  Bildgenerierung prüfen (optional, für --bild)"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  info "Bildgenerierung (--bild) ist nur auf macOS mit Apple Silicon verfügbar – übersprungen."
else
  MFLUX_FOUND="${MFLUX_BIN:-}"
  if [ -z "$MFLUX_FOUND" ]; then
    if command -v mflux-generate-flux2 &>/dev/null; then
      MFLUX_FOUND="$(command -v mflux-generate-flux2)"
    elif [ -x "$HOME/.local/bin/mflux-generate-flux2" ]; then
      MFLUX_FOUND="$HOME/.local/bin/mflux-generate-flux2"
    fi
  fi

  if [ -n "$MFLUX_FOUND" ] && [ -x "$MFLUX_FOUND" ]; then
    ok "mflux gefunden ($MFLUX_FOUND)"
  else
    warn "mflux nicht gefunden – /gottesdienst --bild funktioniert erst nach der Installation:"
    warn "  brew install uv && uv tool install --upgrade mflux && uv tool update-shell"
  fi

  if [ -n "${HF_TOKEN:-}" ] || [ -s "$HOME/.cache/huggingface/token" ] || [ -s "$HOME/.huggingface/token" ]; then
    ok "Hugging Face-Login vorhanden"
  else
    warn "Kein Hugging Face-Login gefunden. FLUX.2 Klein 9B ist lizenzpflichtig:"
    warn "  1. Lizenz akzeptieren: https://huggingface.co/black-forest-labs/FLUX.2-klein-9B"
    warn "  2. Read-Token erstellen: https://huggingface.co/settings/tokens"
    warn "  3. uvx --from huggingface_hub hf auth login"
  fi
  info "Der erste Lauf lädt mehrere GB Modellgewichte (Peak-RAM ca. 20 GB, empfohlen: 32 GB)."
fi

# ── Fertig ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Installation abgeschlossen.${NC}"
echo ""
echo "  Starte Claude Code neu und verwende den Skill mit:"
echo -e "  ${BOLD}/gottesdienst 2026-06-28${NC}"
echo ""
