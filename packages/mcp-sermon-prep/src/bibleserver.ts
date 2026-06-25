import { parse } from 'node-html-parser';

export interface BibleTextResult {
  reference: string;
  /** HTML string with superscript verse numbers, e.g. <sup class="vn">16</sup>Text… */
  text: string;
}

// Convert German passage reference to a bibleserver.com/ZB URL.
// Input: "Jeremia 26, 1 - 15" | "Römer 6, 12 - 14.19b - 23" | "Johannes 3, 16"
function buildUrl(reference: string): string {
  const m = reference.match(/^((?:[1-9]\.\s*)?[A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)?)\s+(.+)$/);
  if (!m) throw new Error(`Konnte Bibelstelle nicht parsen: "${reference}"`);

  const book = m[1].trim().replace(/\s+/g, '+');
  const verseRef = m[2]
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, '');

  const encodedRef = verseRef.replace(/,/g, '%2C');
  return `https://www.bibleserver.com/ZB/${book}+${encodedRef}`;
}

// Parse the verse-range part of a reference into inclusive [start, end] pairs.
// "1 - 15"       → [[1, 15]]
// "12 - 14.19b - 23" → [[12, 14], [19, 23]]   (dot separates non-contiguous ranges)
// "16"           → [[16, 16]]
function parseVerseRanges(verseStr: string): [number, number][] {
  // After the chapter comma, e.g. "26, 1 - 15" → "1 - 15"
  const afterComma = verseStr.includes(',') ? verseStr.split(',').slice(1).join(',') : verseStr;
  const segments = afterComma.split('.');
  const ranges: [number, number][] = [];

  for (const seg of segments) {
    const nums = [...seg.matchAll(/\d+/g)].map(m => parseInt(m[0], 10));
    if (nums.length === 0) continue;
    ranges.push([nums[0], nums[nums.length - 1]]);
  }
  return ranges.length > 0 ? ranges : [[1, 999]];
}

function inRange(verseNum: number, ranges: [number, number][]): boolean {
  return ranges.some(([s, e]) => verseNum >= s && verseNum <= e);
}

// Strip Vue/Nuxt SSR comment artefacts and bibleserver footnote superscripts.
function cleanInnerHTML(node: ReturnType<typeof parse>): string {
  // Remove <sup class="footnote"> elements entirely
  node.querySelectorAll('sup.footnote').forEach(el => el.remove());
  // Strip SSR comments
  return node.innerHTML
    .replace(/<!--.*?-->/gs, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getBibleText(reference: string): Promise<BibleTextResult> {
  const url = buildUrl(reference);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sermon-prepair/1.0)' },
  });
  if (!res.ok) throw new Error(`bibleserver.com returned ${res.status} for "${reference}" (${url})`);
  const html = await res.text();
  const root = parse(html);

  const verseSpans = root.querySelectorAll('span.verse');
  if (verseSpans.length === 0) {
    const content = root.querySelector('main') ?? root;
    return { reference, text: content.text.trim() };
  }

  // Determine which verse numbers to include
  const verseRanges = parseVerseRanges(reference);

  const parts: string[] = [];

  for (const verse of verseSpans) {
    // Extract verse number from class like "v16" (single-digit or multi-digit, no leading zeros)
    const classAttr = verse.getAttribute('class') ?? '';
    const vnMatch = classAttr.match(/\bv(\d+)\b(?!.*\bv\d{6,}\b)/);
    // The verse class pattern: v43003016 (6+ digits = internal ID), v16 (actual verse num)
    // We want the short one. Easier: find all v\d+ tokens, take the shortest.
    const vnTokens = [...classAttr.matchAll(/\bv(\d+)\b/g)].map(m => parseInt(m[1], 10));
    const verseNum = vnTokens.length > 0 ? Math.min(...vnTokens.filter(n => n < 1000)) : NaN;

    if (isNaN(verseNum) || !inRange(verseNum, verseRanges)) continue;

    // Verse number label from DOM
    const numSpan = verse.querySelector('.verse-number__group span');
    const numLabel = numSpan ? numSpan.text.replace(/<!--.*?-->/gs, '').trim() : String(verseNum);

    // Verse text — clean inline HTML, keep italic/bold if any
    const contentSpan = verse.querySelector('.verse-content--hover');
    if (!contentSpan) continue;
    const text = cleanInnerHTML(contentSpan);
    if (!text) continue;

    parts.push(`<sup class="vn">${numLabel}</sup>${text}`);
  }

  if (parts.length === 0) {
    return { reference, text: '(Text nicht gefunden)' };
  }

  return { reference, text: parts.join(' ') };
}
