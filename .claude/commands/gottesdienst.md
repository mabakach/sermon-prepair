# Gottesdienst Vorbereitung

Hilf beim Vorbereiten eines reformierten Gottesdienstes. Nutze die MCP-Tools `get_lectionary`, `get_church_calendar` und `get_bible_text`.

## Aufruf

```
/gottesdienst <datum> [--ordnung de|ch] [--at <stelle>] [--nt <stelle>] [--predigttext <stelle>] [--bild] [--varianten <n>]
```

- **datum**: Pflichtfeld. Format `YYYY-MM-DD` oder `DD.MM.YYYY`.
- **--ordnung**: Optional. `de` = deutsche Perikopenordnung (kirchenjahr-evangelisch.de, **Standard**), `ch` = schweizerische Perikopenordnung (pfarrverein.ch). Fehlt das Flag, frage vor der Perikopen-Abfrage nach (siehe **Perikopenordnung wählen**).
- **--at**: Optional. Eigene Bibelstelle für die Lesung Altes Testament.
- **--nt**: Optional. Eigene Bibelstelle für die Lesung Neues Testament.
- **--predigttext**: Optional. Eigene Bibelstelle für den Predigttext.
- **--bild**: Optional. Erzeugt lokal ein Bild zum Wochenspruch (siehe **Bild zum Wochenspruch**). Nur mit deutscher Ordnung.
- **--varianten**: Optional, nur mit `--bild`. Anzahl Bildvarianten (2 bis 4, Standard 1); du wählst danach eine aus.

Wenn das Datum im Format `DD.MM.YYYY` angegeben wurde, wandle es zunächst in `YYYY-MM-DD` um.

---

## Perikopenordnung wählen

Vor jedem `get_lectionary`-Aufruf (Schritt 1, und A/B in Fall C) muss die Ordnung feststehen. Wurde `--ordnung` nicht übergeben und sind nicht alle drei Bibelstellen als Flags angegeben, frage:

> Welche Perikopenordnung soll verwendet werden?
> **A)** Deutsche Perikopenordnung *(Standard, Enter)*
> **B)** Schweizerische Perikopenordnung

- A oder leeres Enter → `ordnung: "de"`
- B → `ordnung: "ch"`

Übergib den Wert immer als Parameter `ordnung` an `get_lectionary`. Die Ordnung ist nur für diesen Aufruf relevant; frage pro Aufruf von `/gottesdienst` nur einmal.

Die deutsche Ordnung liefert zusätzlich zu AT, NT (Epistel) und Predigttext das **Evangelium**, den **Wochenspruch** (`wochenspruch.reference`, `wochenspruch.text`) und den **Wochenpsalm** (`wochenpsalm`). Zeige Evangelium, Wochenspruch und Wochenpsalm in der Bestätigungsfrage informativ an. Sie sind nicht austauschbar (keine eigenen Stellen) und werden bei Antwort B ebenfalls übernommen. Alle drei erscheinen **nur im HTML bei deutscher Ordnung**; bei schweizerischer Ordnung, Fall B und manueller Eingabe entfallen sie komplett.

---

## Bild zum Wochenspruch

Nur bei `--bild` **und** deutscher Ordnung (Wochenspruch vorhanden). Sonst Hinweis im Chat (`--bild` braucht den Wochenspruch der deutschen Ordnung), kein Bild, Block entfernen.

1. Nach dem Abruf der Bibeltexte und vor dem Schreiben der HTML-Datei.
2. Formuliere einen **englischen** Bild-Prompt (1 bis 3 Sätze). Das **Motiv muss sich deutlich aus dem Wochenspruch ergeben**: Bestimme zuerst die zentrale Aussage und ihr wörtliches Bild (z.B. Weg, Licht, Wasser, Brot, Tür, Saat, Fels, Lampe, Brücke, Berg, Meer, Nacht und Sterne, Sturm und Ruhe, Weinstock) und mache genau dieses Bild zum Hauptmotiv im Vordergrund. Verwende **nicht** standardmässig Hügel, Wiese, Sonnenaufgang und einzelnen Baum; wähle Landschaft, Tageszeit, Licht und Farbstimmung passend zur Aussage (z.B. Trost: Lampe im Dunkeln; Ruf zur Nachfolge: Weg und Wegweiser; Gericht/Ernst: Sturmhimmel; Freude: helle Blüten). Stil: Aquarell-Illustration, kontemplativ, für Gottesdienst-Blatt.
   - **Keine Hände, Finger, Arme oder Gesichter** als Motiv (das Modell zeichnet sie fehlerhaft, z.B. sechs Finger). Übersetze den Spruch stattdessen in Landschaft, Gegenstände und Symbole. Falls Menschen unvermeidlich sind: kleine Silhouetten von hinten in der Ferne.
   - Ergänze im Prompt "wide 16:9 composition, calm uncluttered area at the top for text" (ruhige Fläche für den Text, Motiv nicht dadurch ersetzen).
   - Kein Text, keine Schrift, keine Jesus-Darstellung, keine Kreuz-Kitsch-Motive.
   - Beispiel (Jeremia 17,14, Heilung): "Watercolor illustration of a small oil lamp glowing on a stone windowsill at dawn, warm light spilling over healing herbs in a clay pot, soft golden and blue tones, contemplative, church bulletin art, no text, no people".
3. **Prompt und Seed bestätigen:** Berechne den Seed-Vorschlag `basis` (siehe Schritt 4) und zeige dem Benutzer vor jeder Generierung beides im Chat:
   > Bild-Prompt: *[englischer Prompt]*
   > Seed: *[basis]*
   > Enter = übernehmen, oder neuen Prompt und/oder Seed eingeben (z.B. `Seed 42` oder ein neuer Prompt).
   Stelle diese Frage **genau einmal** und beende deine Nachricht danach. Sobald die Antwort kommt, **fahre sofort fort** (keine Rückfrage, keine Zusammenfassung, kein Anhalten): Leere Antwort/Enter/"ok"/"ja" = Vorschlag übernehmen. Enthält die Antwort eine Zahl nach "Seed" (oder nur eine Zahl), ist das der neue Seed (`basis`). Jeder andere Text ist der neue Prompt und wird unverändert verwendet (auch deutsch oder ohne 16:9-Zusatz; ggf. Seed und Prompt gemeinsam). Rufe danach direkt `generate_image` mit dem endgültigen Prompt und Seed auf und setze mit Schritt 5 und dem Schreiben der HTML-Datei fort.
4. Format **16:9** (Beamer): immer `width: 1920, height: 1080`.
   **Seed-Vorschlag:** `basis` = Unix-Timestamp von Mitternacht UTC des Gottesdienst-Datums (z.B. 2026-10-11 → `date -u -j -f "%Y-%m-%d %H:%M:%S" "2026-10-11 00:00:00" +%s` = 1791676800). Variante k nutzt `basis + k - 1`.
   Anzahl Varianten `n`: Standard 1, mit `--varianten <n>` 2 bis 4.
   - `n = 1`: Ruf `generate_image(prompt, output_path, width: 1920, height: 1080, seed: basis)` auf mit `output_path` = absoluter Pfad `<Ordner>/bild.png`.
   - `n > 1`: Ruf `generate_image` n-mal mit `seed` `basis` bis `basis + n - 1` auf, `output_path` = `<Ordner>/bild-1.png` bis `bild-n.png`. Zeige alle Varianten (Read auf jede Datei) und frage, welche übernommen werden soll. Benenne die gewählte per Bash in `bild.png` um und lösche die übrigen.
   - Jeder Aufruf dauert mehrere Minuten (16:9 in voller Auflösung braucht länger als ein Quadrat); weise vorher kurz auf die Gesamtdauer hin.
5. **Text ins Bild:** Ruf `add_text_to_image(input_path: <Ordner>/bild.png, output_path: <Ordner>/bild-text.png, text: <Wochenspruch-Text aus get_bible_text>, reference: wochenspruch.reference)` auf. Verwende **exakt denselben Text** (gleiche Übersetzung, gleicher Wortlaut) wie im HTML bei `{{WOCHENSPRUCH_TEXT}}`, nicht `wochenspruch.text` aus `get_lectionary` (nur Fallback, wenn der Abruf scheiterte; dann auch im HTML dieser). Das Tool wählt oben oder unten selbst. `bild.png` bleibt ohne Text erhalten, `bild-text.png` enthält den Wochenspruch. Beide Dateien werden gespeichert und im HTML eingebunden. Zeige `bild-text.png` (Read) und biete bei Problemen (z.B. Text verdeckt Motiv) `position: "top"` oder `"bottom"` zum erneuten Aufruf an.
6. Schlägt der Aufruf fehl: Fehler im Chat nennen, ohne Bild weitermachen (Block entfernen). Meldet der Fehler Hugging Face / gated: Lizenz für `black-forest-labs/FLUX.2-klein-9B` akzeptieren und `hf auth login` ausführen.
7. Der Ordner muss vor dem Aufruf nicht existieren (das Tool legt ihn an).

---

## Quellenmarkierung (wichtig für HTML-Ausgabe)

Jede der drei Bibelstellen hat eine **Quelle**:
- **Perikopenordnung**: Stelle stammt aus `get_lectionary` → Badge `{{XX_BADGE}}` = `<span class="perikope-tag">nach Perikopenordnung</span>`
- **Eigene Wahl**: Stelle wurde vom Benutzer angegeben → Badge `{{XX_BADGE}}` = (leer)

Diese Unterscheidung muss für AT, NT und Predigttext separat getrackt und in die Platzhalter `{{AT_BADGE}}`, `{{NT_BADGE}}`, `{{PREDIGTTEXT_BADGE}}` geschrieben werden.

---

## Steuerlogik

### Schritt 1: Gibt es für das Datum eine Perikopenordnung?

Ruf zuerst `get_lectionary(date, ordnung)` auf, auch wenn das Datum kein Sonntag ist (Karfreitag, Christvesper/Heiliger Abend, Weihnachten, Himmelfahrt usw.).

- **Treffer** (Sonntag oder Feiertag): weiter mit **Fall A**. `sunday_name` ist dann der Feiertagsname (z.B. „Karfreitag“, „Christfest I“).
  - Liefert die schweizerische Ordnung neutrale Labels („Lesung 1“, „Lesung 2 (Option A)“ …) statt AT/NT/Predigttext (Feiertage), zeige die Stellen so an und frage, welche Stelle in welchen Slot (AT, NT, Predigttext) kommt. Zugeordnete Stellen gelten als Perikopenordnung (Badge gesetzt).
  - Enthält das Ergebnis `alternatives` (nur deutsche Ordnung, z.B. „Christvesper“ und „Christnacht“ am 24.12.), frage den Benutzer, welcher Gottesdienst gemeint ist, und ruf `get_lectionary` bei abweichender Wahl erneut mit `holiday` auf.
- **Kein Treffer** und Datum ist ein Sonntag: Fehler melden.
- **Kein Treffer** und Datum ist kein Sonntag: weiter mit **Fall B** oder **Fall C** (Wochentag via `new Date('YYYY-MM-DD').getDay()`).

---

### Fall A: Datum ist ein Sonntag oder Feiertag mit Perikopenordnung

1. Verwende das Ergebnis von `get_lectionary` aus Schritt 1 (`sunday_name` und Perikopen-Stellen).
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

### Fall B: Datum ist KEIN Sonntag/Feiertag – mindestens eine Bibelstelle übergeben

Überspringe Kirchenjahr- und Perikopen-Abfrage. Kein Badge für irgendeine Stelle.

1. **Wurden nicht alle drei Flags übergeben?**
   Frage für jeden fehlenden Slot interaktiv nach (optional):
   > Möchtest du für **[Slot]** eine Bibelstelle angeben? (optional, Enter zum Überspringen)
   Überspringe den Slot bei leerem Enter.
2. Ruf für alle ausgefüllten Stellen `get_bible_text(reference)` auf.
3. Erstelle Ordner und HTML-Datei (siehe **Datei-Ausgabe**).
4. Gib das Ergebnis im Chat aus (ohne Sonntagsname/Farbe, mit Hinweis dass das Datum kein Sonntag ist).

---

### Fall C: Datum ist KEIN Sonntag/Feiertag – keine Bibelstellen übergeben

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

### Bild-Block

Das Template enthält zwischen `<!-- BILD_START -->` und `<!-- BILD_END -->` die Bilder (`bild-text.png` mit Wochenspruch und `bild.png` ohne Text, relativ zur `index.html`), direkt unter der Kopfzeile (Datum, Sonntagsname), vor dem Wochenspruch.
- **Bild erzeugt**: nur die Kommentarzeilen entfernen.
- **Sonst**: Block samt Inhalt komplett entfernen.

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

Wurde ein Bild erzeugt, gib nach der Kopfzeile `🖼️ Bild: [Ordnerpfad]/bild-text.png` (mit Text) und `bild.png` (ohne Text) aus. Bei deutscher Ordnung zusätzlich nach der Kopfzeile `### Wochenspruch – [Stelle]` und `### Wochenpsalm – [Stelle]` sowie `### Evangelium – [Stelle] *(nach Perikopenordnung)*` zwischen NT und Predigttext ausgeben (jeweils mit Text). Bei schweizerischer Ordnung entfallen diese.

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
