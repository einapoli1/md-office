import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuBar from '../components/MenuBar';
import { I18nProvider } from '../lib/i18n';

function renderMenuBar(overrides = {}) {
  const defaultProps = {
    onNewFile: vi.fn(),
    onNewSpreadsheet: vi.fn(),
    onNewPresentation: vi.fn(),
    onTemplateSelect: vi.fn(),
    onPrint: vi.fn(),
    saveStatus: 'saved' as const,
    ...overrides,
  };

  return render(
    <I18nProvider>
      <MenuBar {...defaultProps} />
    </I18nProvider>
  );
}

describe('MenuBar', () => {
  it('renders without crashing', () => {
    renderMenuBar();
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('renders main menu items', () => {
    renderMenuBar();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('shows saving status', () => {
    renderMenuBar({ saveStatus: 'saving' });
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows saved status', () => {
    renderMenuBar({ saveStatus: 'saved' });
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('shows unsaved status', () => {
    renderMenuBar({ saveStatus: 'unsaved' });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('opens File menu on click and shows menu items', () => {
    renderMenuBar();
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText(/new document/i)).toBeInTheDocument();
  });

  it('renders for different app modes', () => {
    for (const mode of ['docs', 'sheets', 'slides'] as const) {
      const { unmount } = renderMenuBar({ appMode: mode });
      expect(screen.getByText('File')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders new document quick action button', () => {
    renderMenuBar();
    expect(screen.getByTitle('New document')).toBeInTheDocument();
  });
});
