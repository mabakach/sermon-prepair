import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = 'flux2-klein-9b';
const STEPS = '4';
const TIMEOUT_MS = 30 * 60 * 1000;

function findMflux(): string {
  if (process.env.MFLUX_BIN) return process.env.MFLUX_BIN;
  const local = join(homedir(), '.local', 'bin', 'mflux-generate-flux2');
  return existsSync(local) ? local : 'mflux-generate-flux2';
}

/** true, wenn macOS und das mflux-Binary auffindbar ist (Env, ~/.local/bin oder PATH). */
export function imageGenerationAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  const bin = findMflux();
  if (bin.includes('/')) return existsSync(bin);
  return (process.env.PATH ?? '').split(':').some((d) => d && existsSync(join(d, bin)));
}

const CROP_PY = `
import sys
from PIL import Image
p, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
im = Image.open(p)
l = (im.width - w) // 2
t = (im.height - h) // 2
im.crop((l, t, l + w, t + h)).save(p)
`;

async function cropCenter(path: string, width: number, height: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(findPython(), ['-c', CROP_PY, path, String(width), String(height)], (err, _o, stderr) =>
      err ? reject(new Error(`Zuschneiden fehlgeschlagen: ${stderr.trim() || err.message}`)) : resolve()
    );
  });
}

export interface ImageResult {
  path: string;
  model: string;
  width: number;
  height: number;
  seconds: number;
}

export async function generateImage(
  prompt: string,
  outputPath: string,
  width = 1920,
  height = 1080,
  seed?: number,
  onProgress?: (step: number, total: number) => void
): Promise<ImageResult> {
  if (process.platform !== 'darwin') {
    throw new Error('Bildgenerierung (mflux) läuft nur auf macOS mit Apple Silicon.');
  }
  if (!isAbsolute(outputPath)) {
    throw new Error('output_path muss ein absoluter Pfad sein.');
  }
  await mkdir(dirname(outputPath), { recursive: true });

  // mflux rundet auf Vielfache von 16: grösser erzeugen, danach mittig auf Zielgrösse zuschneiden.
  const genWidth = Math.ceil(width / 16) * 16;
  const genHeight = Math.ceil(height / 16) * 16;

  const args = [
    '--model', MODEL,
    '--prompt', prompt,
    '--width', String(genWidth),
    '--height', String(genHeight),
    '--steps', STEPS,
    '--output', outputPath,
  ];
  if (seed !== undefined) args.push('--seed', String(seed));

  const start = Date.now();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(findMflux(), args);
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-8192);
      const m = [...text.matchAll(/\|\s*(\d+)\/(\d+)\s*\[/g)].pop();
      if (m && onProgress) onProgress(Number(m[1]), Number(m[2]));
    });
    child.stdout.resume();
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`mflux fehlgeschlagen: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      const hint = /gated|restricted|log in/i.test(stderr)
        ? ' (Hugging Face: Lizenz für black-forest-labs/FLUX.2-klein-9B akzeptieren und `hf auth login` ausführen)'
        : '';
      const tail = stderr.trim().split(/[\r\n]+/).slice(-3).join(' | ');
      reject(new Error(`mflux fehlgeschlagen: Exit-Code ${code}${hint} ${tail}`));
    });
  });

  if (!existsSync(outputPath)) throw new Error('mflux lieferte keine Bilddatei.');
  if (genWidth !== width || genHeight !== height) await cropCenter(outputPath, width, height);
  return { path: outputPath, model: MODEL, width, height, seconds: Math.round((Date.now() - start) / 1000) };
}

// Python-Interpreter der mflux-Installation (enthält Pillow): Shebang des mflux-Binaries.
function findPython(): string {
  try {
    const bin = findMflux();
    if (isAbsolute(bin)) {
      const first = readFileSync(bin, 'utf8').split('\n', 1)[0];
      if (first.startsWith('#!')) {
        const py = first.slice(2).trim();
        if (existsSync(py)) return py;
      }
    }
  } catch {
    // Fallback unten
  }
  return 'python3';
}

export interface OverlayResult {
  path: string;
  detail: string;
}

export async function overlayText(
  inputPath: string,
  outputPath: string,
  text: string,
  reference?: string,
  position: 'auto' | 'top' | 'bottom' = 'auto'
): Promise<OverlayResult> {
  if (!isAbsolute(inputPath) || !isAbsolute(outputPath)) {
    throw new Error('input_path und output_path müssen absolute Pfade sein.');
  }
  if (!existsSync(inputPath)) throw new Error(`Bild nicht gefunden: ${inputPath}`);

  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'overlay_text.py');
  const args = [script, '--input', inputPath, '--output', outputPath, '--text', text, '--position', position];
  if (reference) args.push('--reference', reference);

  const detail = await new Promise<string>((resolve, reject) => {
    execFile(findPython(), args, { timeout: 2 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Text-Overlay fehlgeschlagen: ${stderr.trim() || (err as Error).message}`));
      resolve(stdout.trim());
    });
  });
  return { path: outputPath, detail };
}
