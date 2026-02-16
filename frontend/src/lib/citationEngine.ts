// Citation Engine — APA 7, MLA 9, Chicago, IEEE, Harvard

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard';

export type CitationType = 'journal' | 'book' | 'website' | 'conference';

export interface Citation {
  id: string;
  type: CitationType;
  authors: { first: string; last: string }[];
  title: string;
  year: string;
  journal?: string;
  book?: string;
  website?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  accessedDate?: string;
  publisher?: string;
  edition?: string;
  conference?: string;
  // runtime numbering for IEEE
  _number?: number;
}

// ── Helpers ──────────────────────────────────────────────

function authorLastFirst(a: { first: string; last: string }) {
  return `${a.last}, ${a.first.charAt(0)}.`;
}

function authorFullName(a: { first: string; last: string }) {
  return `${a.last}, ${a.first}`;
}

function authorFirstLast(a: { first: string; last: string }) {
  return `${a.first} ${a.last}`;
}

function etAlAuthors(
  authors: Citation['authors'],
  maxBeforeEtAl: number,
  formatter: (a: { first: string; last: string }) => string,
  join = ', ',
  lastJoin = ', & ',
): string {
  if (authors.length === 0) return '';
  if (authors.length <= maxBeforeEtAl) {
    if (authors.length === 1) return formatter(authors[0]);
    const init = authors.slice(0, -1).map(formatter).join(join);
    return `${init}${lastJoin}${formatter(authors[authors.length - 1])}`;
  }
  return `${formatter(authors[0])} et al.`;
}

function italicize(s: string) { return `<em>${s}</em>`; }

// ── Inline citations ────────────────────────────────────

export function formatCitation(citation: Citation, style: CitationStyle): string {
  const { authors, year } = citation;
  const last0 = authors[0]?.last ?? 'Unknown';

  switch (style) {
    case 'apa': {
      if (authors.length === 1) return `(${last0}, ${year})`;
      if (authors.length === 2) return `(${authors[0].last} & ${authors[1].last}, ${year})`;
      return `(${last0} et al., ${year})`;
    }
    case 'mla': {
      if (authors.length === 1) return `(${last0} ${citation.pages ? citation.pages : ''})`.replace(/\s+\)/, ')');
      if (authors.length === 2) return `(${authors[0].last} and ${authors[1].last} ${citation.pages ?? ''})`.replace(/\s+\)/, ')');
      return `(${last0} et al. ${citation.pages ?? ''})`.replace(/\s+\)/, ')');
    }
    case 'chicago': {
      if (authors.length === 1) return `(${last0} ${year})`;
      if (authors.length <= 3) return `(${authors.map(a => a.last).join(', ')} ${year})`;
      return `(${last0} et al. ${year})`;
    }
    case 'ieee':
      return `[${citation._number ?? '?'}]`;
    case 'harvard': {
      if (authors.length === 1) return `(${last0}, ${year})`;
      if (authors.length === 2) return `(${authors[0].last} and ${authors[1].last}, ${year})`;
      return `(${last0} et al., ${year})`;
    }
    default:
      return `(${last0}, ${year})`;
  }
}

// ── Bibliography entries ────────────────────────────────

function fmtBibAPA(c: Citation): string {
  const auths = etAlAuthors(c.authors, 20, authorLastFirst, ', ', ', & ');
  const yr = ` (${c.year}).`;
  const title = c.type === 'journal' || c.type === 'conference'
    ? ` ${c.title}.`
    : ` ${italicize(c.title)}.`;
  let source = '';
  if (c.journal) source += ` ${italicize(c.journal)}`;
  if (c.volume) source += `, ${italicize(c.volume)}`;
  if (c.issue) source += `(${c.issue})`;
  if (c.pages) source += `, ${c.pages}`;
  if (source) source += '.';
  if (c.doi) source += ` https://doi.org/${c.doi}`;
  else if (c.url) source += ` ${c.url}`;
  return `${auths}${yr}${title}${source}`;
}

function fmtBibMLA(c: Citation): string {
  const auths = c.authors.length === 1
    ? authorFullName(c.authors[0])
    : c.authors.length === 2
      ? `${authorFullName(c.authors[0])}, and ${authorFirstLast(c.authors[1])}`
      : `${authorFullName(c.authors[0])}, et al.`;
  let entry = `${auths}. "${c.title}."`;
  if (c.journal) entry += ` ${italicize(c.journal)},`;
  if (c.book) entry += ` ${italicize(c.book)},`;
  if (c.volume) entry += ` vol. ${c.volume},`;
  if (c.issue) entry += ` no. ${c.issue},`;
  entry += ` ${c.year}`;
  if (c.pages) entry += `, pp. ${c.pages}`;
  entry += '.';
  if (c.doi) entry += ` https://doi.org/${c.doi}`;
  return entry;
}

function fmtBibChicago(c: Citation): string {
  const auths = c.authors.length === 1
    ? authorFullName(c.authors[0])
    : c.authors.length <= 3
      ? (() => {
          const init = c.authors.slice(0, -1).map((a, i) => i === 0 ? authorFullName(a) : authorFirstLast(a)).join(', ');
          return `${init}, and ${authorFirstLast(c.authors[c.authors.length - 1])}`;
        })()
      : `${authorFullName(c.authors[0])}, et al.`;
  let entry = `${auths}. "${c.title}."`;
  if (c.journal) entry += ` ${italicize(c.journal)}`;
  if (c.volume) entry += ` ${c.volume}`;
  if (c.issue) entry += `, no. ${c.issue}`;
  entry += ` (${c.year})`;
  if (c.pages) entry += `: ${c.pages}`;
  entry += '.';
  if (c.doi) entry += ` https://doi.org/${c.doi}`;
  return entry;
}

function fmtBibIEEE(c: Citation): string {
  const num = c._number ?? '?';
  const auths = c.authors.map(a => `${a.first.charAt(0)}. ${a.last}`).join(', ');
  let entry = `[${num}] ${auths}, "${c.title},"`;
  if (c.journal) entry += ` ${italicize(c.journal)},`;
  if (c.conference) entry += ` in ${italicize(c.conference)},`;
  if (c.volume) entry += ` vol. ${c.volume},`;
  if (c.issue) entry += ` no. ${c.issue},`;
  if (c.pages) entry += ` pp. ${c.pages},`;
  entry += ` ${c.year}.`;
  if (c.doi) entry += ` doi: ${c.doi}.`;
  return entry;
}

function fmtBibHarvard(c: Citation): string {
  const auths = etAlAuthors(c.authors, 3, authorLastFirst, ', ', ' and ');
  let entry = `${auths} (${c.year}) '${c.title}',`;
  if (c.journal) entry += ` ${italicize(c.journal)},`;
  if (c.volume) entry += ` ${c.volume}`;
  if (c.issue) entry += `(${c.issue})`;
  if (c.pages) entry += `, pp. ${c.pages}`;
  entry += '.';
  if (c.doi) entry += ` doi: ${c.doi}.`;
  else if (c.url) entry += ` Available at: ${c.url}`;
  if (c.accessedDate) entry += ` (Accessed: ${c.accessedDate}).`;
  return entry;
}

const bibFormatters: Record<CitationStyle, (c: Citation) => string> = {
  apa: fmtBibAPA,
  mla: fmtBibMLA,
  chicago: fmtBibChicago,
  ieee: fmtBibIEEE,
  harvard: fmtBibHarvard,
};

export function formatBibliographyEntry(citation: Citation, style: CitationStyle): string {
  return bibFormatters[style](citation);
}

export function formatBibliography(citations: Citation[], style: CitationStyle): string[] {
  // Number for IEEE
  const numbered = citations.map((c, i) => ({ ...c, _number: i + 1 }));
  // Sort: IEEE by order of appearance, others alphabetically
  const sorted = style === 'ieee'
    ? numbered
    : [...numbered].sort((a, b) => (a.authors[0]?.last ?? '').localeCompare(b.authors[0]?.last ?? ''));
  return sorted.map(c => bibFormatters[style](c));
}

// ── BibTeX import / export ──────────────────────────────

export function parseBibTeX(input: string): Citation[] {
  const entries: Citation[] = [];
  const entryRegex = /@(\w+)\{([^,]*),\s*([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(input)) !== null) {
    const entryType = match[1].toLowerCase();
    const fields: Record<string, string> = {};
    const body = match[3];
    const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRegex.exec(body)) !== null) {
      fields[fm[1].toLowerCase()] = fm[2].trim();
    }

    const typeMap: Record<string, CitationType> = {
      article: 'journal',
      book: 'book',
      inproceedings: 'conference',
      conference: 'conference',
      misc: 'website',
      online: 'website',
    };

    const authors = (fields.author ?? '').split(/\s+and\s+/).map(a => {
      const parts = a.split(',').map(s => s.trim());
      if (parts.length >= 2) return { last: parts[0], first: parts[1] };
      const words = a.trim().split(/\s+/);
      return { last: words[words.length - 1], first: words.slice(0, -1).join(' ') };
    }).filter(a => a.last);

    entries.push({
      id: `cite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: typeMap[entryType] ?? 'journal',
      authors,
      title: fields.title ?? '',
      year: fields.year ?? '',
      journal: fields.journal,
      book: fields.booktitle,
      volume: fields.volume,
      issue: fields.number,
      pages: fields.pages,
      doi: fields.doi,
      url: fields.url,
      publisher: fields.publisher,
      edition: fields.edition,
    });
  }
  return entries;
}

export function exportBibTeX(citations: Citation[]): string {
  return citations.map(c => {
    const typeMap: Record<CitationType, string> = {
      journal: 'article',
      book: 'book',
      conference: 'inproceedings',
      website: 'misc',
    };
    const key = `${c.authors[0]?.last ?? 'unknown'}${c.year}`.toLowerCase();
    const fields: string[] = [];
    const authStr = c.authors.map(a => `${a.last}, ${a.first}`).join(' and ');
    fields.push(`  author = {${authStr}}`);
    fields.push(`  title = {${c.title}}`);
    fields.push(`  year = {${c.year}}`);
    if (c.journal) fields.push(`  journal = {${c.journal}}`);
    if (c.book) fields.push(`  booktitle = {${c.book}}`);
    if (c.conference) fields.push(`  booktitle = {${c.conference}}`);
    if (c.volume) fields.push(`  volume = {${c.volume}}`);
    if (c.issue) fields.push(`  number = {${c.issue}}`);
    if (c.pages) fields.push(`  pages = {${c.pages}}`);
    if (c.doi) fields.push(`  doi = {${c.doi}}`);
    if (c.url) fields.push(`  url = {${c.url}}`);
    if (c.publisher) fields.push(`  publisher = {${c.publisher}}`);
    if (c.edition) fields.push(`  edition = {${c.edition}}`);
    return `@${typeMap[c.type]}{${key},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

// ── DOI lookup mock (swap with real Crossref API later) ─

export async function lookupDOI(doi: string): Promise<Citation | null> {
  // Mock implementation — structure ready for real API
  // Real implementation: fetch(`https://api.crossref.org/works/${doi}`)
  const _doi = doi; // acknowledge usage
  void _doi;
  return null; // Return null = not found; real API would populate fields
}
