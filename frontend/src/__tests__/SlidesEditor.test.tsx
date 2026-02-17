import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock heavy sub-components
vi.mock('../slides/SlideCanvas', () => ({ default: () => <div data-testid="slide-canvas" /> }));
vi.mock('../slides/SlideThumbnails', () => ({ default: () => <div data-testid="slide-thumbnails" /> }));
vi.mock('../slides/SlideToolbar', () => ({ default: () => <div data-testid="slide-toolbar" /> }));
vi.mock('../slides/SlideshowView', () => ({ default: () => null }));
vi.mock('../slides/PresenterView', () => ({ openPresenterWindow: vi.fn() }));
vi.mock('../slides/SlideComments', () => ({
  default: () => null,
  CommentPins: () => null,
}));
vi.mock('../slides/RehearsalMode', () => ({ default: () => null }));
vi.mock('../slides/SlideMaster', () => ({ default: () => null }));
vi.mock('../slides/SlideShortcuts', () => ({ default: () => null }));
vi.mock('../slides/SlideStatusBar', () => ({ default: () => null }));
vi.mock('../slides/VideoEmbed', () => ({
  InsertVideoDialog: () => null,
  VideoPlaceholder: () => null,
}));
vi.mock('../slides/AudioNarration', () => ({
  AudioNarrationDialog: () => null,
}));
vi.mock('../slides/InteractiveElements', () => ({
  InsertInteractiveDialog: () => null,
  InteractiveElementEditor: () => null,
}));
vi.mock('../slides/SlideNotes', () => ({ default: () => null }));
vi.mock('../slides/PresenterCoach', () => ({ default: () => null }));
vi.mock('../slides/SlideSorter', () => ({ default: () => null }));
vi.mock('../slides/DesignIdeas', () => ({ default: () => null }));
vi.mock('../slides/SlideSize', () => ({ default: () => null }));
vi.mock('../slides/PhotoAlbum', () => ({ default: () => null }));
vi.mock('../slides/SpeakerCoach', () => ({ default: () => null }));
vi.mock('../slides/AudienceQA', () => ({ default: () => null }));
vi.mock('../slides/slideCollab', () => ({
  initSlideCollab: vi.fn().mockReturnValue({
    ydoc: {},
    provider: { awareness: { setLocalState: vi.fn() } },
    destroy: vi.fn(),
  }),
  syncPresentationFromYjs: vi.fn().mockReturnValue({ meta: {}, slides: [] }),
  updateSlideFieldInYjs: vi.fn(),
  addSlideInYjs: vi.fn(),
  deleteSlideInYjs: vi.fn(),
  reorderSlideInYjs: vi.fn(),
  updatePresMetaInYjs: vi.fn(),
  setLocalSlideAwareness: vi.fn(),
  syncMasterFromYjs: vi.fn().mockReturnValue({ fontFamily: 'sans-serif', backgroundColor: '#ffffff', titleColor: '#000', bodyColor: '#333' }),
  syncMasterToYjs: vi.fn(),
  observeMaster: vi.fn().mockReturnValue(vi.fn()),
  DEFAULT_MASTER: { backgroundColor: '#ffffff', fontFamily: 'sans-serif', titleColor: '#000', bodyColor: '#333' },
}));
vi.mock('../components/CollabPresence', () => ({ default: () => null }));
vi.mock('../lib/aiProvider', () => ({
  aiGenerateSlides: vi.fn(),
  isAIConfigured: () => false,
}));
vi.mock('../slides/slideIO', () => ({
  exportSlidesPDF: vi.fn(),
  exportSlidesHTML: vi.fn(),
  exportPPTX: vi.fn(),
  importPPTX: vi.fn(),
}));

import SlidesEditor from '../slides/SlidesEditor';

describe('SlidesEditor', () => {
  const minimalSlideContent = '---\ntheme: default\n---\n\n# Slide 1\n\nHello world';

  it('renders without crashing', () => {
    const { container } = render(
      <SlidesEditor content={minimalSlideContent} onChange={vi.fn()} filePath="test.slides.md" />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty content', () => {
    const { container } = render(
      <SlidesEditor content="" onChange={vi.fn()} filePath="test.slides.md" />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with multi-slide content', () => {
    const content = '# Slide 1\n\nFirst slide\n\n---\n\n# Slide 2\n\nSecond slide';
    const { container } = render(
      <SlidesEditor content={content} onChange={vi.fn()} filePath="presentation.slides.md" />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with collab config', () => {
    const { container } = render(
      <SlidesEditor
        content={minimalSlideContent}
        onChange={vi.fn()}
        filePath="test.slides.md"
        collab={{ serverUrl: 'ws://localhost:1234', documentName: 'test', userName: 'Test User' }}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
