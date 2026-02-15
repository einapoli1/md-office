import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmojiPicker from '../EmojiPicker';

describe('EmojiPicker', () => {
  it('renders with search input', () => {
    render(<EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search emojis...')).toBeInTheDocument();
  });

  it('shows category buttons', () => {
    render(<EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    // Category buttons use first letter: S(mileys), P(eople), A(nimals), etc.
    const buttons = screen.getAllByRole('button');
    // Should have many emoji buttons + category buttons + close
    expect(buttons.length).toBeGreaterThan(10);
  });

  it('switches categories when clicking category button', () => {
    render(<EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    // Click "Food" category (letter F)
    const foodBtn = screen.getByTitle('Food');
    fireEvent.click(foodBtn);
    expect(foodBtn).toHaveClass('active');
  });

  it('calls onSelect when emoji clicked', () => {
    const onSelect = vi.fn();
    render(<EmojiPicker onSelect={onSelect} onClose={vi.fn()} />);
    // Click the first emoji button (😀)
    const emojiButtons = screen.getAllByRole('button').filter(b => b.classList.contains('emoji-picker-item'));
    fireEvent.click(emojiButtons[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.any(String));
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<EmojiPicker onSelect={vi.fn()} onClose={onClose} />);
    // The X close button
    // Find the close button by class
    const closeBtns = document.querySelectorAll('.emoji-picker-close');
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
