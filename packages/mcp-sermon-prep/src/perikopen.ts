import { parse } from 'node-html-parser';

export interface Passage {
  type: string;
  reference: string;
}

export interface LectionaryResult {
  sunday_name: string;
  date: string;
  passages: Passage[];
}

// The page uses a <table> where each Sunday spans multiple <tr> rows:
//   Row 1 (class "ordnungViewLine"): date | Sunday name | 1st passage (AT)
//   Row 2: &nbsp; | &nbsp;           | 2nd passage (NT/Epistel)
//   Row 3: &nbsp; | &nbsp;           | 3rd passage (Evangelium/Predigttext)
// All passage cells have class " vers".

export type Ordnung = 'de' | 'ch';

export async function getLectionary(date: string, ordnung: Ordnung = 'de'): Promise<LectionaryResult> {
  return ordnung === 'ch' ? getLectionaryCh(date) : getLectionaryDe(date);
}

// Deutsche Perikopenordnung: kirchenjahr-evangelisch.de
// The start page lists every upcoming holiday as <a class="day-circle" data-holiday-slug data-holiday-date>.
// The detail page "<slug>/" has a "Liturgische Texte" block with label/value pairs.
async function getLectionaryDe(date: string): Promise<LectionaryResult> {
  const [year, month, day] = date.split('-');
  const targetDate = `${day}.${month}.${year}`;

  const homeRes = await fetch('https://kirchenjahr-evangelisch.de/');
  if (!homeRes.ok) throw new Error(`kirchenjahr-evangelisch.de returned ${homeRes.status}`);
  const home = parse(await homeRes.text());

  const entries = home
    .querySelectorAll('a.day-circle')
    .filter(a => a.getAttribute('data-holiday-date') === targetDate);
  if (entries.length === 0) {
    throw new Error(`Kein Eintrag für ${targetDate} auf kirchenjahr-evangelisch.de gefunden.`);
  }
  const entry = entries.find(a => /sonntag|advent|ostern|pfingst|trinitatis|epiphanias|invokavit|reminiszere|okuli|laetare|judika|quasimodogeniti|miserikordias|jubilate|kantate|rogate|exaudi|estomihi|sexagesimae|septuagesimae/i.test(
    a.getAttribute('data-holiday-title') ?? '')) ?? entries[0];
  const sunday_name = (entry.getAttribute('data-holiday-title') ?? '').trim();
  const slug = entry.getAttribute('data-holiday-slug');
  if (!slug) throw new Error(`Kein Slug für ${targetDate} gefunden.`);

  const res = await fetch(`https://kirchenjahr-evangelisch.de/${slug}/`);
  if (!res.ok) throw new Error(`kirchenjahr-evangelisch.de returned ${res.status} for "${slug}"`);
  const page = parse(await res.text());

  const extract = (label: string): string => {
    for (const el of page.querySelectorAll('.texts-liturgical-link-element')) {
      if (el.querySelector('h4')?.text.trim() !== `${label}:`) continue;
      const span = el.querySelector('a span') ?? el.querySelector('span:not(.with-tooltip)');
      // First text node only: the span also holds <img alt="Zum Impuls ..."> markup.
      const raw = span?.childNodes[0]?.text ?? '';
      return raw.replace(/\s+/g, ' ').trim().replace(/[\u2013\u2014]/g, '-');
    }
    return '';
  };

  const wanted: [string, string][] = [
    ['AT-Lesung', 'Lesung Altes Testament'],
    ['Epistel', 'Lesung Neues Testament'],
    ['Evangelium', 'Evangelium'],
    ['Predigttext', 'Predigttext'],
  ];
  const passages: Passage[] = [];
  for (const [label, type] of wanted) {
    const reference = extract(label);
    if (reference) passages.push({ type, reference });
  }
  if (passages.length === 0) {
    throw new Error(`Keine liturgischen Texte auf kirchenjahr-evangelisch.de/${slug}/ gefunden.`);
  }

  return { sunday_name, date: targetDate, passages };
}

// Schweizer Perikopenordnung: pfarrverein.ch
async function getLectionaryCh(date: string): Promise<LectionaryResult> {
  const url = `https://www.pfarrverein.ch/perikopen/?page=perikopen&sucheZeitpunkt=${date}&sucheZeitfenster=7&ordnung=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pfarrverein.ch returned ${res.status}`);
  const html = await res.text();
  const root = parse(html);

  const [year, month, day] = date.split('-');
  const targetDate = `${day}.${month}.${year}`;

  const rows = root.querySelectorAll('tr');

  // Find the anchor row: ordnungViewLine whose first <td> matches our date
  let anchorIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const firstTd = rows[i].querySelector('td');
    if (firstTd && firstTd.text.trim() === targetDate) {
      anchorIdx = i;
      break;
    }
  }
  if (anchorIdx === -1) {
    throw new Error(`Kein Eintrag für ${targetDate} auf pfarrverein.ch gefunden.`);
  }

  const anchorRow = rows[anchorIdx];
  const tds = anchorRow.querySelectorAll('td');
  const sunday_name = tds[1]?.text.trim() ?? '';

  // Collect verse cells: anchor row + following rows until next ordnungViewLine
  const verseCells: string[] = [];

  const verseText = (tr: ReturnType<typeof root.querySelector>) => {
    const cell = tr!.querySelector('td.vers, td[class*=" vers"]');
    // fallback: last td
    const all = tr!.querySelectorAll('td');
    const last = all[all.length - 1];
    const raw = (cell ?? last)?.text.trim() ?? '';
    return raw.replace(/\s+/g, ' ').trim();
  };

  verseCells.push(verseText(anchorRow));

  for (let i = anchorIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // A new Sunday starts when the first td has a date-like text (not &nbsp;)
    const firstCell = row.querySelector('td')?.text.trim() ?? '';
    if (firstCell && firstCell !== ' ' && /^\d{2}\.\d{2}\.\d{4}$/.test(firstCell)) break;
    const v = verseText(row);
    if (v && v !== ' ') verseCells.push(v);
  }

  const typeLabels = ['Lesung Altes Testament', 'Lesung Neues Testament', 'Predigttext'];
  const passages: Passage[] = [];

  verseCells.forEach((raw, i) => {
    const label = typeLabels[i] ?? `Lesung ${i + 1}`;
    if (raw.includes(' oder ')) {
      const parts = raw.split(' oder ');
      const bookMatch = parts[0].match(/^((?:[1-9]\.\s*)?[A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)?)\s+/);
      const book = bookMatch ? bookMatch[1] : '';
      parts.forEach((part, j) => {
        const ref = (j > 0 && !part.match(/^[1-9]?\s*[A-ZÄÖÜ]/)) ? `${book} ${part}` : part;
        passages.push({ type: `${label} (Option ${String.fromCharCode(65 + j)})`, reference: ref.trim() });
      });
    } else {
      passages.push({ type: label, reference: raw });
    }
  });

  return { sunday_name, date: targetDate, passages };
}
