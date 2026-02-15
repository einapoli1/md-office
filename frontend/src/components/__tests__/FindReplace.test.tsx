import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FindReplace from '../FindReplace';

function createMockEditor(text = 'Hello world foo bar') {
  const doc = {
    descendants: (cb: (node: any, pos: number) => void) => {
      cb({ isText: true, text }, 0);
    },
  };
  return {
    state: { doc, tr: { insertText: vi.fn().mockReturnThis() } },
    view: { dispatch: vi.fn() },
    commands: {
      setTextSelection: vi.fn(),
      scrollIntoView: vi.fn(),
    },
    getAttributes: vi.fn(),
  };
}

describe('FindReplace', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders search input', () => {
    const editor = createMockEditor();
    render(<FindReplace editor={editor} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Find')).toBeInTheDocument();
  });

  it('shows match count when searching', async () => {
    const editor = createMockEditor('hello hello hello');
    render(<FindReplace editor={editor} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Find');
    await userEvent.type(input, 'hello');

    await waitFor(() => {
      expect(screen.getByText(/of 3/)).toBeInTheDocument();
    });
  });

  it('shows 0 matches for non-existent text', async () => {
    const editor = createMockEditor('hello world');
    render(<FindReplace editor={editor} onClose={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('Find'), 'xyz');

    await waitFor(() => {
      expect(screen.getByText(/0 of 0/)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<FindReplace editor={createMockEditor()} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close (Esc)'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows replace row when showReplace is true', () => {
    render(<FindReplace editor={createMockEditor()} onClose={vi.fn()} showReplace />);
    expect(screen.getByPlaceholderText('Replace with')).toBeInTheDocument();
  });

  it('toggles replace row', async () => {
    render(<FindReplace editor={createMockEditor()} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Replace with')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Toggle replace (Cmd+H)'));
    expect(screen.getByPlaceholderText('Replace with')).toBeInTheDocument();
  });
});
