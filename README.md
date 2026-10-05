# sermon-prepair

Claude-Skill zur Vorbereitung reformierter Gottesdienste. Holt automatisch den Sonntagsnamen, die liturgische Farbe sowie die Perikopenordnung und zeigt die Bibeltexte aus der Zürcherbibel an.

## Voraussetzungen

| Voraussetzung | Mindestversion | Prüfen |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 (built-in `fetch`) | `node --version` |
| npm | 7 (Workspaces) | `npm --version` |
| [Claude Code](https://claude.ai/code) | aktuell | `claude --version` |

## Installation

### macOS / Linux

```bash
git clone <repo-url> ~/sermon-prepair
cd ~/sermon-prepair
./install.sh
```

### Windows (PowerShell)

```powershell
git clone <repo-url> $HOME\sermon-prepair
cd $HOME\sermon-prepair
.\install.ps1
```

> Falls PowerShell die Ausführung blockiert, einmalig ausführen:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### Was das Installationsskript tut

1. **Voraussetzungen prüfen** – Node.js ≥ 18, npm ≥ 7 und Claude Code werden geprüft; fehlt etwas, wird der Vorgang mit einem Hinweis abgebrochen.
2. **Abhängigkeiten installieren / aktualisieren** – `npm install` im Repo-Root.
3. **MCP-Server bauen** – `npm run build` kompiliert TypeScript nach `dist/`.
4. **Claude-Integration einrichten** – kopiert Skill und Template nach `~/.claude/commands/` und trägt den MCP-Server in `~/.claude/settings.json` ein. Ist ein Eintrag bereits vorhanden, wird er aktualisiert.

Starte Claude Code nach der Installation neu (oder führe `/reload` aus).

## Verwendung

```
/gottesdienst <datum> [--at <stelle>] [--nt <stelle>] [--predigttext <stelle>] [--bild] [--varianten <n>]
```

Die drei optionalen Flags entsprechen den Gottesdienst-Rollen:

| Flag | Rolle | Beispiel |
|---|---|---|
| `--at` | Lesung Altes Testament | `--at "Jeremia 26, 1-15"` |
| `--nt` | Lesung Neues Testament | `--nt "Römer 6, 12-14"` |
| `--predigttext` | Predigttext | `--predigttext "Matthäus 10, 24-33"` |

Zusätzlich erzeugt `--bild` (nur deutsche Ordnung) ein passendes Bild zum Wochenspruch, lokal mit FLUX.2 Klein 9B. Das Bild hat das Format 16:9 (Beamer) und wird zweimal gespeichert und im HTML eingebunden: `bild-text.png` mit eingebranntem Wochenspruch (Pillow, Position automatisch oben oder unten) und `bild.png` ohne Text. Mit `--varianten <n>` (2 bis 4) entstehen mehrere Bilder zur Auswahl. Die Bilder zeigen bewusst Landschaft und Symbole statt Hände oder Gesichter, die das Modell fehlerhaft zeichnet. Voraussetzungen siehe **Bildgenerierung**.

### Beispiele

| Aufruf | Verhalten |
|---|---|
| `/gottesdienst 2026-06-28` | Sonntag, keine eigenen Stellen → alles aus Perikopen (Frage nach Ordnung, Standard deutsch) |
| `/gottesdienst 2026-06-28 --ordnung ch` | Schweizerische Perikopenordnung statt deutscher |
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

## Bildgenerierung (optional)

Nur macOS mit Apple Silicon, empfohlen ab 32 GB RAM. Unter Windows und Linux ist `--bild` nicht verfügbar. `install.sh` prüft auf macOS, ob mflux und ein Hugging Face-Login vorhanden sind, und weist sonst darauf hin.

```bash
brew install uv
uv tool install --upgrade mflux
uv tool update-shell
```

FLUX.2 Klein 9B ist bei Hugging Face lizenzpflichtig: Lizenz auf [huggingface.co/black-forest-labs/FLUX.2-klein-9B](https://huggingface.co/black-forest-labs/FLUX.2-klein-9B) akzeptieren, Read-Token erstellen und `uvx --from huggingface_hub hf auth login` ausführen. Der erste Lauf lädt mehrere GB Gewichte. Eine Generierung dauert danach ca. 2 Minuten (Peak-RAM ca. 20 GB). Eigenes Binary: Umgebungsvariable `MFLUX_BIN`.

## Quellen

- **Kirchenjahr**: [kirchenjahr-evangelisch.de](https://kirchenjahr-evangelisch.de/) – Sonntagsname und liturgische Farbe
- **Perikopen (deutsch, Standard)**: [kirchenjahr-evangelisch.de](https://kirchenjahr-evangelisch.de/) – Detailseite des Sonntags
- **Perikopen (schweizerisch)**: [pfarrverein.ch/perikopen](https://www.pfarrverein.ch/perikopen/) – Reformierte Perikopenordnung
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
│           ├── perikopen.ts       # Scraper kirchenjahr-evangelisch.de (de) + pfarrverein.ch (ch)
│           ├── bibleserver.ts     # Scraper bibleserver.com/ZB
│           └── imagegen.ts        # Bildgenerierung (mflux, FLUX.2 Klein 9B)
└── package.json                   # Monorepo-Root (npm workspaces)
```
