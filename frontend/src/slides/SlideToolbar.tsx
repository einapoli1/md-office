import { useState } from 'react';
import { SlideLayout, TransitionType, TransitionDuration, FragmentType } from './slideModel';
import { LAYOUTS } from './slideLayouts';
import { THEMES } from './slideThemes';
import { ShapePicker } from './ShapeTools';
import type { ShapeType } from './ShapeTools';
import { TEMPLATES } from './slideTemplates';
import { TransitionSelectWithPreview } from './TransitionPreview';

interface Props {
  currentTheme: string;
  currentLayout: SlideLayout;
  currentTransition: TransitionType;
  currentTransitionDuration: TransitionDuration;
  onThemeChange: (id: string) => void;
  onLayoutChange: (layout: SlideLayout) => void;
  onTransitionChange: (t: TransitionType) => void;
  onTransitionDurationChange: (d: TransitionDuration) => void;
  onAddSlide: (layout: SlideLayout) => void;
  onPresent: () => void;
  onBold: () => void;
  onItalic: () => void;
  onShapeToolSelect: (type: ShapeType | null) => void;
  activeShapeTool: ShapeType | null;
  onInsertFragment: (type: FragmentType) => void;
  onPreviewAnimation: () => void;
  onNewFromTemplate: (templateId: string) => void;
  onExportPDF?: () => void;
  onExportHTML?: () => void;
  onExportPPTX?: () => void;
  onImportPPTX?: () => void;
  onToggleTimeline?: () => void;
  showTimeline?: boolean;
  onInsertVideo?: () => void;
  onInsertAudio?: () => void;
  onInsertInteractive?: () => void;
  onDesignIdeas?: () => void;
  onSlideSorter?: () => void;
  onRehearse?: () => void;
  onQASession?: () => void;
}

export default function SlideToolbar({
  currentTheme, currentLayout, currentTransition, currentTransitionDuration,
  onThemeChange, onLayoutChange, onTransitionChange, onTransitionDurationChange,
  onAddSlide, onPresent, onBold, onItalic,
  onShapeToolSelect, activeShapeTool,
  onInsertFragment, onPreviewAnimation,
  onNewFromTemplate,
  onExportPDF, onExportHTML, onExportPPTX, onImportPPTX,
  onToggleTimeline, showTimeline,
  onInsertVideo, onInsertAudio, onInsertInteractive,
  onDesignIdeas, onSlideSorter,
  onRehearse, onQASession,
}: Props) {
  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <div className="slide-toolbar">
      {/* Theme / Layout / Transition */}
      <div className="toolbar-group">
        <select value={currentTheme} onChange={e => onThemeChange(e.target.value)} title="Theme">
          {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={currentLayout} onChange={e => onLayoutChange(e.target.value as SlideLayout)} title="Layout">
          {LAYOUTS.map(l => <option key={l.name} value={l.name}>{l.icon} {l.label}</option>)}
        </select>

        <TransitionSelectWithPreview value={currentTransition} onChange={onTransitionChange} />

        <select value={currentTransitionDuration} onChange={e => onTransitionDurationChange(e.target.value as TransitionDuration)} title="Duration">
          <option value="0.3s">Fast (0.3s)</option>
          <option value="0.5s">Normal (0.5s)</option>
          <option value="1.0s">Slow (1.0s)</option>
        </select>
      </div>

      {/* Text formatting */}
      <div className="toolbar-group">
        <button onClick={onBold} title="Bold"><b>B</b></button>
        <button onClick={onItalic} title="Italic"><i>I</i></button>
      </div>

      {/* Animation / Fragments */}
      <div className="toolbar-group">
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) { onInsertFragment(e.target.value as FragmentType); e.target.value = ''; } }}
          title="Insert Fragment Animation"
        >
          <option value="" disabled>🎬 Animation</option>
          <option value="fade-in">Fade In</option>
          <option value="slide-up">Slide Up</option>
          <option value="slide-left">Slide Left</option>
          <option value="zoom-in">Zoom In</option>
          <option value="appear">Appear</option>
        </select>
        <button onClick={onPreviewAnimation} title="Preview animations">👁 Preview</button>
        <button
          onClick={onToggleTimeline}
          title="Animation Timeline"
          className={showTimeline ? 'btn-active' : ''}
        >🎬 Timeline</button>
      </div>

      {/* Shapes */}
      <div className="toolbar-group">
        <ShapePicker onSelect={onShapeToolSelect} activeShape={activeShapeTool} />
      </div>

      {/* Media & Interactive */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onInsertVideo} title="Insert Video">🎬 Video</button>
        <button className="toolbar-btn" onClick={onInsertAudio} title="Insert Audio Narration">🎙 Audio</button>
        <button className="toolbar-btn" onClick={onInsertInteractive} title="Insert Interactive Element">🔘 Interactive</button>
      </div>

      {/* Add slide + templates */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => onAddSlide('content')} title="Add slide">+ Slide</button>

        <div className="template-picker-wrapper">
          <button className="toolbar-btn" onClick={() => setTemplateOpen(!templateOpen)} title="New from template">📋 Template</button>
          {templateOpen && (
            <div className="template-picker-dropdown">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { onNewFromTemplate(t.id); setTemplateOpen(false); }}>
                  {t.icon} {t.name}
                  <span className="template-desc">{t.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="toolbar-btn" onClick={onDesignIdeas} title="Design Ideas">🎨 Design</button>
        <button className="toolbar-btn" onClick={onSlideSorter} title="Slide Sorter">📊 Sorter</button>
        <button className="toolbar-btn" onClick={onRehearse} title="Rehearse with Speaker Coach">🎤 Rehearse</button>
        <button className="toolbar-btn" onClick={onQASession} title="Start Q&A Session">📋 Q&A</button>
        <button className="toolbar-btn present-btn" onClick={onPresent} title="Present">▶ Present</button>
        <button className="toolbar-btn" onClick={onExportPDF} title="Export PDF (Print)">🖨 PDF</button>
        <button className="toolbar-btn" onClick={onExportHTML} title="Export standalone HTML">💾 HTML</button>
        <button className="toolbar-btn" onClick={onExportPPTX} title="Export PPTX">📦 PPTX</button>
        <button className="toolbar-btn" onClick={onImportPPTX} title="Import PPTX">📂 Import PPTX</button>
      </div>
    </div>
  );
}
