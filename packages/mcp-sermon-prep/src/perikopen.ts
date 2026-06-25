export interface Passage {
  type: string;
  reference: string;
}

export interface LectionaryResult {
  sunday_name: string;
  date: string;
  passages: Passage[];
}

export async function getLectionary(date: string): Promise<LectionaryResult> {
  const url = `https://www.pfarrverein.ch/perikopen/?page=perikopen&sucheZeitpunkt=${date}&sucheZeitfenster=7&ordnung=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pfarrverein.ch returned ${res.status}`);
  const html = await res.text();

  // The page returns plain text entries separated by line breaks.
  // Structure per Sunday:
  //   DD.MM.YYYY
  //   <Sonntagsname>
  //   <AT-Stelle>
  //   <Epistel-Stelle>
  //   <Evangelium-Stelle>

  const lines = html
    .replace(/<[^>]+>/g, '\n')   // strip all HTML tags
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Find the block matching our date (DD.MM.YYYY)
  const [year, month, day] = date.split('-');
  const targetDate = `${day}.${month}.${year}`;

  const startIdx = lines.findIndex(l => l === targetDate);
  if (startIdx === -1) {
    throw new Error(`Kein Eintrag für ${targetDate} auf pfarrverein.ch gefunden.`);
  }

  const block = lines.slice(startIdx, startIdx + 5);
  const sunday_name = block[1] ?? '';

  // Remaining lines are passages; handle "oder" alternatives
  const rawPassages = block.slice(2).filter(Boolean);
  const typeLabels = ['Lesung Altes Testament', 'Lesung Neues Testament', 'Predigttext'];
  const passages: Passage[] = [];

  rawPassages.forEach((raw, i) => {
    const label = typeLabels[i] ?? `Lesung ${i + 1}`;
    if (raw.includes(' oder ')) {
      const parts = raw.split(' oder ');
      // Second part may be a relative reference like "10, 34 - 42" (same book)
      const bookMatch = parts[0].match(/^([1-9]?\s*[A-ZÄÖÜ][a-zäöüß]+)\s+/);
      const book = bookMatch ? bookMatch[1] : '';
      parts.forEach((part, j) => {
        const ref = (j > 0 && !part.match(/^[1-9]?\s*[A-ZÄÖÜ]/)) ? `${book} ${part}` : part;
        passages.push({ type: `${label} (Option ${String.fromCharCode(65 + j)})`, reference: ref.trim() });
      });
    } else {
      passages.push({ type: label, reference: raw.trim() });
    }
  });

  return { sunday_name, date: targetDate, passages };
}
