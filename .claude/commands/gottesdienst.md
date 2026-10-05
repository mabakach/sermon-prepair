# Gottesdienst Vorbereitung

Hilf beim Vorbereiten eines reformierten Gottesdienstes. Nutze die MCP-Tools `get_lectionary`, `get_church_calendar` und `get_bible_text`.

## Aufruf

```
/gottesdienst <datum> [--ordnung de|ch] [--at <stelle>] [--nt <stelle>] [--predigttext <stelle>]
```

- **datum**: Pflichtfeld. Format `YYYY-MM-DD` oder `DD.MM.YYYY`.
- **--ordnung**: Optional. `de` = deutsche Perikopenordnung (kirchenjahr-evangelisch.de, **Standard**), `ch` = schweizerische Perikopenordnung (pfarrverein.ch). Fehlt das Flag, frage vor der Perikopen-Abfrage nach (siehe **Perikopenordnung wählen**).
- **--at**: Optional. Eigene Bibelstelle für die Lesung Altes Testament.
- **--nt**: Optional. Eigene Bibelstelle für die Lesung Neues Testament.
- **--predigttext**: Optional. Eigene Bibelstelle für den Predigttext.

Wenn das Datum im Format `DD.MM.YYYY` angegeben wurde, wandle es zunächst in `YYYY-MM-DD` um.

---

## Perikopenordnung wählen

Vor jedem `get_lectionary`-Aufruf (Fall A, und A/B in Fall C) muss die Ordnung feststehen. Wurde `--ordnung` nicht übergeben und sind nicht alle drei Bibelstellen als Flags angegeben, frage:

> Welche Perikopenordnung soll verwendet werden?
> **A)** Deutsche Perikopenordnung *(Standard, Enter)*
> **B)** Schweizerische Perikopenordnung

- A oder leeres Enter → `ordnung: "de"`
- B → `ordnung: "ch"`

Übergib den Wert immer als Parameter `ordnung` an `get_lectionary`. Die Ordnung ist nur für diesen Aufruf relevant; frage pro Aufruf von `/gottesdienst` nur einmal.

Die deutsche Ordnung liefert zusätzlich zu AT, NT (Epistel) und Predigttext das **Evangelium**, den **Wochenspruch** (`wochenspruch.reference`, `wochenspruch.text`) und den **Wochenpsalm** (`wochenpsalm`). Zeige Evangelium, Wochenspruch und Wochenpsalm in der Bestätigungsfrage informativ an. Sie sind nicht austauschbar (keine eigenen Stellen) und werden bei Antwort B ebenfalls übernommen. Alle drei erscheinen **nur im HTML bei deutscher Ordnung**; bei schweizerischer Ordnung, Fall B und manueller Eingabe entfallen sie komplett.

---

## Quellenmarkierung (wichtig für HTML-Ausgabe)

Jede der drei Bibelstellen hat eine **Quelle**:
- **Perikopenordnung**: Stelle stammt aus `get_lectionary` → Badge `{{XX_BADGE}}` = `<span class="perikope-tag">nach Perikopenordnung</span>`
- **Eigene Wahl**: Stelle wurde vom Benutzer angegeben → Badge `{{XX_BADGE}}` = (leer)

Diese Unterscheidung muss für AT, NT und Predigttext separat getrackt und in die Platzhalter `{{AT_BADGE}}`, `{{NT_BADGE}}`, `{{PREDIGTTEXT_BADGE}}` geschrieben werden.

---

## Steuerlogik

### Schritt 1: Ist das Datum ein Sonntag?

Berechne den Wochentag (`new Date('YYYY-MM-DD').getDay()`, Sonntag = 0).

---

### Fall A: Datum ist ein Sonntag

1. Ruf `get_lectionary(date, ordnung)` auf → liefert `sunday_name` und die Perikopen-Stellen.
2. Ruf `get_church_calendar(date, sunday_name)` auf → liefert `liturgical_color` und `liturgical_season`.
3. **Wurden KEINE eigenen Bibelstellen als Parameter übergeben?**

   Zeige dem Benutzer die Perikopen und frage nach:

   > Die [deutsche|schweizerische] Perikopenordnung für **[Sonntagsname]** ([DD.MM.YYYY]):
   >
   > - **Lesung AT**: [AT-Stelle]
   > - **Lesung NT**: [NT-Stelle]
   > - **Predigttext**: [Predigttext-Stelle]
   >
   > Möchtest du diese Bibelstellen übernehmen, oder eigene angeben?
   > **A)** Perikopenordnung übernehmen
   > **B)** Eigene Bibelstellen angeben

   - **Antwort A**: Alle drei aus Perikopen → alle drei Badges gesetzt.
   - **Antwort B**: Für jeden Slot nachfragen (optional):
     > Lesung Altes Testament (Enter = Perikopen-Stelle *[Stelle]* übernehmen):
     - Eingabe vorhanden → eigene Stelle, kein Badge.
     - Leeres Enter → Perikopen-Stelle, Badge gesetzt.

4. **Wurden EINZELNE eigene Bibelstellen übergeben (aber nicht alle drei)?**

   Für vorhandene Flags: eigene Stelle verwenden, kein Badge.
   Für fehlende Slots: Perikopen-Vorschlag anzeigen und fragen (optional):
   > Möchtest du für **[Slot]** eine eigene Bibelstelle verwenden?
   > Perikopen-Vorschlag: *[Stelle]* (Enter = übernehmen)
   - Eingabe vorhanden → eigene Stelle, kein Badge.
   - Leeres Enter → Perikopen-Stelle, Badge gesetzt.

5. **Wurden ALLE DREI eigenen Bibelstellen übergeben?**

   Perikopen-Stellen ignorieren. Kein Badge für irgendeine Stelle.

6. Ruf für alle drei Stellen `get_bible_text(reference)` auf. Bei deutscher Ordnung zusätzlich für Evangelium, Wochenpsalm und Wochenspruch (Fallback Wochenspruch: `wochenspruch.text` aus `get_lectionary`, falls Abruf scheitert).
7. Erstelle Ordner und HTML-Datei (siehe **Datei-Ausgabe**).
8. Gib das Ergebnis im Chat aus (siehe **Chat-Ausgabeformat**).

---

### Fall B: Datum ist KEIN Sonntag – mindestens eine Bibelstelle übergeben

Überspringe Kirchenjahr- und Perikopen-Abfrage. Kein Badge für irgendeine Stelle.

1. **Wurden nicht alle drei Flags übergeben?**
   Frage für jeden fehlenden Slot interaktiv nach (optional):
   > Möchtest du für **[Slot]** eine Bibelstelle angeben? (optional, Enter zum Überspringen)
   Überspringe den Slot bei leerem Enter.
2. Ruf für alle ausgefüllten Stellen `get_bible_text(reference)` auf.
3. Erstelle Ordner und HTML-Datei (siehe **Datei-Ausgabe**).
4. Gib das Ergebnis im Chat aus (ohne Sonntagsname/Farbe, mit Hinweis dass das Datum kein Sonntag ist).

---

### Fall C: Datum ist KEIN Sonntag – keine Bibelstellen übergeben

Berechne den vorherigen Sonntag (`prev`) und den nächsten Sonntag (`next`).

Frage den Benutzer:

> Das Datum **DD.MM.YYYY** fällt auf einen [Wochentag]. Wie soll ich vorgehen?
>
> A) Perikopen des **vorherigen Sonntags** (DD.MM.YYYY) verwenden
> B) Perikopen des **nächsten Sonntags** (DD.MM.YYYY) verwenden
> C) Bibelstellen manuell eingeben

- **A/B**: Führe Fall A mit dem gewählten Sonntag aus (inkl. Wahl der Perikopenordnung) (keine eigenen Flags → Perikopen-Abfrage mit Bestätigung).
- **C**: Frage der Reihe nach nach AT, NT und Predigttext (jeweils optional), dann Fall B.

---

## Datei-Ausgabe

Sobald alle Daten gesammelt sind, erstelle im **aktuellen Arbeitsverzeichnis** einen Ordner und darin eine HTML-Datei.

### Ordnername

```
YYYY-MM-DD_<Sonntagsname-als-slug>
```

Slug-Regeln: Leerzeichen → `-`, Punkte entfernen, Umlaute beibehalten, keine Kleinschreibung.
Beispiel: `2026-06-28_4-Sonntag-nach-Trinitatis`

Ohne Sonntagsname (Fall B): `2026-06-25_Gottesdienst`

### HTML-Datei befüllen

1. Lese das Template aus `~/.claude/commands/gottesdienst-template.html`.
2. Ersetze alle Platzhalter (siehe Tabelle unten).
3. Schreibe das Ergebnis als `index.html` in den neu erstellten Ordner.

### Nur-Deutsch-Blöcke

Das Template enthält Blöcke zwischen `<!-- DE_ONLY_START -->` und `<!-- DE_ONLY_END -->` (Wochenspruch, Wochenpsalm, Evangelium).
- **Deutsche Ordnung verwendet** (get_lectionary mit `ordnung: "de"`): nur die Kommentarzeilen entfernen, Inhalt behalten, Platzhalter befüllen.
- **Sonst** (schweizerisch, Fall B, keine Perikopen-Abfrage): Block samt Inhalt komplett entfernen. Abschnitt darf nicht sichtbar sein.

### Platzhalter

| Platzhalter | Inhalt |
|---|---|
| `{{DATE}}` | Datum als `DD.MM.YYYY` |
| `{{SUNDAY_NAME}}` | Sonntagsname oder `Gottesdienst` |
| `{{LITURGICAL_COLOR}}` | Farbenname auf Deutsch oder leer |
| `{{LITURGICAL_COLOR_HEX}}` | CSS-Hexwert aus Farbtabelle oder `#888888` |
| `{{LITURGICAL_SEASON}}` | Festzeit oder leer |
| `{{AT_REFERENCE}}` | Bibelstelle Lesung AT oder `–` |
| `{{AT_TEXT}}` | Bibeltext Lesung AT oder `(keine Angabe)` |
| `{{AT_BADGE}}` | `<span class="perikope-tag">nach Perikopenordnung</span>` oder leer |
| `{{NT_REFERENCE}}` | Bibelstelle Lesung NT oder `–` |
| `{{NT_TEXT}}` | Bibeltext Lesung NT oder `(keine Angabe)` |
| `{{NT_BADGE}}` | Badge oder leer |
| `{{PREDIGTTEXT_REFERENCE}}` | Bibelstelle Predigttext oder `–` |
| `{{PREDIGTTEXT_TEXT}}` | Bibeltext Predigttext oder `(keine Angabe)` |
| `{{PREDIGTTEXT_BADGE}}` | Badge oder leer |
| `{{WOCHENSPRUCH_REFERENCE}}` / `{{WOCHENSPRUCH_TEXT}}` | Nur DE: Stelle und Text des Wochenspruchs |
| `{{WOCHENPSALM_REFERENCE}}` / `{{WOCHENPSALM_TEXT}}` | Nur DE: Stelle und Bibeltext des Wochenpsalms |
| `{{EVANGELIUM_REFERENCE}}` / `{{EVANGELIUM_TEXT}}` | Nur DE: Stelle und Bibeltext des Evangeliums |
| `{{EVANGELIUM_BADGE}}` | Nur DE: Badge `nach Perikopenordnung` (immer gesetzt) |
| `{{PERIKOPEN_SOURCE}}` | `kirchenjahr-evangelisch.de` (de) oder `pfarrverein.ch` (ch/keine) |

### Farbtabelle (liturgische Farbe → CSS-Hex)

| Farbe | Hex |
|---|---|
| Weiß / Weiss | `#F5F0E8` |
| Grün / Gruen | `#4A7C59` |
| Violett / Lila | `#6B3FA0` |
| Rot | `#B91C1C` |
| Schwarz | `#1A1A1A` |
| Gold | `#B8860B` |

Unbekannte Farbe → `#888888`.

### Fehlende Slots im HTML

Leere Slots: `{{XX_REFERENCE}}` = `–`, `{{XX_TEXT}}` = `(keine Angabe)`, `{{XX_BADGE}}` = leer, `<section>` erhält Klasse `passage--empty`.

---

## Chat-Ausgabeformat

### Sonntag (Fall A)

Bei deutscher Ordnung zusätzlich nach der Kopfzeile `### Wochenspruch – [Stelle]` und `### Wochenpsalm – [Stelle]` sowie `### Evangelium – [Stelle] *(nach Perikopenordnung)*` zwischen NT und Predigttext ausgeben (jeweils mit Text). Bei schweizerischer Ordnung entfallen diese.

```
## Gottesdienst [DD.MM.YYYY]

**[Sonntagsname]** · [Festzeit] · Liturgische Farbe: [Farbe]

---

### Lesung Altes Testament – [Bibelstelle] *(nach Perikopenordnung)*

[Bibeltext]

---

### Lesung Neues Testament – [Bibelstelle]

[Bibeltext]

---

### Predigttext – [Bibelstelle] *(nach Perikopenordnung)*

[Bibeltext]

---

📁 Gespeichert unter: `[Ordnerpfad]/index.html`
```

*(nach Perikopenordnung)* nur anzeigen wenn die Stelle aus der Perikopenordnung stammt. Fehlende/übersprungene Slots weglassen.

### Kein Sonntag (Fall B)

```
## Bibeltexte für [DD.MM.YYYY]

> Hinweis: Das eingegebene Datum ist kein Sonntag.

[… Stellen und Texte …]

📁 Gespeichert unter: `[Ordnerpfad]/index.html`
```
