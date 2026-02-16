import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface WatermarkConfig {
  text: string;
  fontSize: 'small' | 'medium' | 'large';
  color: string;
  rotation: number;
  opacity: number;
}

interface WatermarkDialogProps {
  watermark: WatermarkConfig | null;
  onApply: (config: WatermarkConfig | null) => void;
  onClose: () => void;
}

const fontSizeMap = { small: 48, medium: 72, large: 120 };

const WatermarkDialog: React.FC<WatermarkDialogProps> = ({ watermark, onApply, onClose }) => {
  const [config, setConfig] = useState<WatermarkConfig>(watermark ?? {
    text: 'DRAFT',
    fontSize: 'medium',
    color: '#cccccc',
    rotation: -45,
    opacity: 0.3,
  });

  const update = (patch: Partial<WatermarkConfig>) => setConfig(prev => ({ ...prev, ...patch }));

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="watermark-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Watermark</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="watermark-dialog-body">
          {/* Preview */}
          <div className="watermark-preview-box">
            <span
              className="watermark-preview-text"
              style={{
                fontSize: fontSizeMap[config.fontSize] * 0.4,
                color: config.color,
                opacity: config.opacity,
                transform: `rotate(${config.rotation}deg)`,
              }}
            >
              {config.text || 'PREVIEW'}
            </span>
          </div>

          <div className="watermark-fields">
            <label>Text
              <input
                type="text"
                value={config.text}
                onChange={e => update({ text: e.target.value })}
                placeholder="e.g. DRAFT, CONFIDENTIAL"
              />
            </label>

            <label>Font size
              <select value={config.fontSize} onChange={e => update({ fontSize: e.target.value as any })}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>

            <label>Color
              <div className="watermark-color-row">
                <input type="color" value={config.color} onChange={e => update({ color: e.target.value })} />
                <span>{config.color}</span>
              </div>
            </label>

            <label>Rotation ({config.rotation}°)
              <input type="range" min={-90} max={90} value={config.rotation} onChange={e => update({ rotation: Number(e.target.value) })} />
            </label>

            <label>Opacity ({Math.round(config.opacity * 100)}%)
              <input type="range" min={0.05} max={1} step={0.05} value={config.opacity} onChange={e => update({ opacity: Number(e.target.value) })} />
            </label>
          </div>
        </div>

        <div className="watermark-dialog-footer">
          <button className="watermark-remove-btn" onClick={() => { onApply(null); onClose(); }}>Remove</button>
          <div className="watermark-footer-right">
            <button className="watermark-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="watermark-apply-btn" onClick={() => { onApply(config); onClose(); }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatermarkDialog;
