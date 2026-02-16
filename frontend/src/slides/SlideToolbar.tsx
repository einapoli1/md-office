import { SlideLayout, TransitionType } from './slideModel';
import { LAYOUTS } from './slideLayouts';
import { THEMES } from './slideThemes';

interface Props {
  currentTheme: string;
  currentLayout: SlideLayout;
  currentTransition: TransitionType;
  onThemeChange: (id: string) => void;
  onLayoutChange: (layout: SlideLayout) => void;
  onTransitionChange: (t: TransitionType) => void;
  onAddSlide: (layout: SlideLayout) => void;
  onPresent: () => void;
  onBold: () => void;
  onItalic: () => void;
}

export default function SlideToolbar({
  currentTheme, currentLayout, currentTransition,
  onThemeChange, onLayoutChange, onTransitionChange,
  onAddSlide, onPresent, onBold, onItalic,
}: Props) {
  return (
    <div className="slide-toolbar">
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
          <option value="slide">Slide</option>
          <option value="zoom">Zoom</option>
        </select>
      </div>

      <div className="toolbar-group">
        <button onClick={onBold} title="Bold"><b>B</b></button>
        <button onClick={onItalic} title="Italic"><i>I</i></button>
      </div>

      <div className="toolbar-group">
        <div className="add-slide-dropdown">
          <button className="toolbar-btn" onClick={() => onAddSlide('content')} title="Add slide">+ Slide</button>
        </div>
        <button className="toolbar-btn present-btn" onClick={onPresent} title="Present">▶ Present</button>
      </div>
    </div>
  );
}
