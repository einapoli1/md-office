import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBar from '../StatusBar';

describe('StatusBar', () => {
  const defaultProps = {
    content: 'Hello world this is test content',
    saveStatus: 'saved' as const,
  };

  it('renders word count', () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByText(/words/)).toBeInTheDocument();
  });

  it('renders character count', () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByText(/characters/)).toBeInTheDocument();
  });

  it('shows save status', () => {
    render(<StatusBar {...defaultProps} saveStatus="saving" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows unsaved changes status', () => {
    render(<StatusBar {...defaultProps} saveStatus="unsaved" />);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom level')).toBeInTheDocument();
  });

  it('zoom in changes zoom level', () => {
    const onZoomChange = vi.fn();
    render(<StatusBar {...defaultProps} onZoomChange={onZoomChange} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(onZoomChange).toHaveBeenCalledWith(110);
  });

  it('zoom out changes zoom level', () => {
    const onZoomChange = vi.fn();
    render(<StatusBar {...defaultProps} onZoomChange={onZoomChange} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(onZoomChange).toHaveBeenCalledWith(90);
  });

  it('shows active file name', () => {
    render(<StatusBar {...defaultProps} activeFile="docs/readme.md" />);
    expect(screen.getByText('readme')).toBeInTheDocument();
  });

  it('shows guest mode indicator', () => {
    render(<StatusBar {...defaultProps} isGuestMode />);
    expect(screen.getByText('(Local)')).toBeInTheDocument();
  });

  it('shows collaboration status', () => {
    render(<StatusBar {...defaultProps} collaborationStatus="connected" connectedUsers={3} />);
    expect(screen.getByText('3 editing')).toBeInTheDocument();
  });
});
