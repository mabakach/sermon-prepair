import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '../../../.claude/commands/gottesdienst-template.html');

const COLORS: [RegExp, string, string][] = [
  [/^(wei(ß|ss))/i, 'Weiß', '#F5F0E8'],
  [/^gr(ü|ue)n/i, 'Grün', '#4A7C59'],
  [/^(violett|lila)/i, 'Violett', '#6B3FA0'],
  [/^rot/i, 'Rot', '#B91C1C'],
  [/^schwarz/i, 'Schwarz', '#1A1A1A'],
  [/^gold/i, 'Gold', '#B8860B'],
];

const BADGE = '<span class="perikope-tag">nach Perikopenordnung</span>';

export interface Slot {
  reference: string;
  /** Bibeltext als HTML (von getBibleText), leer = keine Angabe */
  text?: string;
  /** true = Stelle stammt aus der Perikopenordnung */
  perikope?: boolean;
}

export interface RenderInput {
  /** YYYY-MM-DD */
  date: string;
  sundayName?: string;
  colorRaw?: string;
  seasonRaw?: string;
  ordnung: 'de' | 'ch';
  /** Deutsche Ordnung verwendet (Wochenspruch, Psalm, Evangelium sichtbar) */
  deOnly: boolean;
  at?: Slot;
  nt?: Slot;
  predigttext?: Slot;
  evangelium?: Slot;
  wochenpsalm?: Slot;
  wochenspruch?: Slot;
  hasImage: boolean;
}

/** Die Kalender-Quelle liefert Farbe/Festzeit samt Fliesstext; auf das Wesentliche kürzen. */
export function normalizeColor(raw?: string): { name: string; hex: string } {
  const s = (raw ?? '').trim();
  for (const [re, name, hex] of COLORS) if (re.test(s)) return { name, hex };
  return { name: '', hex: '#888888' };
}

export function normalizeSeason(raw?: string): string {
  const s = (raw ?? '').trim();
  return s.split(/\s+Liturgische Farbe\b|\s+Kernaussage\b/)[0].trim();
}

export function folderName(date: string, sundayName?: string): string {
  if (!sundayName) return `${date}_Gottesdienst`;
  const slug = sundayName.replace(/\./g, '').replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '');
  return `${date}_${slug}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function block(html: string, name: string, keep: boolean): string {
  const re = new RegExp(`[ \\t]*<!-- ${name}_START -->\\n?([\\s\\S]*?)[ \\t]*<!-- ${name}_END -->\\n?`, 'g');
  return html.replace(re, keep ? '$1' : '');
}

export async function renderHtml(input: RenderInput): Promise<string> {
  let html = await readFile(TEMPLATE, 'utf-8');
  html = block(html, 'BILD', input.hasImage);
  html = block(html, 'DE_ONLY', input.deOnly);

  const color = normalizeColor(input.colorRaw);
  const vars: Record<string, string> = {
    DATE: formatDate(input.date),
    SUNDAY_NAME: esc(input.sundayName || 'Gottesdienst'),
    LITURGICAL_COLOR: color.name,
    LITURGICAL_COLOR_HEX: color.hex,
    LITURGICAL_SEASON: esc(normalizeSeason(input.seasonRaw)),
    PERIKOPEN_SOURCE: input.ordnung === 'de' && input.deOnly ? 'kirchenjahr-evangelisch.de' : 'pfarrverein.ch',
  };
  const slots: [string, Slot | undefined, boolean][] = [
    ['AT', input.at, false],
    ['NT', input.nt, false],
    ['PREDIGTTEXT', input.predigttext, false],
    ['EVANGELIUM', input.evangelium, true],
    ['WOCHENPSALM', input.wochenpsalm, false],
    ['WOCHENSPRUCH', input.wochenspruch, false],
  ];
  for (const [key, slot, alwaysBadge] of slots) {
    const filled = !!slot?.reference;
    vars[`${key}_REFERENCE`] = filled ? esc(slot!.reference) : '–';
    vars[`${key}_TEXT`] = filled && slot!.text ? slot!.text : '(keine Angabe)';
    vars[`${key}_BADGE`] = filled && (alwaysBadge || slot!.perikope) ? BADGE : '';
  }
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

  // leere Slots markieren
  const emptyRoles: [string, Slot | undefined][] = [
    ['Lesung Altes Testament', input.at],
    ['Lesung Neues Testament', input.nt],
    ['Predigttext', input.predigttext],
  ];
  for (const [role, slot] of emptyRoles) {
    if (slot?.reference) continue;
    const idx = html.indexOf(`<p class="passage-role">${role}`);
    if (idx < 0) continue;
    const start = html.lastIndexOf('<section class="passage">', idx);
    if (start >= 0) html = html.slice(0, start) + '<section class="passage passage--empty">' + html.slice(start + '<section class="passage">'.length);
  }
  return html;
}

export async function writeResult(baseDir: string, folder: string, html: string): Promise<string> {
  const dir = join(baseDir, folder);
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'index.html');
  await writeFile(file, html, 'utf-8');
  return file;
}
