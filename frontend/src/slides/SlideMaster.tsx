import React, { useState, useCallback } from 'react';
import type { SlideMasterData, MasterLayoutPlaceholder } from './slideCollab';
import { DEFAULT_MASTER } from './slideCollab';
interface Props {
  master: SlideMasterData;
  onChange: (master: SlideMasterData) => void;
  onClose: () => void;
}

const LAYOUT_NAMES: Record<string, string> = {
  title: 'Title Slide',
  content: 'Content',
  'two-column': 'Two Column',
  image: 'Image',
  section: 'Section Header',
  blank: 'Blank',
};

const PLACEHOLDER_COLORS: Record<string, string> = {
  title: '#4285F4',
  subtitle: '#A142F4',
  body: '#34A853',
  image: '#FA7B17',
  footer: '#795548',
};

const SlideMaster: React.FC<Props> = ({ master, onChange, onClose }) => {
  const [activeLayout, setActiveLayout] = useState<string>('title');

  const updateField = useCallback(<K extends keyof SlideMasterData>(key: K, value: SlideMasterData[K]) => {
    onChange({ ...master, [key]: value });
  }, [master, onChange]);

  const updatePlaceholder = useCallback((layoutKey: string, phIdx: number, field: keyof MasterLayoutPlaceholder, value: any) => {
    const layouts = { ...master.layouts };
    const phs = [...(layouts[layoutKey] || [])];
    phs[phIdx] = { ...phs[phIdx], [field]: value };
    layouts[layoutKey] = phs;
    onChange({ ...master, layouts });
  }, [master, onChange]);

  const addPlaceholder = useCallback((layoutKey: string) => {
    const layouts = { ...master.layouts };
    const phs = [...(layouts[layoutKey] || [])];
    phs.push({
      id: `p-${Date.now()}`,
      type: 'body',
      x: 10,
      y: 10,
      width: 30,
      height: 20,
    });
    layouts[layoutKey] = phs;
    onChange({ ...master, layouts });
  }, [master, onChange]);

  const removePlaceholder = useCallback((layoutKey: string, phIdx: number) => {
    const layouts = { ...master.layouts };
    const phs = [...(layouts[layoutKey] || [])];
    phs.splice(phIdx, 1);
    layouts[layoutKey] = phs;
    onChange({ ...master, layouts });
  }, [master, onChange]);

  const resetToDefaults = useCallback(() => {
    onChange({ ...DEFAULT_MASTER });
  }, [onChange]);

  const currentPlaceholders = master.layouts[activeLayout] || [];

  return (
    <div className="slide-master-overlay">
      <div className="slide-master-editor">
        <div className="slide-master-header">
          <h2>Slide Master Editor</h2>
          <div className="slide-master-header-actions">
            <button className="btn-secondary" onClick={resetToDefaults}>Reset Defaults</button>
            <button className="btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>

        <div className="slide-master-body">
          {/* Left: Global styles */}
          <div className="slide-master-globals">
            <h3>Global Styles</h3>

            <label>Body Font</label>
            <select value={master.fontFamily} onChange={e => updateField('fontFamily', e.target.value)}>
              <option value="Inter, system-ui, sans-serif">Inter</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Fira Code', monospace">Fira Code</option>
              <option value="'Helvetica Neue', Arial, sans-serif">Helvetica</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
            </select>

            <label>Heading Font</label>
            <select value={master.headingFont} onChange={e => updateField('headingFont', e.target.value)}>
              <option value="Inter, system-ui, sans-serif">Inter</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Fira Code', monospace">Fira Code</option>
              <option value="'Helvetica Neue', Arial, sans-serif">Helvetica</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
            </select>

            <label>Background Color</label>
            <div className="color-input-row">
              <input type="color" value={master.backgroundColor} onChange={e => updateField('backgroundColor', e.target.value)} />
              <input type="text" value={master.backgroundColor} onChange={e => updateField('backgroundColor', e.target.value)} />
            </div>

            <label>Text Color</label>
            <div className="color-input-row">
              <input type="color" value={master.textColor} onChange={e => updateField('textColor', e.target.value)} />
              <input type="text" value={master.textColor} onChange={e => updateField('textColor', e.target.value)} />
            </div>

            <label>Accent Color</label>
            <div className="color-input-row">
              <input type="color" value={master.accentColor} onChange={e => updateField('accentColor', e.target.value)} />
              <input type="text" value={master.accentColor} onChange={e => updateField('accentColor', e.target.value)} />
            </div>
          </div>

          {/* Center: Layout preview */}
          <div className="slide-master-preview">
            <div className="master-layout-tabs">
              {Object.keys(LAYOUT_NAMES).map(key => (
                <button
                  key={key}
                  className={`master-layout-tab ${activeLayout === key ? 'active' : ''}`}
                  onClick={() => setActiveLayout(key)}
                >
                  {LAYOUT_NAMES[key]}
                </button>
              ))}
            </div>

            <div
              className="master-slide-preview"
              style={{
                backgroundColor: master.backgroundColor,
                color: master.textColor,
                fontFamily: master.fontFamily,
              }}
            >
              {currentPlaceholders.map((ph, _i) => (
                <div
                  key={ph.id}
                  className="master-placeholder"
                  style={{
                    left: `${ph.x}%`,
                    top: `${ph.y}%`,
                    width: `${ph.width}%`,
                    height: `${ph.height}%`,
                    borderColor: PLACEHOLDER_COLORS[ph.type] || '#999',
                    backgroundColor: `${PLACEHOLDER_COLORS[ph.type] || '#999'}22`,
                  }}
                  title={`${ph.type} placeholder`}
                >
                  <span className="placeholder-label">{ph.type}</span>
                </div>
              ))}
              {currentPlaceholders.length === 0 && (
                <div className="master-empty-layout">Blank layout — no placeholders</div>
              )}
            </div>
          </div>

          {/* Right: Placeholder details */}
          <div className="slide-master-placeholders">
            <h3>Placeholders — {LAYOUT_NAMES[activeLayout]}</h3>

            {currentPlaceholders.map((ph, i) => (
              <div key={ph.id} className="placeholder-editor">
                <div className="placeholder-editor-header">
                  <select
                    value={ph.type}
                    onChange={e => updatePlaceholder(activeLayout, i, 'type', e.target.value)}
                  >
                    <option value="title">Title</option>
                    <option value="subtitle">Subtitle</option>
                    <option value="body">Body</option>
                    <option value="image">Image</option>
                    <option value="footer">Footer</option>
                  </select>
                  <button className="btn-icon btn-danger" onClick={() => removePlaceholder(activeLayout, i)} title="Remove">✕</button>
                </div>
                <div className="placeholder-dims">
                  <label>X<input type="number" min={0} max={100} value={ph.x} onChange={e => updatePlaceholder(activeLayout, i, 'x', +e.target.value)} /></label>
                  <label>Y<input type="number" min={0} max={100} value={ph.y} onChange={e => updatePlaceholder(activeLayout, i, 'y', +e.target.value)} /></label>
                  <label>W<input type="number" min={1} max={100} value={ph.width} onChange={e => updatePlaceholder(activeLayout, i, 'width', +e.target.value)} /></label>
                  <label>H<input type="number" min={1} max={100} value={ph.height} onChange={e => updatePlaceholder(activeLayout, i, 'height', +e.target.value)} /></label>
                </div>
              </div>
            ))}

            <button className="btn-secondary master-add-ph" onClick={() => addPlaceholder(activeLayout)}>
              + Add Placeholder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideMaster;
