import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock API utilities to prevent network calls
vi.mock('../utils/api', () => ({
  fileAPI: {
    list: vi.fn().mockResolvedValue([]),
    read: vi.fn().mockResolvedValue({ content: '', lastModified: '' }),
    write: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  },
  gitAPI: {
    log: vi.fn().mockResolvedValue([]),
    status: vi.fn().mockResolvedValue({ files: [] }),
    diff: vi.fn().mockResolvedValue(''),
    branches: vi.fn().mockResolvedValue([]),
  },
  authAPI: {
    verify: vi.fn().mockResolvedValue({ valid: false }),
    login: vi.fn().mockResolvedValue({ token: '' }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../utils/localApi', () => ({
  localFileAPI: {
    list: vi.fn().mockReturnValue([]),
    read: vi.fn().mockReturnValue({ content: '', lastModified: '' }),
    write: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
  },
  initializeLocalStorage: vi.fn(),
}));

vi.mock('../utils/gitProviderApi', () => ({
  oauthAPI: { getConnections: vi.fn().mockResolvedValue([]) },
  gitProviderAPI: { getConnections: vi.fn().mockResolvedValue([]) },
}));

// Mock heavy editor components
vi.mock('../components/Editor', () => ({
  default: () => <div data-testid="mock-editor">Editor</div>,
}));

vi.mock('../components/DocumentEditor', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="document-editor">{content?.slice(0, 20)}</div>
  ),
}));

vi.mock('../sheets/SpreadsheetEditor', () => ({
  default: () => <div data-testid="spreadsheet-editor">Spreadsheet</div>,
}));

vi.mock('../slides/SlidesEditor', () => ({
  default: () => <div data-testid="slides-editor">Slides</div>,
}));

vi.mock('../draw/DrawingEditor', () => ({
  default: () => <div data-testid="drawing-editor">Drawing</div>,
}));

vi.mock('../databases/DatabaseEditor', () => ({
  default: () => <div data-testid="database-editor">Database</div>,
}));

// Mock collab / heavy features
vi.mock('../components/CollabPresence', () => ({ default: () => null }));
vi.mock('../components/CollabChat', () => ({ default: () => null }));
vi.mock('../components/CollabHistory', () => ({ default: () => null }));
vi.mock('../components/OnboardingTour', () => ({
  default: () => null,
  STORAGE_KEY: 'md-office-onboarding-done',
}));
vi.mock('../components/OnboardingWizard', () => ({ default: () => null }));
vi.mock('../components/SyncIndicator', () => ({ default: () => null }));
vi.mock('../components/CommandPalette', () => ({ default: () => null }));
vi.mock('../components/ShortcutOverlay', () => ({ default: () => null }));
vi.mock('../components/FocusMode', () => ({ default: () => null }));
vi.mock('../components/ReadingMode', () => ({ default: () => null }));

// Mock lazy-loaded dialogs
vi.mock('../components/TemplateSelector', () => ({ default: () => null }));
vi.mock('../components/WordCountDialog', () => ({ default: () => null }));
vi.mock('../components/ExportDialog', () => ({ default: () => null }));
vi.mock('../components/KeyboardShortcutsDialog', () => ({ default: () => null }));
vi.mock('../components/SpecialChars', () => ({ default: () => null }));
vi.mock('../components/EquationDialog', () => ({ default: () => null }));
vi.mock('../components/Whiteboard', () => ({ default: () => null }));
vi.mock('../components/PageColumns', () => ({ default: () => null }));
vi.mock('../components/CoverPage', () => ({ default: () => null }));
vi.mock('../components/TableOfFigures', () => ({ default: () => null }));
vi.mock('../components/PublishDialog', () => ({ default: () => null }));
vi.mock('../components/EnvelopesLabelsDialog', () => ({ default: () => null }));
vi.mock('../components/PageNumberDialog', () => ({ default: () => null }));
vi.mock('../components/DocumentProtection', () => ({ default: () => null }));

// Mock i18n (wrap in provider)
vi.mock('../lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('../lib/i18n')>('../lib/i18n');
  return actual;
});

// Mock hooks
vi.mock('../hooks/useGitProvider', () => ({
  useGitProvider: () => ({
    connected: false,
    provider: null,
    giteaUrl: '',
    providerUsername: '',
    connections: [],
    syncStatus: null,
    repoConnected: false,
    branch: 'main',
    defaultBranch: 'main',
    loading: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    syncNow: vi.fn(),
    checkStatus: vi.fn(),
  }),
}));

vi.mock('../lib/commandRegistry', () => ({
  commandRegistry: {
    register: vi.fn(),
    execute: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    search: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../lib/shortcutManager', () => ({
  shortcutManager: {
    register: vi.fn(),
    handleKeyDown: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../utils/docxIO', () => ({
  importDocx: vi.fn(),
}));

vi.mock('../utils/pdfImport', () => ({
  importPdf: vi.fn(),
}));

vi.mock('../components/MacroRecorder', () => ({
  default: () => null,
  useMacroRecorder: () => ({
    recording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    actions: [],
  }),
}));

vi.mock('../lib/macroEngine', () => ({
  runMacro: vi.fn(),
  loadSavedMacros: vi.fn().mockReturnValue([]),
  saveMacro: vi.fn(),
}));

import App from '../App';
import { I18nProvider } from '../lib/i18n';

// jsdom does not implement matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mark onboarding as done to skip wizard
    localStorage.setItem('md-office-onboarding-done', 'true');
  });

  it('renders without crashing', () => {
    renderApp();
    // App should render the menu bar with File menu
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('shows RecentDocs landing page when no file is active', () => {
    renderApp();
    // The landing page shows "MD Docs" by default
    expect(screen.getByText('MD Docs')).toBeInTheDocument();
  });

  it('renders the menu bar', () => {
    renderApp();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('renders new document buttons on landing page', () => {
    renderApp();
    expect(screen.getByText('New Document')).toBeInTheDocument();
    expect(screen.getByText('New Spreadsheet')).toBeInTheDocument();
    expect(screen.getByText('New Presentation')).toBeInTheDocument();
  });
});
