import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecentDocs, { RecentDocEntry, loadRecentDocs, touchRecentDoc, removeRecentDoc } from '../components/RecentDocs';
import type { AppMode } from '../App';

describe('RecentDocs', () => {
  const noop = vi.fn();

  const defaultProps = {
    onOpenDocument: noop,
    onNewDocument: noop,
    onNewSpreadsheet: noop,
    onNewPresentation: noop,
    onNewDrawing: noop,
    onNewDatabase: noop,
    onNewFromTemplate: noop,
    recentDocs: [] as RecentDocEntry[],
    landingMode: 'docs' as AppMode,
    onLandingModeChange: noop,
  };

  it('renders without crashing', () => {
    const { container } = render(<RecentDocs {...defaultProps} />);
    expect(container.querySelector('.recent-docs')).toBeTruthy();
  });

  it('renders hero heading for docs mode', () => {
    render(<RecentDocs {...defaultProps} landingMode="docs" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('MD Docs');
  });

  it('renders hero heading for sheets mode', () => {
    render(<RecentDocs {...defaultProps} landingMode="sheets" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('MD Sheets');
  });

  it('renders hero heading for slides mode', () => {
    render(<RecentDocs {...defaultProps} landingMode="slides" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('MD Slides');
  });

  it('renders new document action buttons', () => {
    render(<RecentDocs {...defaultProps} />);
    expect(screen.getByText('New Document')).toBeInTheDocument();
    expect(screen.getByText('New Spreadsheet')).toBeInTheDocument();
    expect(screen.getByText('New Presentation')).toBeInTheDocument();
  });

  it('calls onNewDocument when clicking New Document', () => {
    const onNewDocument = vi.fn();
    render(<RecentDocs {...defaultProps} onNewDocument={onNewDocument} />);
    fireEvent.click(screen.getByText('New Document'));
    expect(onNewDocument).toHaveBeenCalledOnce();
  });

  it('calls onNewSpreadsheet when clicking New Spreadsheet', () => {
    const onNewSpreadsheet = vi.fn();
    render(<RecentDocs {...defaultProps} onNewSpreadsheet={onNewSpreadsheet} />);
    fireEvent.click(screen.getByText('New Spreadsheet'));
    expect(onNewSpreadsheet).toHaveBeenCalledOnce();
  });

  it('renders recent documents list', () => {
    const docs: RecentDocEntry[] = [
      { path: 'docs/readme.md', title: 'readme', lastModified: new Date().toISOString(), preview: 'Hello world' },
      { path: 'docs/notes.md', title: 'notes', lastModified: new Date().toISOString(), preview: 'My notes' },
    ];
    render(<RecentDocs {...defaultProps} recentDocs={docs} />);
    expect(screen.getByText('readme')).toBeInTheDocument();
    expect(screen.getByText('notes')).toBeInTheDocument();
  });

  it('calls onOpenDocument when clicking a recent doc', () => {
    const onOpenDocument = vi.fn();
    const docs: RecentDocEntry[] = [
      { path: 'docs/readme.md', title: 'readme', lastModified: new Date().toISOString(), preview: 'Hello world' },
    ];
    render(<RecentDocs {...defaultProps} recentDocs={docs} onOpenDocument={onOpenDocument} />);
    fireEvent.click(screen.getByText('readme'));
    expect(onOpenDocument).toHaveBeenCalledWith('docs/readme.md');
  });

  it('shows empty state when no recent docs', () => {
    render(<RecentDocs {...defaultProps} recentDocs={[]} />);
    expect(screen.getByText('No recent documents yet')).toBeInTheDocument();
  });

  it('switches landing mode via app switcher buttons', () => {
    const onLandingModeChange = vi.fn();
    render(<RecentDocs {...defaultProps} onLandingModeChange={onLandingModeChange} />);
    fireEvent.click(screen.getByTitle('MD Sheets'));
    expect(onLandingModeChange).toHaveBeenCalledWith('sheets');
  });

  it('renders subtitle text', () => {
    render(<RecentDocs {...defaultProps} />);
    expect(screen.getByText('Start a new document or pick up where you left off')).toBeInTheDocument();
  });
});

describe('RecentDocs localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadRecentDocs returns empty array when no data', () => {
    expect(loadRecentDocs()).toEqual([]);
  });

  it('touchRecentDoc adds and returns entries', () => {
    const result = touchRecentDoc('docs/test.md', '# Test content');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('docs/test.md');
    expect(result[0].title).toBe('test');
  });

  it('touchRecentDoc strips .slides.md extension', () => {
    const result = touchRecentDoc('pres/demo.slides.md', '# Slide');
    expect(result[0].title).toBe('demo');
  });

  it('touchRecentDoc strips .sheet.md extension', () => {
    const result = touchRecentDoc('sheets/budget.sheet.md', 'data');
    expect(result[0].title).toBe('budget');
  });

  it('touchRecentDoc limits to 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      touchRecentDoc(`docs/file${i}.md`, `Content ${i}`);
    }
    const docs = loadRecentDocs();
    expect(docs.length).toBeLessThanOrEqual(20);
  });

  it('removeRecentDoc removes an entry', () => {
    touchRecentDoc('docs/a.md', 'A');
    touchRecentDoc('docs/b.md', 'B');
    const result = removeRecentDoc('docs/a.md');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('docs/b.md');
  });
});
