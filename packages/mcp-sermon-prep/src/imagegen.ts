import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

const MODEL = 'flux2-klein-9b';
const STEPS = '4';
const TIMEOUT_MS = 30 * 60 * 1000;

function findMflux(): string {
  if (process.env.MFLUX_BIN) return process.env.MFLUX_BIN;
  const local = join(homedir(), '.local', 'bin', 'mflux-generate-flux2');
  return existsSync(local) ? local : 'mflux-generate-flux2';
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
  width = 1024,
  height = 1024,
  seed?: number
): Promise<ImageResult> {
  if (process.platform !== 'darwin') {
    throw new Error('Bildgenerierung (mflux) läuft nur auf macOS mit Apple Silicon.');
  }
  if (!isAbsolute(outputPath)) {
    throw new Error('output_path muss ein absoluter Pfad sein.');
  }
  await mkdir(dirname(outputPath), { recursive: true });

  const args = [
    '--model', MODEL,
    '--prompt', prompt,
    '--width', String(width),
    '--height', String(height),
    '--steps', STEPS,
    '--output', outputPath,
  ];
  if (seed !== undefined) args.push('--seed', String(seed));

  const start = Date.now();
  await new Promise<void>((resolve, reject) => {
    execFile(findMflux(), args, { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err, _out, stderr) => {
      if (!err) return resolve();
      const hint = /gated|restricted|log in/i.test(stderr)
        ? ' (Hugging Face: Lizenz für black-forest-labs/FLUX.2-klein-9B akzeptieren und `hf auth login` ausführen)'
        : '';
      const tail = stderr.trim().split('\n').slice(-3).join(' | ');
      reject(new Error(`mflux fehlgeschlagen: ${(err as Error).message}${hint} ${tail}`));
    });
  });

  if (!existsSync(outputPath)) throw new Error('mflux lieferte keine Bilddatei.');
  return { path: outputPath, model: MODEL, width, height, seconds: Math.round((Date.now() - start) / 1000) };
}
