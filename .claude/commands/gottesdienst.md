# Gottesdienst Vorbereitung

Hilf beim Vorbereiten eines reformierten Gottesdienstes. Nutze die MCP-Tools `get_lectionary`, `get_church_calendar` und `get_bible_text`.

## Aufruf

```
/gottesdienst <datum> [--at <stelle>] [--nt <stelle>] [--predigttext <stelle>]
```

- **datum**: Pflichtfeld. Format `YYYY-MM-DD` oder `DD.MM.YYYY`.
- **--at**: Optional. Bibelstelle für die Lesung Altes Testament, z.B. `Jeremia 26, 1-15`.
- **--nt**: Optional. Bibelstelle für die Lesung Neues Testament, z.B. `Römer 6, 12-14`.
- **--predigttext**: Optional. Bibelstelle für den Predigttext, z.B. `Matthäus 10, 24-33`.

Wenn das Datum im Format `DD.MM.YYYY` angegeben wurde, wandle es zunächst in `YYYY-MM-DD` um.

Die drei Bibelstellen-Flags sind die kanonischen Bezeichnungen. Claude erkennt auch Kurzformen wie `--a`, `--n`, `--p` oder freie Positionsangaben, solange die Zuordnung eindeutig ist.

---

## Steuerlogik

### Schritt 1: Ist das Datum ein Sonntag?

Berechne den Wochentag (`new Date('YYYY-MM-DD').getDay()`, Sonntag = 0).

---

### Fall A: Datum ist ein Sonntag

1. Ruf `get_lectionary(date)` auf → liefert `sunday_name` und drei Perikopen-Stellen (AT, NT, Predigttext).
2. Ruf `get_church_calendar(date, sunday_name)` auf → liefert `liturgical_color` und `liturgical_season`.
3. Bestimme die drei Bibelstellen für AT, NT und Predigttext:
   - Wurde `--at` übergeben → verwende diesen Wert, sonst den Perikopen-Wert.
   - Wurde `--nt` übergeben → verwende diesen Wert, sonst den Perikopen-Wert.
   - Wurde `--predigttext` übergeben → verwende diesen Wert, sonst den Perikopen-Wert.
4. **Wurden ein oder mehrere Flags übergeben, aber nicht alle drei?**
   Frage für jeden fehlenden Slot interaktiv nach (optional, Benutzer darf überspringen):
   > Möchtest du für **[Lesung Altes Testament / Lesung Neues Testament / Predigttext]** eine eigene Bibelstelle verwenden?
   > Perikopen-Vorschlag: *[Perikopen-Stelle]*. Eingabe oder Enter zum Übernehmen.
   Übernimm die Eingabe, wenn vorhanden; behalte den Perikopen-Wert bei leerem Enter.
5. Ruf für alle drei Stellen `get_bible_text(reference)` auf (ggf. parallel).
6. Erstelle Ordner und HTML-Datei (siehe **Datei-Ausgabe**).
7. Gib das Ergebnis im Chat aus (siehe **Chat-Ausgabeformat**).

---

### Fall B: Datum ist KEIN Sonntag – mindestens eine Bibelstelle übergeben

Überspringe Kirchenjahr- und Perikopen-Abfrage.

1. **Wurden nicht alle drei Flags übergeben?**
   Frage für jeden fehlenden Slot interaktiv nach (optional):
   > Möchtest du für **[Lesung Altes Testament / Lesung Neues Testament / Predigttext]** eine Bibelstelle angeben? (optional, Enter zum Überspringen)
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

Warte auf die Antwort:
- **A**: Führe Fall A mit `prev` als Datum aus (keine eigenen Bibelstellen übergeben → alles aus Perikopen).
- **B**: Führe Fall A mit `next` als Datum aus.
- **C**: Frage der Reihe nach nach AT, NT und Predigttext (jeweils optional), dann Fall B.

---

## Datei-Ausgabe

Sobald alle Daten gesammelt sind, erstelle im **aktuellen Arbeitsverzeichnis** einen Ordner und darin eine HTML-Datei.

### Ordnername

```
YYYY-MM-DD_<Sonntagsname-als-slug>
```

Slug-Regeln für den Sonntagsnamen:
- Leerzeichen → `-`
- Punkte entfernen (aus „4." wird „4")
- Umlaute beibehalten (z.B. `Bußtag` bleibt `Bußtag`)
- Keine Kleinschreibung

Beispiel: `2026-06-28_4-Sonntag-nach-Trinitatis`

Wenn kein Sonntagsname vorhanden ist (kein Sonntag, Fall B), verwende `Gottesdienst` als Slug:
`2026-06-25_Gottesdienst`

### HTML-Datei befüllen

1. Lese das Template aus `~/.claude/commands/gottesdienst-template.html`.
2. Ersetze alle Platzhalter (siehe Tabelle unten).
3. Schreibe das Ergebnis als `index.html` in den neu erstellten Ordner.

### Platzhalter

| Platzhalter | Inhalt |
|---|---|
| `{{DATE}}` | Datum als `DD.MM.YYYY` |
| `{{SUNDAY_NAME}}` | Sonntagsname oder `Gottesdienst` |
| `{{LITURGICAL_COLOR}}` | Farbenname auf Deutsch (z.B. `Grün`) oder leer |
| `{{LITURGICAL_COLOR_HEX}}` | CSS-Hexwert aus Farbtabelle (siehe unten) oder `#888888` |
| `{{LITURGICAL_SEASON}}` | Festzeit (z.B. `Trinitatiszeit`) oder leer |
| `{{AT_REFERENCE}}` | Bibelstelle Lesung AT oder leer |
| `{{AT_TEXT}}` | Bibeltext Lesung AT oder leer |
| `{{NT_REFERENCE}}` | Bibelstelle Lesung NT oder leer |
| `{{NT_TEXT}}` | Bibeltext Lesung NT oder leer |
| `{{PREDIGTTEXT_REFERENCE}}` | Bibelstelle Predigttext oder leer |
| `{{PREDIGTTEXT_TEXT}}` | Bibeltext Predigttext oder leer |

### Farbtabelle (liturgische Farbe → CSS-Hex)

| Farbe | Hex |
|---|---|
| Weiß / Weiss | `#F5F0E8` |
| Grün / Gruen | `#4A7C59` |
| Violett / Lila | `#6B3FA0` |
| Rot | `#B91C1C` |
| Schwarz | `#1A1A1A` |
| Gold | `#B8860B` |

Ist die Farbe unbekannt oder nicht vorhanden, verwende `#888888`.

### Fehlende Slots im HTML

Wenn ein Slot (AT, NT oder Predigttext) leer ist:
- Setze `{{XX_REFERENCE}}` auf `–` und `{{XX_TEXT}}` auf `(keine Angabe)`.
- Füge der `<section class="passage">` die Klasse `passage--empty` hinzu.

---

## Chat-Ausgabeformat

### Sonntag (Fall A)

```
## Gottesdienst [DD.MM.YYYY]

**[Sonntagsname]** · [Festzeit] · Liturgische Farbe: [Farbe]

---

### Lesung Altes Testament – [Bibelstelle]

[Bibeltext aus der Zürcherbibel]

---

### Lesung Neues Testament – [Bibelstelle]

[Bibeltext aus der Zürcherbibel]

---

### Predigttext – [Bibelstelle]

[Bibeltext aus der Zürcherbibel]

---

📁 Gespeichert unter: `[Ordnerpfad]/index.html`
```

### Kein Sonntag (Fall B)

```
## Bibeltexte für [DD.MM.YYYY]

> Hinweis: Das eingegebene Datum ist kein Sonntag.

[… Stellen und Texte …]

📁 Gespeichert unter: `[Ordnerpfad]/index.html`
```

Fehlende (übersprungene) Slots werden im Chat-Ausgabeformat weggelassen.
