import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLectionary, type Ordnung } from 'mcp-sermon-prep/perikopen';
import { getChurchCalendar } from 'mcp-sermon-prep/kirchenjahr';
import { getBibleText } from 'mcp-sermon-prep/bibleserver';
import { folderName, normalizeColor, normalizeSeason, renderHtml, writeResult, type Slot } from './render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../public');
const PORT = Number(process.env.PORT ?? 4173);
const OUTPUT_DIR = resolve(process.env.SERMON_OUTPUT_DIR ?? join(homedir(), 'Documents', 'Gottesdienste'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) throw new HttpError(413, 'Anfrage zu gross');
    chunks.push(c as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
}

function checkDate(date: unknown): string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    throw new HttpError(400, 'Datum muss YYYY-MM-DD sein');
  }
  return date;
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

async function lectionary(body: any) {
  const date = checkDate(body.date);
  const ordnung: Ordnung = body.ordnung === 'ch' ? 'ch' : 'de';
  if (!isSunday(date)) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { sunday: false, prevSunday: shiftDays(date, -dow), nextSunday: shiftDays(date, 7 - dow) };
  }
  const lect = await getLectionary(date, ordnung);
  const cal = await getChurchCalendar(date, lect.sunday_name).catch(() => null);
  const byType = (re: RegExp) => lect.passages.find((p) => re.test(p.type))?.reference ?? '';
  return {
    sunday: true,
    date,
    ordnung,
    sundayName: lect.sunday_name,
    color: cal ? normalizeColor(cal.liturgical_color).name : '',
    colorRaw: cal?.liturgical_color ?? '',
    seasonRaw: cal?.liturgical_season ?? '',
    season: cal ? normalizeSeason(cal.liturgical_season) : '',
    at: byType(/Altes Testament/),
    nt: byType(/Neues Testament/),
    evangelium: byType(/Evangelium/),
    predigttext: byType(/Predigttext/),
    wochenspruch: lect.wochenspruch ?? null,
    wochenpsalm: lect.wochenpsalm ?? '',
  };
}

async function fillSlot(s: any): Promise<Slot | undefined> {
  const reference = typeof s?.reference === 'string' ? s.reference.trim() : '';
  if (!reference) return undefined;
  let text: string;
  try {
    text = (await getBibleText(reference)).text;
  } catch {
    text = typeof s.fallbackText === 'string' && s.fallbackText ? s.fallbackText : '(Text nicht abrufbar)';
  }
  return { reference, text, perikope: !!s.perikope };
}

async function generate(body: any) {
  const date = checkDate(body.date);
  const ordnung: Ordnung = body.ordnung === 'ch' ? 'ch' : 'de';
  const deOnly = ordnung === 'de' && !!body.deOnly;
  const s = body.slots ?? {};
  const [at, nt, predigttext, evangelium, wochenpsalm, wochenspruch] = await Promise.all([
    fillSlot(s.at),
    fillSlot(s.nt),
    fillSlot(s.predigttext),
    deOnly ? fillSlot(s.evangelium) : undefined,
    deOnly ? fillSlot(s.wochenpsalm) : undefined,
    deOnly ? fillSlot(s.wochenspruch) : undefined,
  ]);
  const sundayName = typeof body.sundayName === 'string' && body.sundayName ? body.sundayName : undefined;
  const folder = folderName(date, sundayName);
  const html = await renderHtml({
    date,
    sundayName,
    colorRaw: body.colorRaw,
    seasonRaw: body.seasonRaw,
    ordnung,
    deOnly,
    at,
    nt,
    predigttext,
    evangelium,
    wochenpsalm,
    wochenspruch,
    hasImage: false,
  });
  const file = await writeResult(OUTPUT_DIR, folder, html);
  return { folder, file, url: `/files/${encodeURIComponent(folder)}/index.html` };
}

async function serveFile(res: ServerResponse, root: string, rel: string) {
  const full = normalize(join(root, rel));
  if (full !== root && !full.startsWith(root + sep)) throw new HttpError(403, 'Verboten');
  try {
    const st = await stat(full);
    if (!st.isFile()) throw new Error();
  } catch {
    throw new HttpError(404, 'Nicht gefunden');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(full)] ?? 'application/octet-stream' });
  res.end(await readFile(full));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    if (req.method === 'GET' && path === '/api/capabilities') {
      return send(res, 200, { image: false, ollama: false, outputDir: OUTPUT_DIR });
    }
    if (req.method === 'POST' && path === '/api/lectionary') return send(res, 200, await lectionary(await readJson(req)));
    if (req.method === 'POST' && path === '/api/generate') return send(res, 200, await generate(await readJson(req)));
    if (req.method === 'GET' && path.startsWith('/files/')) return await serveFile(res, OUTPUT_DIR, path.slice('/files/'.length));
    if (req.method === 'GET') return await serveFile(res, PUBLIC, path === '/' ? 'index.html' : path.slice(1));
    throw new HttpError(404, 'Nicht gefunden');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    send(res, status, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Gottesdienst-Webapp: http://127.0.0.1:${PORT}`);
  console.log(`Ausgabe: ${OUTPUT_DIR}`);
});
