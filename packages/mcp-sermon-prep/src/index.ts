import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getLectionary } from './perikopen.js';
import { getChurchCalendar } from './kirchenjahr.js';
import { getBibleText } from './bibleserver.js';
import { generateImage } from './imagegen.js';

const server = new Server(
  { name: 'sermon-prep', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_church_calendar',
      description:
        'Gibt Sonntagsname und liturgische Farbe für ein Datum zurück. ' +
        'Benötigt den Sonntagsnamen (z.B. aus get_lectionary) für die Kirchenjahr-Abfrage.',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Datum im Format YYYY-MM-DD',
          },
          sunday_name: {
            type: 'string',
            description: 'Deutscher Sonntagsname (z.B. "4. Sonntag nach Trinitatis")',
          },
        },
        required: ['date', 'sunday_name'],
      },
    },
    {
      name: 'get_lectionary',
      description:
        'Holt die Perikopenordnung für einen Sonntag. Standard: deutsche Ordnung ' +
        '(kirchenjahr-evangelisch.de: AT, Epistel, Evangelium, Predigttext); ' +
        'alternativ schweizerische Ordnung (pfarrverein.ch). Gibt auch den Sonntagsnamen zurück.',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Datum eines Sonntags im Format YYYY-MM-DD',
          },
          ordnung: {
            type: 'string',
            enum: ['de', 'ch'],
            description: 'Perikopenordnung: "de" = deutsch (Standard), "ch" = schweizerisch',
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'get_bible_text',
      description:
        'Holt den Bibeltext (Zürcherbibel) für eine Bibelstelle in deutschem Format, ' +
        'z.B. "Jeremia 26, 1 - 15" oder "Johannes 3, 16".',
      inputSchema: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description: 'Bibelstelle auf Deutsch, z.B. "Römer 6, 12 - 14"',
          },
        },
        required: ['reference'],
      },
    },
    {
      name: 'generate_image',
      description:
        'Erzeugt lokal ein Bild (FLUX.2 Klein 9B via mflux, nur macOS/Apple Silicon) und speichert es als PNG. ' +
        'Dauert je nach Rechner 2 bis 15 Minuten; beim ersten Lauf werden mehrere GB Modellgewichte geladen.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Bildbeschreibung (Englisch liefert die besten Ergebnisse)' },
          output_path: { type: 'string', description: 'Absoluter Zielpfad der PNG-Datei' },
          width: { type: 'number', description: 'Breite in Pixel (Standard 1024)' },
          height: { type: 'number', description: 'Höhe in Pixel (Standard 1024)' },
          seed: { type: 'number', description: 'Optionaler Seed für reproduzierbare Bilder' },
        },
        required: ['prompt', 'output_path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_lectionary') {
      const result = await getLectionary(
        args!.date as string,
        args!.ordnung === 'ch' ? 'ch' : 'de'
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'get_church_calendar') {
      const result = await getChurchCalendar(
        args!.date as string,
        args!.sunday_name as string
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'get_bible_text') {
      const result = await getBibleText(args!.reference as string);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'generate_image') {
      const result = await generateImage(
        args!.prompt as string,
        args!.output_path as string,
        args!.width as number | undefined,
        args!.height as number | undefined,
        args!.seed as number | undefined
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    throw new Error(`Unbekanntes Tool: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Fehler: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
