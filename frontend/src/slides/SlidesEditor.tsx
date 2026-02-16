import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Presentation, Slide, SlideLayout, TransitionType, TransitionDuration, FragmentType, SlideShape,
  parsePresentation, serializePresentation, createSlide,
  UndoStack, pushUndo, undo, redo, parseFragments,
} from './slideModel';
import { getTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';
import SlideThumbnails from './SlideThumbnails';
import SlideToolbar from './SlideToolbar';
import SlideshowView from './SlideshowView';
import { openPresenterWindow } from './PresenterView';
import { TEMPLATES, createFromTemplate } from './slideTemplates';
import type { ShapeType } from './ShapeTools';
import { exportSlidesPDF, exportSlidesHTML, exportPPTX, importPPTX } from './slideIO';
import SlideCommentsComponent, { CommentPins } from './SlideComments';
import type { SlideComment } from './SlideComments';
import RehearsalMode from './RehearsalMode';
import type { SlideTimings } from './RehearsalMode';
import SlideMaster from './SlideMaster';
import SlideShortcuts from './SlideShortcuts';
import SlideStatusBar from './SlideStatusBar';
import { InsertVideoDialog, VideoPlaceholder, type VideoEmbedData } from './VideoEmbed';
import { AudioNarrationDialog, type AudioNarrationData } from './AudioNarration';
import { InsertInteractiveDialog, InteractiveElementEditor, type InteractiveElement } from './InteractiveElements';
import SlideNotes from './SlideNotes';
import PresenterCoach from './PresenterCoach';
import SlideSorter from './SlideSorter';
import DesignIdeas from './DesignIdeas';
import SlideSize from './SlideSize';
import PhotoAlbum from './PhotoAlbum';
import SpeakerCoach from './SpeakerCoach';
import AudienceQA from './AudienceQA';
import {
  initSlideCollab, syncPresentationFromYjs, updateSlideFieldInYjs,
  addSlideInYjs, deleteSlideInYjs, reorderSlideInYjs, updatePresMetaInYjs,
  setLocalSlideAwareness, syncMasterFromYjs, syncMasterToYjs, observeMaster,
  DEFAULT_MASTER,
  type SlideCollabHandle, type RemoteSlideUser, type SlideMasterData,
} from './slideCollab';
import CollabPresence from '../components/CollabPresence';
import { aiGenerateSlides, isAIConfigured } from '../lib/aiProvider';
import './slides-styles.css';

interface CollabConfig {
  serverUrl: string;
  documentName: string;
  userName: string;
}

interface Props {
  content: string;
  onChange: (content: string) => void;
  filePath: string;
  collab?: CollabConfig;
}

export default function SlidesEditor({ content, onChange, filePath: _filePath, collab }: Props) {
  const [pres, setPres] = useState<Presentation>(() => parsePresentation(content));
  const [activeIdx, setActiveIdx] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoStack>({ past: [], future: [] });
  const [slideshow, setSlideshow] = useState(false);
  const [activeShapeTool, setActiveShapeTool] = useState<ShapeType | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteSlideUser[]>([]);
  const [showMasterEditor, setShowMasterEditor] = useState(false);
  const [master, setMaster] = useState<SlideMasterData>({ ...DEFAULT_MASTER });
  const [showComments, setShowComments] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [notesHeight] = useState(120);
  const notesDragRef = useRef(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);
  const [videos, setVideos] = useState<Record<string, VideoEmbedData[]>>({});
  const [narrations, setNarrations] = useState<Record<string, AudioNarrationData>>({});
  const [interactiveElements, setInteractiveElements] = useState<Record<string, InteractiveElement[]>>({});
  const [showPresenterCoach, setShowPresenterCoach] = useState(false);
  const [showSlideSorter, setShowSlideSorter] = useState(false);
  const [showDesignIdeas, setShowDesignIdeas] = useState(false);
  const [showSlideSize, setShowSlideSize] = useState(false);
  const [showPhotoAlbum, setShowPhotoAlbum] = useState(false);
  const [showSpeakerCoach, setShowSpeakerCoach] = useState(false);
  const [showQASession, setShowQASession] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiOutline, setAIOutline] = useState('');
  const [aiGenerating, setAIGenerating] = useState(false);
  const [savedTimings, setSavedTimings] = useState<import('./RehearsalMode').SlideTimings | undefined>(undefined);

  const collabRef = useRef<SlideCollabHandle | null>(null);
  const suppressRemoteRef = useRef(false);

  // ── Collab init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!collab) return;

    const handle = initSlideCollab(
      collab.documentName,
      collab.serverUrl,
      collab.userName,
      pres,
      // onSlidesChanged
      () => {
        if (suppressRemoteRef.current) return;
        const newPres = syncPresentationFromYjs(handle.ydoc);
        setPres(newPres);
        onChange(serializePresentation(newPres));
      },
      // onMetaChanged
      () => {
        if (suppressRemoteRef.current) return;
        const newPres = syncPresentationFromYjs(handle.ydoc);
        setPres(newPres);
        onChange(serializePresentation(newPres));
      },
      // onUsersChanged
      (users) => setRemoteUsers(users),
    );

    collabRef.current = handle;

    // Sync master from Yjs
    const masterFromYjs = syncMasterFromYjs(handle.ydoc);
    if (masterFromYjs.fontFamily !== DEFAULT_MASTER.fontFamily || masterFromYjs.backgroundColor !== DEFAULT_MASTER.backgroundColor) {
      setMaster(masterFromYjs);
    }
    const unobserveMaster = observeMaster(handle.ydoc, () => {
      setMaster(syncMasterFromYjs(handle.ydoc));
    });

    return () => {
      unobserveMaster();
      handle.destroy();
      collabRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab?.serverUrl, collab?.documentName, collab?.userName]);

  // ── Broadcast active slide awareness ───────────────────────────────────
  useEffect(() => {
    if (collab && collabRef.current) {
      setLocalSlideAwareness(collabRef.current.provider, collab.userName, activeIdx);
    }
  }, [activeIdx, collab]);

  // ── Non-collab content sync ────────────────────────────────────────────
  useEffect(() => {
    if (collab) return; // collab handles its own sync
    const parsed = parsePresentation(content);
    setPres(parsed);
    setActiveIdx(i => Math.min(i, parsed.slides.length - 1));
  }, [content, collab]);

  const theme = getTheme(pres.meta.theme);
  const currentSlide = pres.slides[activeIdx];

  // ── Helpers for collab-aware updates ───────────────────────────────────
  const update = useCallback((slides: Slide[], meta?: typeof pres.meta) => {
    const newPres = { meta: meta || pres.meta, slides };
    setPres(newPres);
    onChange(serializePresentation(newPres));
  }, [pres.meta, onChange]);

  const withUndo = useCallback((fn: (slides: Slide[]) => Slide[]) => {
    setUndoStack(s => pushUndo(s, pres.slides));
    const newSlides = fn(pres.slides);
    update(newSlides);
  }, [pres.slides, update]);

  const handleContentChange = useCallback((newContent: string) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, content: newContent, fragments: parseFragments(newContent) } : s));
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'content', newContent);
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'fragments', parseFragments(newContent));
      suppressRemoteRef.current = false;
    }
  }, [activeIdx, withUndo]);

  const handleNotesChange = useCallback((notes: string) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, notes } : s));
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'notes', notes);
      suppressRemoteRef.current = false;
    }
  }, [activeIdx, withUndo]);

  const handleReorder = useCallback((from: number, to: number) => {
    withUndo(slides => {
      const arr = [...slides];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setActiveIdx(to);
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      reorderSlideInYjs(collabRef.current.ydoc, from, to);
      suppressRemoteRef.current = false;
    }
  }, [withUndo]);

  const handleAddSlide = useCallback((atIndex: number, layout: SlideLayout = 'content') => {
    const newSlide = createSlide(layout);
    withUndo(slides => {
      const arr = [...slides];
      arr.splice(atIndex, 0, newSlide);
      return arr;
    });
    setActiveIdx(atIndex);
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      addSlideInYjs(collabRef.current.ydoc, newSlide, atIndex);
      suppressRemoteRef.current = false;
    }
  }, [withUndo]);

  const handleDuplicate = useCallback((idx: number) => {
    const duped = { ...pres.slides[idx], id: `slide-${Date.now()}` };
    withUndo(slides => {
      const arr = [...slides];
      arr.splice(idx + 1, 0, duped);
      return arr;
    });
    setActiveIdx(idx + 1);
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      addSlideInYjs(collabRef.current.ydoc, duped, idx + 1);
      suppressRemoteRef.current = false;
    }
  }, [pres.slides, withUndo]);

  const handleDelete = useCallback((idx: number) => {
    if (pres.slides.length <= 1) return;
    withUndo(slides => slides.filter((_, i) => i !== idx));
    setActiveIdx(i => Math.min(i, pres.slides.length - 2));
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      deleteSlideInYjs(collabRef.current.ydoc, idx);
      suppressRemoteRef.current = false;
    }
  }, [pres.slides.length, withUndo]);

  const handleLayoutChange = useCallback((layout: SlideLayout) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, layout } : s));
    if (collabRef.current) {
      suppressRemoteRef.current = true;
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'layout', layout);
      suppressRemoteRef.current = false;
    }
  }, [activeIdx, withUndo]);

  const handleThemeChange = useCallback((id: string) => {
    const meta = { ...pres.meta, theme: id };
    update(pres.slides, meta);
    if (collabRef.current) {
      updatePresMetaInYjs(collabRef.current.ydoc, 'theme', id);
    }
  }, [pres, update]);

  const handleTransitionChange = useCallback((t: TransitionType) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, transition: t } : s));
    if (collabRef.current) {
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'transition', t);
    }
  }, [activeIdx, withUndo]);

  const handleTransitionDurationChange = useCallback((d: TransitionDuration) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, transitionDuration: d } : s));
    if (collabRef.current) {
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'transitionDuration', d);
    }
  }, [activeIdx, withUndo]);

  const handleShapesChange = useCallback((shapes: SlideShape[]) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, shapes } : s));
    if (collabRef.current) {
      updateSlideFieldInYjs(collabRef.current.ydoc, activeIdx, 'shapes', shapes);
    }
  }, [activeIdx, withUndo]);

  const handleInsertFragment = useCallback((type: FragmentType) => {
    const newContent = currentSlide.content + `\n<!-- fragment: ${type} -->\n`;
    handleContentChange(newContent);
  }, [currentSlide, handleContentChange]);

  const handlePreviewAnimation = useCallback(() => {
    setSlideshow(true);
  }, []);

  const handleNewFromTemplate = useCallback((templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const newPres = createFromTemplate(template);
    setPres(newPres);
    setActiveIdx(0);
    onChange(serializePresentation(newPres));
    setUndoStack({ past: [], future: [] });
  }, [onChange]);

  const handleMasterChange = useCallback((newMaster: SlideMasterData) => {
    setMaster(newMaster);
    if (collabRef.current) {
      syncMasterToYjs(collabRef.current.ydoc, newMaster);
    }
  }, []);

  const handleCommentsChange = useCallback((comments: SlideComment[]) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, comments } : s));
  }, [activeIdx, withUndo]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!commentMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const text = prompt('Add comment:');
    if (!text?.trim()) return;
    const comment: SlideComment = {
      id: `comment-${Date.now()}`,
      x, y,
      author: collab?.userName || 'User',
      text: text.trim(),
      timestamp: Date.now(),
      replies: [],
      resolved: false,
    };
    handleCommentsChange([...(currentSlide?.comments || []), comment]);
    setCommentMode(false);
  }, [commentMode, collab, currentSlide, handleCommentsChange]);

  // Video/Audio/Interactive handlers
  const handleInsertVideo = useCallback((video: VideoEmbedData) => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setVideos(prev => ({ ...prev, [slideId]: [...(prev[slideId] || []), video] }));
    setShowVideoDialog(false);
  }, [currentSlide]);

  const handleRemoveVideo = useCallback((videoId: string) => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setVideos(prev => ({ ...prev, [slideId]: (prev[slideId] || []).filter(v => v.id !== videoId) }));
  }, [currentSlide]);

  const handleUpdateVideo = useCallback((video: VideoEmbedData) => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setVideos(prev => ({ ...prev, [slideId]: (prev[slideId] || []).map(v => v.id === video.id ? video : v) }));
  }, [currentSlide]);

  const handleSaveNarration = useCallback((data: AudioNarrationData) => {
    setNarrations(prev => ({ ...prev, [data.slideId]: data }));
    setShowAudioDialog(false);
  }, []);

  const handleRemoveNarration = useCallback(() => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setNarrations(prev => { const n = { ...prev }; delete n[slideId]; return n; });
    setShowAudioDialog(false);
  }, [currentSlide]);

  const handleInsertInteractive = useCallback((element: InteractiveElement) => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setInteractiveElements(prev => ({ ...prev, [slideId]: [...(prev[slideId] || []), element] }));
    setShowInteractiveDialog(false);
  }, [currentSlide]);

  const handleRemoveInteractive = useCallback((elementId: string) => {
    const slideId = currentSlide?.id;
    if (!slideId) return;
    setInteractiveElements(prev => ({ ...prev, [slideId]: (prev[slideId] || []).filter(e => e.id !== elementId) }));
  }, [currentSlide]);

  // Listen for menu bar events
  useEffect(() => {
    const onInsertVideo = () => setShowVideoDialog(true);
    const onInsertAudio = () => setShowAudioDialog(true);
    const onInsertInteractive = () => setShowInteractiveDialog(true);
    const onPresenterCoach = () => setShowPresenterCoach(true);
    const onSlideSorter = () => setShowSlideSorter(true);
    const onDesignIdeas = () => setShowDesignIdeas(true);
    const onSlideSize = () => setShowSlideSize(true);
    const onPhotoAlbum = () => setShowPhotoAlbum(true);
    window.addEventListener('slide-insert-video', onInsertVideo);
    window.addEventListener('slide-insert-audio', onInsertAudio);
    window.addEventListener('slide-insert-interactive', onInsertInteractive);
    window.addEventListener('slide-presenter-coach', onPresenterCoach);
    window.addEventListener('slide-sorter', onSlideSorter);
    window.addEventListener('slide-design-ideas', onDesignIdeas);
    window.addEventListener('slide-size', onSlideSize);
    window.addEventListener('slide-photo-album', onPhotoAlbum);
    return () => {
      window.removeEventListener('slide-insert-video', onInsertVideo);
      window.removeEventListener('slide-insert-audio', onInsertAudio);
      window.removeEventListener('slide-insert-interactive', onInsertInteractive);
      window.removeEventListener('slide-presenter-coach', onPresenterCoach);
      window.removeEventListener('slide-sorter', onSlideSorter);
      window.removeEventListener('slide-design-ideas', onDesignIdeas);
      window.removeEventListener('slide-size', onSlideSize);
      window.removeEventListener('slide-photo-album', onPhotoAlbum);
    };
  }, []);

  const handleSaveTimings = useCallback((timings: SlideTimings) => {
    const newSlides = pres.slides.map((s, i) => ({ ...s, timingMs: timings.perSlide[i] || 0 }));
    update(newSlides);
    setAutoAdvance(true);
    setRehearsalMode(false);
    setSavedTimings(timings);
  }, [pres.slides, update]);

  // notesHeight and notesDragRef kept for compatibility
  void notesHeight; void notesDragRef;

  // Undo / redo keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const result = undo(undoStack, pres.slides);
        if (result) { setUndoStack(result.stack); update(result.slides); }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        const result = redo(undoStack, pres.slides);
        if (result) { setUndoStack(result.stack); update(result.slides); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, pres.slides, update]);

  const wrapSelection = useCallback((wrapper: string) => {
    handleContentChange(currentSlide.content + `\n${wrapper}text${wrapper}`);
  }, [currentSlide, handleContentChange]);

  const handleExportPDF = useCallback(() => exportSlidesPDF(), []);
  const handleExportHTML = useCallback(() => {
    const html = exportSlidesHTML(pres.slides, theme);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pres.meta.title || 'presentation'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pres, theme]);

  const handleExportPPTX = useCallback(() => {
    exportPPTX(pres.slides, theme);
  }, [pres, theme]);

  const handleImportPPTX = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pptx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = await importPPTX(file);
        setPres(prev => ({ ...prev, slides: imported }));
        setActiveIdx(0);
      } catch (err) {
        console.error('Failed to import PPTX:', err);
        alert('Failed to import PPTX file.');
      }
    };
    input.click();
  }, []);

  const handleDesignApply = useCallback((layout: import('./slideModel').SlideLayout, content: string) => {
    const newSlides = [...pres.slides];
    newSlides[activeIdx] = { ...newSlides[activeIdx], layout, content };
    update(newSlides);
    setShowDesignIdeas(false);
  }, [pres.slides, activeIdx, update]);

  const handleSlideSizeApply = useCallback((aspectRatio: string, _width: number, _height: number, _scaleContent: boolean) => {
    const newPres = { ...pres, meta: { ...pres.meta, aspectRatio } };
    setPres(newPres);
    onChange(serializePresentation(newPres));
    setShowSlideSize(false);
  }, [pres, onChange]);

  const handlePhotoAlbumInsert = useCallback((newSlides: Slide[]) => {
    const allSlides = [...pres.slides, ...newSlides];
    update(allSlides);
    setShowPhotoAlbum(false);
  }, [pres.slides, update]);

  // @ts-ignore
  const startPresentation = useCallback(() => setSlideshow(true), []);
  const openPresenter = useCallback(() => {
    openPresenterWindow(pres.slides, theme, activeIdx);
    setSlideshow(true);
  }, [pres.slides, theme, activeIdx]);

  // Compute which remote users are on each slide
  const usersBySlide = new Map<number, RemoteSlideUser[]>();
  for (const u of remoteUsers) {
    const arr = usersBySlide.get(u.activeSlide) || [];
    arr.push(u);
    usersBySlide.set(u.activeSlide, arr);
  }

  if (rehearsalMode) {
    return <RehearsalMode slides={pres.slides} theme={theme} onExit={() => setRehearsalMode(false)} onSaveTimings={handleSaveTimings} />;
  }

  if (slideshow) {
    return <SlideshowView slides={pres.slides} theme={theme} startIndex={activeIdx} onExit={() => setSlideshow(false)} autoAdvance={autoAdvance} />;
  }

  return (
    <div className="slides-editor">
      <SlideToolbar
        currentTheme={pres.meta.theme}
        currentLayout={currentSlide?.layout || 'content'}
        currentTransition={currentSlide?.transition || 'none'}
        currentTransitionDuration={currentSlide?.transitionDuration || '0.3s'}
        onThemeChange={handleThemeChange}
        onLayoutChange={handleLayoutChange}
        onTransitionChange={handleTransitionChange}
        onTransitionDurationChange={handleTransitionDurationChange}
        onAddSlide={(layout) => handleAddSlide(activeIdx + 1, layout)}
        onPresent={openPresenter}
        onBold={() => wrapSelection('**')}
        onItalic={() => wrapSelection('*')}
        onShapeToolSelect={setActiveShapeTool}
        activeShapeTool={activeShapeTool}
        onInsertFragment={handleInsertFragment}
        onPreviewAnimation={handlePreviewAnimation}
        onNewFromTemplate={handleNewFromTemplate}
        onExportPDF={handleExportPDF}
        onExportHTML={handleExportHTML}
        onExportPPTX={handleExportPPTX}
        onImportPPTX={handleImportPPTX}
        onInsertVideo={() => setShowVideoDialog(true)}
        onInsertAudio={() => setShowAudioDialog(true)}
        onInsertInteractive={() => setShowInteractiveDialog(true)}
        onDesignIdeas={() => setShowDesignIdeas(true)}
        onSlideSorter={() => setShowSlideSorter(true)}
        onRehearse={() => setShowSpeakerCoach(true)}
        onQASession={() => setShowQASession(true)}
      />

      <div className="slides-collab-bar">
        {collab && collabRef.current && (
          <CollabPresence provider={collabRef.current.provider} currentUser={collab.userName} />
        )}
        <button className="btn-secondary btn-sm" onClick={() => setShowMasterEditor(true)}>
          Master Slides
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setShowAIGenerate(true)}>
          ✨ AI Generate
        </button>
        <button className={`btn-secondary btn-sm ${showComments ? 'btn-active' : ''}`} onClick={() => setShowComments(!showComments)}>
          💬 Comments
        </button>
        <button className={`btn-secondary btn-sm ${commentMode ? 'btn-active' : ''}`} onClick={() => { setCommentMode(!commentMode); setShowComments(true); }}>
          📌 Add Comment
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setRehearsalMode(true)}>
          ⏱ Rehearse
        </button>
        <label className="auto-advance-toggle">
          <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />
          Auto-advance
        </label>
      </div>

      <div className="slides-main">
        <SlideThumbnails
          slides={pres.slides}
          activeIndex={activeIdx}
          theme={theme}
          onSelect={setActiveIdx}
          onReorder={handleReorder}
          onAddSlide={(idx) => handleAddSlide(idx)}
          onDuplicateSlide={handleDuplicate}
          onDeleteSlide={handleDelete}
          remoteUsers={remoteUsers}
        />

        <div className="slides-center">
          <div className="slide-canvas-wrapper" onClick={handleCanvasClick} style={commentMode ? { cursor: 'crosshair' } : undefined}>
            {currentSlide && (
              <>
                <SlideCanvas
                  slide={currentSlide}
                  theme={theme}
                  editable
                  onContentChange={handleContentChange}
                  drawingTool={activeShapeTool}
                  onShapesChange={handleShapesChange}
                  onDrawEnd={() => setActiveShapeTool(null)}
                />
                {showComments && (
                  <CommentPins
                    comments={currentSlide.comments || []}
                    onPinClick={() => setShowComments(true)}
                    showResolved={false}
                  />
                )}
                {(videos[currentSlide.id] || []).map(v => (
                  <VideoPlaceholder key={v.id} video={v} onRemove={handleRemoveVideo} onUpdate={handleUpdateVideo} />
                ))}
                {(interactiveElements[currentSlide.id] || []).map(el => (
                  <InteractiveElementEditor key={el.id} element={el} onRemove={handleRemoveInteractive} />
                ))}
              </>
            )}
          </div>

          <SlideNotes
            notes={currentSlide?.notes || ''}
            onChange={handleNotesChange}
            slideIndex={activeIdx}
            totalSlides={pres.slides.length}
            allNotes={pres.slides.map((s, i) => ({ slideIndex: i, notes: s.notes }))}
          />
        </div>
      </div>

      {showComments && currentSlide && (
        <SlideCommentsComponent
          comments={currentSlide.comments || []}
          onChange={handleCommentsChange}
          currentUser={collab?.userName || 'User'}
        />
      )}

      {showMasterEditor && (
        <SlideMaster
          master={master}
          onChange={handleMasterChange}
          onClose={() => setShowMasterEditor(false)}
        />
      )}
      <SlideStatusBar
        currentSlide={activeIdx + 1}
        totalSlides={pres.slides.length}
        layoutName={currentSlide?.layout || 'content'}
        notesCharCount={(currentSlide?.notes || '').length}
        collaborationStatus={collab ? (collabRef.current ? 'connected' : 'connecting') : undefined}
        connectedUsers={remoteUsers.length + 1}
      />
      <SlideShortcuts />

      {showVideoDialog && (
        <InsertVideoDialog onInsert={handleInsertVideo} onClose={() => setShowVideoDialog(false)} />
      )}
      {showAudioDialog && currentSlide && (
        <AudioNarrationDialog
          slideId={currentSlide.id}
          existing={narrations[currentSlide.id]}
          onSave={handleSaveNarration}
          onRemove={handleRemoveNarration}
          onClose={() => setShowAudioDialog(false)}
        />
      )}
      {showInteractiveDialog && (
        <InsertInteractiveDialog
          onInsert={handleInsertInteractive}
          onClose={() => setShowInteractiveDialog(false)}
          totalSlides={pres.slides.length}
        />
      )}
      {showPresenterCoach && (
        <PresenterCoach
          presentation={pres}
          timings={savedTimings}
          onUpdateSlides={(slides) => { update(slides); }}
          onClose={() => setShowPresenterCoach(false)}
        />
      )}
      {showSlideSorter && (
        <SlideSorter
          slides={pres.slides}
          theme={theme}
          activeIndex={activeIdx}
          onSelect={setActiveIdx}
          onReorder={handleReorder}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setShowSlideSorter(false)}
        />
      )}
      {showDesignIdeas && currentSlide && (
        <DesignIdeas
          slide={currentSlide}
          onApply={handleDesignApply}
          onClose={() => setShowDesignIdeas(false)}
        />
      )}
      {showSlideSize && (
        <SlideSize
          currentAspectRatio={pres.meta.aspectRatio}
          onApply={handleSlideSizeApply}
          onClose={() => setShowSlideSize(false)}
        />
      )}
      {showPhotoAlbum && (
        <PhotoAlbum
          onInsertSlides={handlePhotoAlbumInsert}
          onClose={() => setShowPhotoAlbum(false)}
        />
      )}
      {showSpeakerCoach && (
        <SpeakerCoach
          slides={pres.slides}
          currentSlideIndex={activeIdx}
          onClose={() => setShowSpeakerCoach(false)}
        />
      )}
      {showQASession && (
        <AudienceQA
          slides={pres.slides}
          currentSlideIndex={activeIdx}
          onClose={() => setShowQASession(false)}
        />
      )}
      {showAIGenerate && (
        <div className="slide-modal-overlay" onClick={() => setShowAIGenerate(false)}>
          <div className="slide-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h3>Generate Slides from Outline</h3>
            <p style={{ fontSize: 13, color: '#aaa', margin: '8px 0' }}>
              Paste bullet points or an outline below and AI will generate a slide deck.
            </p>
            <textarea
              style={{ width: '100%', minHeight: 150, background: '#2d2d2d', color: '#eee', border: '1px solid #555', borderRadius: 4, padding: 8, fontSize: 13, resize: 'vertical' }}
              placeholder={'- Introduction to our product\n- Key features\n  - Fast\n  - Reliable\n  - Affordable\n- Pricing\n- Q&A'}
              value={aiOutline}
              onChange={e => setAIOutline(e.target.value)}
              disabled={aiGenerating}
            />
            {!isAIConfigured() && (
              <div style={{ fontSize: 11, color: '#888', margin: '6px 0' }}>
                ⚠️ Configure your AI API key in Docs → AI Assistant → Settings first.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => setShowAIGenerate(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!aiOutline.trim() || aiGenerating || !isAIConfigured()}
                onClick={async () => {
                  setAIGenerating(true);
                  try {
                    const result = await aiGenerateSlides(aiOutline);
                    const slides: Array<{ title: string; bullets: string[]; notes?: string }> = JSON.parse(result);
                    const newPres = { ...pres };
                    for (const s of slides) {
                      const slide = createSlide('content');
                      const bullets = s.bullets.map((b: string) => `- ${b}`).join('\n');
                      slide.content = `# ${s.title}\n\n${bullets}`;
                      if (s.notes) slide.notes = s.notes;
                      newPres.slides.push(slide);
                    }
                    setPres(newPres);
                    onChange(serializePresentation(newPres));
                    setShowAIGenerate(false);
                    setAIOutline('');
                  } catch (err) {
                    console.error('AI slide generation failed:', err);
                    alert('Failed to generate slides. Check your AI settings and try again.');
                  }
                  setAIGenerating(false);
                }}
              >
                {aiGenerating ? 'Generating...' : 'Generate Slides'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
