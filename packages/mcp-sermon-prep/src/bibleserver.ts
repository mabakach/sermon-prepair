import { parse } from 'node-html-parser';

export interface BibleTextResult {
  reference: string;
  text: string;
}

// Convert German passage reference to a bibleserver.com/ZB URL.
// Input examples:
//   "Jeremia 26, 1 - 15"
//   "Römer 6, 12 - 14.19b - 23"
//   "Johannes 3, 16"
function buildUrl(reference: string): string {
  // Split off book name vs. chapter/verse part
  const m = reference.match(/^((?:[1-9]\.\s*)?[A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)?)\s+(.+)$/);
  if (!m) throw new Error(`Konnte Bibelstelle nicht parsen: "${reference}"`);

  const book = m[1].trim().replace(/\s+/g, '+');
  // Normalise: "26, 1 - 15" → "26,1-15"
  const verseRef = m[2]
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, '');

  // bibleserver expects comma as %2C
  const encodedRef = verseRef.replace(/,/g, '%2C');
  return `https://www.bibleserver.com/ZB/${book}+${encodedRef}`;
}

export async function getBibleText(reference: string): Promise<BibleTextResult> {
  const url = buildUrl(reference);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sermon-prepair/1.0)' },
  });
  if (!res.ok) throw new Error(`bibleserver.com returned ${res.status} for "${reference}" (${url})`);
  const html = await res.text();
  const root = parse(html);

  // Verse text is in spans with class "verse-content--hover"
  const verseSpans = root.querySelectorAll('.verse-content--hover');
  if (verseSpans.length === 0) {
    // Fallback: try stripping all tags from the main content area
    const content = root.querySelector('main') ?? root;
    return { reference, text: content.text.trim() };
  }

  const verses = verseSpans.map(span => span.text.trim()).filter(Boolean);
  return { reference, text: verses.join(' ') };
}
