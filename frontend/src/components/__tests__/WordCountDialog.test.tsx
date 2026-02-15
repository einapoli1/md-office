import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WordCountDialog from '../WordCountDialog';

describe('WordCountDialog', () => {
  it('renders word count stats', () => {
    render(<WordCountDialog content="Hello world this is a test" onClose={vi.fn()} />);
    expect(screen.getByText('Word count')).toBeInTheDocument();
    expect(screen.getByText('Words')).toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('counts words correctly', () => {
    render(<WordCountDialog content="one two three four five" onClose={vi.fn()} />);
    // 5 words
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('counts characters correctly', () => {
    render(<WordCountDialog content="abc" onClose={vi.fn()} />);
    // 3 characters, 3 without spaces
    const values = screen.getAllByText('3');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });

  it('calculates reading time', () => {
    // 200 words = 1 min reading time
    const words = Array(200).fill('word').join(' ');
    render(<WordCountDialog content={words} onClose={vi.fn()} />);
    expect(screen.getByText('1 min')).toBeInTheDocument();
  });

  it('calls onClose when OK button clicked', () => {
    const onClose = vi.fn();
    render(<WordCountDialog content="test" onClose={onClose} />);
    fireEvent.click(screen.getByText('OK'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(<WordCountDialog content="test" onClose={onClose} />);
    fireEvent.click(document.querySelector('.dialog-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });
});
