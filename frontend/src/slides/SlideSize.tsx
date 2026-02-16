import { useState, useMemo } from 'react';

interface SizePreset {
  name: string;
  label: string;
  width: number;
  height: number;
}

const PRESETS: SizePreset[] = [
  { name: '4:3', label: 'Standard (4:3)', width: 1024, height: 768 },
  { name: '16:9', label: 'Widescreen (16:9)', width: 1920, height: 1080 },
  { name: '16:10', label: 'Widescreen (16:10)', width: 1920, height: 1200 },
  { name: 'A4', label: 'A4 Portrait', width: 794, height: 1123 },
  { name: 'Letter', label: 'Letter', width: 816, height: 1056 },
  { name: 'custom', label: 'Custom', width: 0, height: 0 },
];

interface Props {
  currentAspectRatio: string;
  onApply: (aspectRatio: string, width: number, height: number, scaleContent: boolean) => void;
  onClose: () => void;
}

export default function SlideSize({ currentAspectRatio, onApply, onClose }: Props) {
  const currentPreset = PRESETS.find(p => p.name === currentAspectRatio) || PRESETS[1];
  const [selectedPreset, setSelectedPreset] = useState(currentPreset.name);
  const [customWidth, setCustomWidth] = useState(currentPreset.width || 1920);
  const [customHeight, setCustomHeight] = useState(currentPreset.height || 1080);
  const [scaleContent, setScaleContent] = useState(true);

  const activePreset = PRESETS.find(p => p.name === selectedPreset);
  const width = selectedPreset === 'custom' ? customWidth : (activePreset?.width || 1920);
  const height = selectedPreset === 'custom' ? customHeight : (activePreset?.height || 1080);

  const previewScale = useMemo(() => {
    const maxW = 200;
    const maxH = 140;
    return Math.min(maxW / width, maxH / height);
  }, [width, height]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 24,
        width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>📐 Slide Size</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {PRESETS.map(p => (
            <label key={p.name} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              borderRadius: 6, cursor: 'pointer',
              background: selectedPreset === p.name ? 'var(--bg-accent, #e8f0fe)' : 'transparent',
            }}>
              <input
                type="radio"
                name="slideSize"
                checked={selectedPreset === p.name}
                onChange={() => setSelectedPreset(p.name)}
              />
              <span style={{ flex: 1, fontSize: 14 }}>{p.label}</span>
              {p.name !== 'custom' && (
                <span style={{ fontSize: 11, color: '#888' }}>{p.width}×{p.height}</span>
              )}
            </label>
          ))}
        </div>

        {/* Custom inputs */}
        {selectedPreset === 'custom' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#666' }}>Width (px)</label>
              <input
                type="number"
                value={customWidth}
                onChange={e => setCustomWidth(Math.max(100, parseInt(e.target.value) || 100))}
                style={{ display: 'block', width: 100, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#666' }}>Height (px)</label>
              <input
                type="number"
                value={customHeight}
                onChange={e => setCustomHeight(Math.max(100, parseInt(e.target.value) || 100))}
                style={{ display: 'block', width: 100, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
              />
            </div>
          </div>
        )}

        {/* Preview */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 16, padding: 16,
          background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 8,
        }}>
          <div style={{
            width: width * previewScale,
            height: height * previewScale,
            border: '2px solid #4285f4',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#666', background: '#fff',
          }}>
            {width} × {height}
          </div>
        </div>

        {/* Scale content */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={scaleContent}
            onChange={e => setScaleContent(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>Scale content to fit new size</span>
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc',
            background: 'transparent', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={() => onApply(selectedPreset, width, height, scaleContent)} style={{
            padding: '8px 16px', borderRadius: 6, background: '#4285f4',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
