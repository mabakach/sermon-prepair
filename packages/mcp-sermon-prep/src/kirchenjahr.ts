import { parse } from 'node-html-parser';

export interface ChurchCalendarResult {
  sunday_name: string;
  liturgical_color: string;
  liturgical_season: string;
  date: string;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\./g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function getChurchCalendar(date: string, sundayName: string): Promise<ChurchCalendarResult> {
  const slug = toSlug(sundayName);
  const url = `https://kirchenjahr-evangelisch.de/${slug}/`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`kirchenjahr-evangelisch.de returned ${res.status} for slug "${slug}"`);
  const html = await res.text();
  const root = parse(html);

  // Extract key-value pairs from the Steckbrief section.
  // The site uses heading tags (h2/h3) as labels followed by the value in the next sibling/element.
  const text = root.text;

  const extract = (label: string): string => {
    const regex = new RegExp(`${label}\\s*\\n?\\s*([^\\n]+)`);
    const m = text.match(regex);
    return m ? m[1].trim() : '';
  };

  const liturgical_color = extract('Liturgische Farbe');
  const liturgical_season = extract('Festzeit');

  return {
    sunday_name: sundayName,
    liturgical_color,
    liturgical_season,
    date,
  };
}
