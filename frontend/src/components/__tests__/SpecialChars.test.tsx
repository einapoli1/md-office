import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpecialChars from '../SpecialChars';

describe('SpecialChars', () => {
  it('renders with title and search', () => {
    render(<SpecialChars onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Special Characters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search characters...')).toBeInTheDocument();
  });

  it('shows category buttons', () => {
    render(<SpecialChars onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Arrows')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Greek')).toBeInTheDocument();
  });

  it('switches categories', () => {
    render(<SpecialChars onSelect={vi.fn()} onClose={vi.fn()} />);
    const mathBtn = screen.getByText('Math');
    fireEvent.click(mathBtn);
    expect(mathBtn).toHaveClass('active');
    // Math chars should include ±
    expect(screen.getByText('±')).toBeInTheDocument();
  });

  it('calls onSelect when character clicked', () => {
    const onSelect = vi.fn();
    render(<SpecialChars onSelect={onSelect} onClose={vi.fn()} />);
    // Default category is arrows, click first arrow ←
    fireEvent.click(screen.getByText('←'));
    expect(onSelect).toHaveBeenCalledWith('←');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SpecialChars onSelect={vi.fn()} onClose={onClose} />);
    const closeBtn = document.querySelector('.special-chars-close');
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });
});
