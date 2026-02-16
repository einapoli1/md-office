import { describe, it, expect } from 'vitest';
import {
  formatCitation, formatBibliographyEntry, formatBibliography,
  parseBibTeX, exportBibTeX,
  type Citation,
} from '../lib/citationEngine';

const singleAuthor: Citation = {
  id: '1', type: 'journal', authors: [{ first: 'John', last: 'Smith' }],
  title: 'A Study', year: '2023', journal: 'Nature', volume: '10', issue: '2', pages: '1-10', doi: '10.1234/test',
};

const twoAuthors: Citation = {
  id: '2', type: 'book', authors: [{ first: 'Alice', last: 'Brown' }, { first: 'Bob', last: 'White' }],
  title: 'A Book', year: '2022', publisher: 'Press',
};

const manyAuthors: Citation = {
  id: '3', type: 'journal', authors: [
    { first: 'A', last: 'One' }, { first: 'B', last: 'Two' },
    { first: 'C', last: 'Three' }, { first: 'D', last: 'Four' },
  ],
  title: 'Big Paper', year: '2021', journal: 'Science', pages: '50-60',
};

const website: Citation = {
  id: '4', type: 'website', authors: [{ first: 'Eve', last: 'Adams' }],
  title: 'Web Article', year: '2024', url: 'https://example.com', accessedDate: '2024-01-15',
};

describe('formatCitation (inline)', () => {
  it('APA single author', () => {
    expect(formatCitation(singleAuthor, 'apa')).toBe('(Smith, 2023)');
  });
  it('APA two authors', () => {
    expect(formatCitation(twoAuthors, 'apa')).toBe('(Brown & White, 2022)');
  });
  it('APA 3+ authors uses et al.', () => {
    expect(formatCitation(manyAuthors, 'apa')).toBe('(One et al., 2021)');
  });
  it('MLA single author with pages', () => {
    expect(formatCitation(singleAuthor, 'mla')).toBe('(Smith 1-10)');
  });
  it('Chicago single author', () => {
    expect(formatCitation(singleAuthor, 'chicago')).toBe('(Smith 2023)');
  });
  it('IEEE uses number', () => {
    expect(formatCitation({ ...singleAuthor, _number: 3 }, 'ieee')).toBe('[3]');
  });
  it('Harvard two authors', () => {
    expect(formatCitation(twoAuthors, 'harvard')).toBe('(Brown and White, 2022)');
  });
});

describe('formatBibliographyEntry', () => {
  it('APA journal entry contains DOI', () => {
    const entry = formatBibliographyEntry(singleAuthor, 'apa');
    expect(entry).toContain('https://doi.org/10.1234/test');
    expect(entry).toContain('Smith, J.');
  });
  it('MLA entry uses quotes around title', () => {
    const entry = formatBibliographyEntry(singleAuthor, 'mla');
    expect(entry).toContain('"A Study."');
  });
  it('Chicago entry format', () => {
    const entry = formatBibliographyEntry(singleAuthor, 'chicago');
    expect(entry).toContain('Smith, John');
  });
  it('IEEE entry has bracket number', () => {
    const entry = formatBibliographyEntry({ ...singleAuthor, _number: 1 }, 'ieee');
    expect(entry).toMatch(/^\[1\]/);
  });
  it('Harvard entry with URL and accessed date', () => {
    const entry = formatBibliographyEntry(website, 'harvard');
    expect(entry).toContain('Available at: https://example.com');
    expect(entry).toContain('Accessed: 2024-01-15');
  });
});

describe('formatBibliography', () => {
  it('sorts alphabetically for APA', () => {
    const bib = formatBibliography([manyAuthors, singleAuthor], 'apa');
    expect(bib[0]).toContain('One');
    expect(bib[1]).toContain('Smith');
  });
  it('IEEE preserves order', () => {
    const bib = formatBibliography([singleAuthor, manyAuthors], 'ieee');
    expect(bib[0]).toMatch(/^\[1\]/);
    expect(bib[1]).toMatch(/^\[2\]/);
  });
});

describe('BibTeX import/export', () => {
  const bibtex = `@article{smith2023,
  author = {Smith, John},
  title = {A Study},
  year = {2023},
  journal = {Nature},
  volume = {10},
  number = {2},
  pages = {1-10},
  doi = {10.1234/test}
}`;

  it('parseBibTeX extracts fields', () => {
    const citations = parseBibTeX(bibtex);
    expect(citations).toHaveLength(1);
    expect(citations[0].authors[0].last).toBe('Smith');
    expect(citations[0].title).toBe('A Study');
    expect(citations[0].type).toBe('journal');
  });

  it('exportBibTeX produces valid output', () => {
    const exported = exportBibTeX([singleAuthor]);
    expect(exported).toContain('@article{');
    expect(exported).toContain('title = {A Study}');
  });

  it('roundtrip preserves key fields', () => {
    const exported = exportBibTeX([singleAuthor]);
    const reimported = parseBibTeX(exported);
    expect(reimported[0].title).toBe(singleAuthor.title);
    expect(reimported[0].year).toBe(singleAuthor.year);
    expect(reimported[0].authors[0].last).toBe('Smith');
  });

  it('parseBibTeX handles multiple entries', () => {
    const multi = bibtex + '\n\n@book{brown2022,\n  author = {Brown, Alice},\n  title = {A Book},\n  year = {2022}\n}';
    const citations = parseBibTeX(multi);
    expect(citations).toHaveLength(2);
  });
});
