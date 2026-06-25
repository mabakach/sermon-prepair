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

export async function getLectionary(date: string): Promise<LectionaryResult> {
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
