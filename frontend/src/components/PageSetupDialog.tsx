import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DocumentMetadata } from '../utils/frontmatter';

interface PageSetupDialogProps {
  metadata: DocumentMetadata;
  onUpdate: (updates: Partial<DocumentMetadata>) => void;
  onClose: () => void;
}

const PAPER_SIZES = [
  { value: 'letter', label: 'US Letter (8.5" × 11")' },
  { value: 'a4', label: 'A4 (8.27" × 11.69")' },
  { value: 'legal', label: 'Legal (8.5" × 14")' },
  { value: 'tabloid', label: 'Tabloid (11" × 17")' },
];

const MARGIN_PRESETS = [
  { value: 'normal', label: 'Normal', desc: '1" all sides' },
  { value: 'narrow', label: 'Narrow', desc: '0.5" all sides' },
  { value: 'wide', label: 'Wide', desc: '1.5" all sides' },
  { value: 'custom', label: 'Custom', desc: '' },
];

const defaultCustomMargins = { top: 1, bottom: 1, left: 1, right: 1 };

const PageSetupDialog: React.FC<PageSetupDialogProps> = ({ metadata, onUpdate, onClose }) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(metadata.orientation || 'portrait');
  const [pageSize, setPageSize] = useState<NonNullable<DocumentMetadata['pageSize']>>(metadata.pageSize || 'letter');
  const [marginPreset, setMarginPreset] = useState<NonNullable<DocumentMetadata['pageMargins']>>(metadata.pageMargins || 'normal');
  const [customMargins, setCustomMargins] = useState(metadata.customMargins || defaultCustomMargins);

  const handleApply = () => {
    const updates: Partial<DocumentMetadata> = {
      orientation,
      pageSize: pageSize as DocumentMetadata['pageSize'],
      pageMargins: marginPreset as DocumentMetadata['pageMargins'],
    };
    if (marginPreset === 'custom') {
      updates.customMargins = customMargins;
    }
    // Update wide margins to 1.5" (override the existing 1.33")
    onUpdate(updates);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="page-setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Page setup</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="page-setup-content">
          {/* Orientation */}
          <div className="page-setup-section">
            <label className="page-setup-label">Orientation</label>
            <div className="orientation-options">
              <label className={`orientation-option ${orientation === 'portrait' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="orientation"
                  value="portrait"
                  checked={orientation === 'portrait'}
                  onChange={() => setOrientation('portrait')}
                />
                <div className="orientation-preview portrait-preview" />
                <span>Portrait</span>
              </label>
              <label className={`orientation-option ${orientation === 'landscape' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="orientation"
                  value="landscape"
                  checked={orientation === 'landscape'}
                  onChange={() => setOrientation('landscape')}
                />
                <div className="orientation-preview landscape-preview" />
                <span>Landscape</span>
              </label>
            </div>
          </div>

          {/* Paper Size */}
          <div className="page-setup-section">
            <label className="page-setup-label">Paper size</label>
            <select
              className="page-setup-select"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as NonNullable<DocumentMetadata['pageSize']>)}
            >
              {PAPER_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Margins */}
          <div className="page-setup-section">
            <label className="page-setup-label">Margins</label>
            <div className="margin-presets">
              {MARGIN_PRESETS.map((m) => (
                <label
                  key={m.value}
                  className={`margin-preset ${marginPreset === m.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="margins"
                    value={m.value}
                    checked={marginPreset === m.value}
                    onChange={() => setMarginPreset(m.value as NonNullable<DocumentMetadata['pageMargins']>)}
                  />
                  <span className="margin-preset-name">{m.label}</span>
                  {m.desc && <span className="margin-preset-desc">{m.desc}</span>}
                </label>
              ))}
            </div>

            {marginPreset === 'custom' && (
              <div className="custom-margins-grid">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <div key={side} className="custom-margin-field">
                    <label>{side.charAt(0).toUpperCase() + side.slice(1)}</label>
                    <div className="margin-input-wrap">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="4"
                        value={customMargins[side]}
                        onChange={(e) =>
                          setCustomMargins({ ...customMargins, [side]: parseFloat(e.target.value) || 0 })
                        }
                      />
                      <span className="margin-unit">in</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="dialog-ok-btn" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default PageSetupDialog;
