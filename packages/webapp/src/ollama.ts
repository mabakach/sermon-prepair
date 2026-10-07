const HOST = process.env.OLLAMA_HOST?.replace(/\/$/, '') ?? 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5:9b';

const SYSTEM = `You write image prompts for the FLUX text-to-image model. The image illustrates a Bible verse (Wochenspruch) on a church service sheet.

Rules:
- Answer with ONE prompt in English, 1 to 3 sentences, no preface, no quotes, no list.
- First find the central message of the verse and its literal image (path, light, water, bread, door, seed, rock, lamp, bridge, mountain, sea, night and stars, storm and calm, vine ...). Make exactly that image the main subject in the foreground.
- Do NOT default to hills, meadow, sunrise and a single tree. Choose setting, time of day, light and colour mood that fit the message.
- Style: watercolor illustration, contemplative, church bulletin art, soft muted colors.
- Never show hands, fingers, arms or faces. If people are unavoidable, tiny silhouettes seen from behind in the distance. No depiction of Jesus, no cross kitsch.
- No text, no letters, no writing in the image.
- End the prompt with: wide 16:9 composition, calm uncluttered area at the top for text`;

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${HOST}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: { name: string }[] };
    return !!data.models?.some((m) => m.name === OLLAMA_MODEL || m.name === `${OLLAMA_MODEL}:latest`);
  } catch {
    return false;
  }
}

/** Schlägt einen englischen Bild-Prompt vor. keep_alive 0 entlädt das Modell sofort (RAM für mflux). */
export async function suggestImagePrompt(reference: string, text: string, hint = ''): Promise<string> {
  const user = `Verse (${reference}): ${text}${hint ? `\nAdditional wish from the user: ${hint}` : ''}`;
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      keep_alive: 0,
      options: { temperature: 0.8 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama antwortete mit ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const out = (data.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!out) throw new Error('Ollama lieferte keinen Prompt');
  return out;
}
