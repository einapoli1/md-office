import { useState, useCallback, useRef } from 'react';
import { Slide, TransitionType, genSlideId } from './slideModel';

type AlbumLayout = 'fullscreen' | 'caption' | 'grid-2' | 'grid-4';

interface PhotoEntry {
  id: string;
  dataUrl: string;
  filename: string;
  caption: string;
}

interface Props {
  onInsertSlides: (slides: Slide[]) => void;
  onClose: () => void;
}

const LAYOUT_OPTIONS: { value: AlbumLayout; label: string; icon: string; desc: string }[] = [
  { value: 'fullscreen', label: 'Fullscreen', icon: '🖼', desc: '1 image per slide, fills entire slide' },
  { value: 'caption', label: 'With Captions', icon: '📸', desc: '1 image per slide with caption below' },
  { value: 'grid-2', label: '2 Per Slide', icon: '📰', desc: '2 images side by side per slide' },
  { value: 'grid-4', label: '4 Per Slide', icon: '🔲', desc: '4 images in a grid per slide' },
];

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'zoom', label: 'Zoom' },
];

export default function PhotoAlbum({ onInsertSlides, onClose }: Props) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [layout, setLayout] = useState<AlbumLayout>('caption');
  const [transition, setTransition] = useState<TransitionType>('fade');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          dataUrl: reader.result as string,
          filename: file.name,
          caption: file.name.replace(/\.[^.]+$/, ''),
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const updateCaption = useCallback((id: string, caption: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  const generateSlides = useCallback(() => {
    const slides: Slide[] = [];

    const makeSlide = (content: string): Slide => ({
      id: genSlideId(),
      content,
      layout: 'image',
      notes: '',
      transition,
      transitionDuration: '0.5s',
      fragments: [],
      shapes: [],
      comments: [],
    });

    if (layout === 'fullscreen') {
      photos.forEach(p => {
        slides.push(makeSlide(`<!-- slide: image -->\n![${p.caption}](${p.dataUrl})`));
      });
    } else if (layout === 'caption') {
      photos.forEach(p => {
        slides.push(makeSlide(`<!-- slide: content -->\n# ${p.caption}\n\n![${p.caption}](${p.dataUrl})`));
      });
    } else if (layout === 'grid-2') {
      for (let i = 0; i < photos.length; i += 2) {
        const imgs = photos.slice(i, i + 2);
        const content = `<!-- slide: two-column -->\n\n:::: left\n![${imgs[0].caption}](${imgs[0].dataUrl})\n\n*${imgs[0].caption}*\n::::\n\n:::: right\n${imgs[1] ? `![${imgs[1].caption}](${imgs[1].dataUrl})\n\n*${imgs[1].caption}*` : ''}\n::::`;
        slides.push(makeSlide(content));
      }
    } else if (layout === 'grid-4') {
      for (let i = 0; i < photos.length; i += 4) {
        const imgs = photos.slice(i, i + 4);
        const content = `<!-- slide: content -->\n\n${imgs.map(p => `![${p.caption}](${p.dataUrl})`).join('\n\n')}`;
        slides.push(makeSlide(content));
      }
    }

    onInsertSlides(slides);
  }, [photos, layout, transition, onInsertSlides]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 24,
        width: 640, maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>📷 Photo Album</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#4285f4'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = '#ccc'; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#ccc'; handleFiles(e.dataTransfer.files); }}
          style={{
            border: '2px dashed #ccc', borderRadius: 8, padding: 24,
            textAlign: 'center', cursor: 'pointer', marginBottom: 16,
            background: 'var(--bg-secondary, #f8f8f8)',
          }}
        >
          <div style={{ fontSize: 32 }}>📁</div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Click or drop images here</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* Photo list */}
        {photos.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{photos.length} photos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {photos.map(p => (
                <div key={p.id} style={{
                  borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color, #ddd)',
                  background: 'var(--bg-secondary, #f8f8f8)',
                }}>
                  <img src={p.dataUrl} alt={p.caption} style={{
                    width: '100%', height: 80, objectFit: 'cover', display: 'block',
                  }} />
                  <div style={{ padding: 4 }}>
                    <input
                      value={p.caption}
                      onChange={e => updateCaption(p.id, e.target.value)}
                      placeholder="Caption"
                      style={{
                        width: '100%', border: 'none', background: 'transparent',
                        fontSize: 11, padding: '2px 4px', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => removePhoto(p.id)}
                      style={{
                        background: 'none', border: 'none', color: '#db4437',
                        fontSize: 10, cursor: 'pointer', padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Layout Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {LAYOUT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setLayout(opt.value)}
                style={{
                  padding: 10, borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                  border: layout === opt.value ? '2px solid #4285f4' : '1px solid var(--border-color, #ddd)',
                  background: layout === opt.value ? 'var(--bg-accent, #e8f0fe)' : 'var(--bg-secondary, #f8f8f8)',
                }}
              >
                <span style={{ fontSize: 16 }}>{opt.icon}</span>{' '}
                <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Transition */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Transition:</label>
          <select
            value={transition}
            onChange={e => setTransition(e.target.value as TransitionType)}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          >
            {TRANSITION_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc',
            background: 'transparent', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={generateSlides}
            disabled={photos.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 6, background: photos.length > 0 ? '#4285f4' : '#ccc',
              color: '#fff', border: 'none', cursor: photos.length > 0 ? 'pointer' : 'default',
            }}
          >
            Create {photos.length > 0 ? `${Math.ceil(photos.length / (layout === 'grid-4' ? 4 : layout === 'grid-2' ? 2 : 1))} slides` : 'Album'}
          </button>
        </div>
      </div>
    </div>
  );
}
