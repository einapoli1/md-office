import { useState } from 'react';
import { SlideLayout, TransitionType, TransitionDuration, FragmentType } from './slideModel';
import { LAYOUTS } from './slideLayouts';
import { THEMES } from './slideThemes';
import { ShapePicker } from './ShapeTools';
import type { ShapeType } from './ShapeTools';
import { TEMPLATES } from './slideTemplates';

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
}

export default function SlideToolbar({
  currentTheme, currentLayout, currentTransition, currentTransitionDuration,
  onThemeChange, onLayoutChange, onTransitionChange, onTransitionDurationChange,
  onAddSlide, onPresent, onBold, onItalic,
  onShapeToolSelect, activeShapeTool,
  onInsertFragment, onPreviewAnimation,
  onNewFromTemplate,
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

        <select value={currentTransition} onChange={e => onTransitionChange(e.target.value as TransitionType)} title="Transition">
          <option value="none">No transition</option>
          <option value="fade">Fade</option>
          <option value="slide-left">Slide Left</option>
          <option value="slide-right">Slide Right</option>
          <option value="slide-up">Slide Up</option>
          <option value="zoom">Zoom</option>
          <option value="dissolve">Dissolve</option>
          <option value="wipe">Wipe</option>
        </select>

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
      </div>

      {/* Shapes */}
      <div className="toolbar-group">
        <ShapePicker onSelect={onShapeToolSelect} activeShape={activeShapeTool} />
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

        <button className="toolbar-btn present-btn" onClick={onPresent} title="Present">▶ Present</button>
      </div>
    </div>
  );
}
