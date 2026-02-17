import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Editor component (TipTap-based) to avoid ProseMirror DOM issues in jsdom
vi.mock('../components/Editor', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="mock-editor">{content.slice(0, 50)}</div>
  ),
}));

// Mock collaboration components
vi.mock('../components/CollabPresence', () => ({ default: () => null }));
vi.mock('../components/CollabChat', () => ({ default: () => null }));
vi.mock('../components/CollabHistory', () => ({ default: () => null }));
vi.mock('../components/PageSetupDialog', () => ({ default: () => null }));
vi.mock('../components/WatermarkDialog', () => ({
  default: () => null,
  __esModule: true,
}));

import DocumentEditor from '../components/DocumentEditor';

describe('DocumentEditor', () => {
  const defaultProps = {
    activeFile: { path: 'docs/test.md', content: '# Hello', lastModified: new Date().toISOString() },
    content: '# Hello\n\nThis is a test document.',
    onChange: vi.fn(),
    onTitleChange: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<DocumentEditor {...defaultProps} />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });

  it('renders with empty content', () => {
    render(<DocumentEditor {...defaultProps} content="" />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });

  it('renders empty state with no active file', () => {
    render(<DocumentEditor {...defaultProps} activeFile={null} />);
    expect(screen.getByText('Start a new document')).toBeInTheDocument();
  });

  it('renders with pageless mode', () => {
    render(<DocumentEditor {...defaultProps} pageless />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });

  it('renders with margin override', () => {
    render(<DocumentEditor {...defaultProps} marginOverride={{ left: 100, right: 100 }} />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });

  it('passes content to editor', () => {
    render(<DocumentEditor {...defaultProps} content="# Test Content" />);
    expect(screen.getByTestId('mock-editor')).toHaveTextContent('# Test Content');
  });

  it('renders with frontmatter content', () => {
    const contentWithFrontmatter = '---\ntitle: My Doc\nauthor: Test\n---\n# Hello World';
    render(<DocumentEditor {...defaultProps} content={contentWithFrontmatter} />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });
});
