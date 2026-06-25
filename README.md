# sermon-prepair

Claude-Skill zur Vorbereitung reformierter Gottesdienste. Holt automatisch den Sonntagsnamen, die liturgische Farbe sowie die Perikopenordnung und zeigt die Bibeltexte aus der Zürcherbibel an.

## Voraussetzungen

| Voraussetzung | Mindestversion | Prüfen |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 (built-in `fetch`) | `node --version` |
| npm | 7 (Workspaces) | `npm --version` |
| [Claude Code](https://claude.ai/code) | aktuell | `claude --version` |

## Installation

### 1. Repository klonen und Abhängigkeiten installieren

```bash
git clone <repo-url> ~/sermon-prepair
cd ~/sermon-prepair
npm install
npm run build
```

### 2. MCP-Server registrieren

Öffne (oder erstelle) `~/.claude/settings.json` und füge den `sermon-prep`-Eintrag unter `mcpServers` ein:

```json
{
  "mcpServers": {
    "sermon-prep": {
      "command": "node",
      "args": ["/Users/DEINNAME/sermon-prepair/packages/mcp-sermon-prep/dist/index.js"]
    }
  }
}
```

> Ersetze `/Users/DEINNAME/sermon-prepair` durch den absoluten Pfad, unter dem du das Repository abgelegt hast (`pwd` im Repo-Root zeigt ihn dir).

### 3. Skill global installieren

Kopiere die Skill-Datei und das HTML-Template in dein globales Claude-Benutzerverzeichnis, damit der Slash-Command in jedem Projekt verfügbar ist:

```bash
mkdir -p ~/.claude/commands
cp .claude/commands/gottesdienst.md ~/.claude/commands/gottesdienst.md
cp .claude/commands/gottesdienst-template.html ~/.claude/commands/gottesdienst-template.html
```

Starte Claude Code danach neu (oder führe `/reload` aus), damit der neue Slash-Command und der MCP-Server erkannt werden.

## Verwendung

```
/gottesdienst <datum> [--at <stelle>] [--nt <stelle>] [--predigttext <stelle>]
```

Die drei optionalen Flags entsprechen den Gottesdienst-Rollen:

| Flag | Rolle | Beispiel |
|---|---|---|
| `--at` | Lesung Altes Testament | `--at "Jeremia 26, 1-15"` |
| `--nt` | Lesung Neues Testament | `--nt "Römer 6, 12-14"` |
| `--predigttext` | Predigttext | `--predigttext "Matthäus 10, 24-33"` |

### Beispiele

| Aufruf | Verhalten |
|---|---|
| `/gottesdienst 2026-06-28` | Sonntag, keine eigenen Stellen → alles aus Perikopen |
| `/gottesdienst 28.06.2026` | Gleiches Ergebnis (DD.MM.YYYY wird automatisch umgewandelt) |
| `/gottesdienst 2026-06-28 --predigttext "Lukas 6, 36-42"` | Sonntag: AT + NT aus Perikopen, eigener Predigttext |
| `/gottesdienst 2026-06-28 --at "Amos 5, 21-24" --nt "Römer 6, 12-14" --predigttext "Matthäus 10, 24-33"` | Sonntag: alle drei eigene Stellen |
| `/gottesdienst 2026-06-25` | Kein Sonntag, keine Stellen → fragt nach Vorgehen |
| `/gottesdienst 2026-06-25 --predigttext "Johannes 3, 16"` | Kein Sonntag, eine Stelle → fragt optional nach AT und NT |

### Interaktives Nachfragen

Wenn nicht alle drei Slots gefüllt sind und das Datum ein Sonntag ist, schlägt der Skill für leere Slots die Perikopen-Stelle vor und fragt, ob eine eigene Stelle verwendet werden soll (Enter = Vorschlag übernehmen).

Wenn das Datum kein Sonntag ist und keine Stellen angegeben wurden, fragt der Skill:

- **A** – Perikopen des vorherigen Sonntags verwenden
- **B** – Perikopen des nächsten Sonntags verwenden
- **C** – Bibelstellen manuell eingeben

## Quellen

- **Kirchenjahr**: [kirchenjahr-evangelisch.de](https://kirchenjahr-evangelisch.de/) – Sonntagsname und liturgische Farbe
- **Perikopen**: [pfarrverein.ch/perikopen](https://www.pfarrverein.ch/perikopen/) – Reformierte Perikopenordnung
- **Bibel**: [bibleserver.com/ZB](https://www.bibleserver.com/ZB) – Zürcherbibel

## Projektstruktur

```
sermon-prepair/
├── .claude/
│   └── commands/
│       └── gottesdienst.md       # Skill-Definition (Slash-Command)
├── packages/
│   └── mcp-sermon-prep/          # MCP-Server (TypeScript)
│       └── src/
│           ├── index.ts           # MCP-Einstiegspunkt
│           ├── kirchenjahr.ts     # Scraper kirchenjahr-evangelisch.de
│           ├── perikopen.ts       # Scraper pfarrverein.ch
│           └── bibleserver.ts     # Scraper bibleserver.com/ZB
└── package.json                   # Monorepo-Root (npm workspaces)
```
