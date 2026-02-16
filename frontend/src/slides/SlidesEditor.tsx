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
import { exportSlidesPDF, exportSlidesHTML } from './slideIO';
import SlideMaster from './SlideMaster';
import {
  initSlideCollab, syncPresentationFromYjs, updateSlideFieldInYjs,
  addSlideInYjs, deleteSlideInYjs, reorderSlideInYjs, updatePresMetaInYjs,
  setLocalSlideAwareness, syncMasterFromYjs, syncMasterToYjs, observeMaster,
  DEFAULT_MASTER,
  type SlideCollabHandle, type RemoteSlideUser, type SlideMasterData,
} from './slideCollab';
import CollabPresence from '../components/CollabPresence';
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

  if (slideshow) {
    return <SlideshowView slides={pres.slides} theme={theme} startIndex={activeIdx} onExit={() => setSlideshow(false)} />;
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
      />

      {collab && collabRef.current && (
        <div className="slides-collab-bar">
          <CollabPresence provider={collabRef.current.provider} currentUser={collab.userName} />
          <button className="btn-secondary btn-sm" onClick={() => setShowMasterEditor(true)}>
            Master Slides
          </button>
        </div>
      )}

      {!collab && (
        <div className="slides-collab-bar">
          <button className="btn-secondary btn-sm" onClick={() => setShowMasterEditor(true)}>
            Master Slides
          </button>
        </div>
      )}

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
          <div className="slide-canvas-wrapper">
            {currentSlide && (
              <SlideCanvas
                slide={currentSlide}
                theme={theme}
                editable
                onContentChange={handleContentChange}
                drawingTool={activeShapeTool}
                onShapesChange={handleShapesChange}
                onDrawEnd={() => setActiveShapeTool(null)}
              />
            )}
          </div>

          <div className="slide-notes-area">
            <label>Speaker Notes</label>
            <textarea
              className="slide-notes-input"
              value={currentSlide?.notes || ''}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Click to add speaker notes..."
            />
          </div>
        </div>
      </div>

      {showMasterEditor && (
        <SlideMaster
          master={master}
          onChange={handleMasterChange}
          onClose={() => setShowMasterEditor(false)}
        />
      )}
    </div>
  );
}
