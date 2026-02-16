import { useState, useCallback, useEffect } from 'react';
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
import './slides-styles.css';

interface Props {
  content: string;
  onChange: (content: string) => void;
  filePath: string;
}

export default function SlidesEditor({ content, onChange, filePath: _filePath }: Props) {
  const [pres, setPres] = useState<Presentation>(() => parsePresentation(content));
  const [activeIdx, setActiveIdx] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoStack>({ past: [], future: [] });
  const [slideshow, setSlideshow] = useState(false);
  const [activeShapeTool, setActiveShapeTool] = useState<ShapeType | null>(null);

  useEffect(() => {
    const parsed = parsePresentation(content);
    setPres(parsed);
    setActiveIdx(i => Math.min(i, parsed.slides.length - 1));
  }, [content]);

  const theme = getTheme(pres.meta.theme);
  const currentSlide = pres.slides[activeIdx];

  const update = useCallback((slides: Slide[], meta?: typeof pres.meta) => {
    const newPres = { meta: meta || pres.meta, slides };
    setPres(newPres);
    onChange(serializePresentation(newPres));
  }, [pres.meta, onChange]);

  const withUndo = useCallback((fn: (slides: Slide[]) => Slide[]) => {
    setUndoStack(s => pushUndo(s, pres.slides));
    update(fn(pres.slides));
  }, [pres.slides, update]);

  const handleContentChange = useCallback((newContent: string) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, content: newContent, fragments: parseFragments(newContent) } : s));
  }, [activeIdx, withUndo]);

  const handleNotesChange = useCallback((notes: string) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, notes } : s));
  }, [activeIdx, withUndo]);

  const handleReorder = useCallback((from: number, to: number) => {
    withUndo(slides => {
      const arr = [...slides];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setActiveIdx(to);
  }, [withUndo]);

  const handleAddSlide = useCallback((atIndex: number, layout: SlideLayout = 'content') => {
    withUndo(slides => {
      const arr = [...slides];
      arr.splice(atIndex, 0, createSlide(layout));
      return arr;
    });
    setActiveIdx(atIndex);
  }, [withUndo]);

  const handleDuplicate = useCallback((idx: number) => {
    withUndo(slides => {
      const arr = [...slides];
      arr.splice(idx + 1, 0, { ...slides[idx], id: `slide-${Date.now()}` });
      return arr;
    });
    setActiveIdx(idx + 1);
  }, [withUndo]);

  const handleDelete = useCallback((idx: number) => {
    if (pres.slides.length <= 1) return;
    withUndo(slides => slides.filter((_, i) => i !== idx));
    setActiveIdx(i => Math.min(i, pres.slides.length - 2));
  }, [pres.slides.length, withUndo]);

  const handleLayoutChange = useCallback((layout: SlideLayout) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, layout } : s));
  }, [activeIdx, withUndo]);

  const handleThemeChange = useCallback((id: string) => {
    const meta = { ...pres.meta, theme: id };
    update(pres.slides, meta);
  }, [pres, update]);

  const handleTransitionChange = useCallback((t: TransitionType) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, transition: t } : s));
  }, [activeIdx, withUndo]);

  const handleTransitionDurationChange = useCallback((d: TransitionDuration) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, transitionDuration: d } : s));
  }, [activeIdx, withUndo]);

  const handleShapesChange = useCallback((shapes: SlideShape[]) => {
    withUndo(slides => slides.map((s, i) => i === activeIdx ? { ...s, shapes } : s));
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

  // @ts-ignore
  const startPresentation = useCallback(() => setSlideshow(true), []);
  const openPresenter = useCallback(() => {
    openPresenterWindow(pres.slides, theme, activeIdx);
    setSlideshow(true);
  }, [pres.slides, theme, activeIdx]);

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
      />

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
    </div>
  );
}
