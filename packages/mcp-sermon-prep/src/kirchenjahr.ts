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

  // Steckbrief: <div class="profile-entry-container"> with <h3> label and a sibling value element.
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
  const liturgical_color = clean(root.querySelector('.profile-liturgical-color')?.text ?? '');
  const liturgical_season = clean(
    root
      .querySelectorAll('.profile-entry-container')
      .find(c => clean(c.querySelector('h3')?.text ?? '') === 'Festzeit')
      ?.querySelector('.profile-entry-content')?.text ?? ''
  );

  return {
    sunday_name: sundayName,
    liturgical_color,
    liturgical_season,
    date,
  };
}
