import { useState, useRef, useCallback } from 'react';

export interface VideoEmbedData {
  id: string;
  type: 'youtube' | 'vimeo' | 'local';
  url: string;
  autoPlay: boolean;
  loop: boolean;
  muted: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function parseVideoUrl(url: string): { type: 'youtube' | 'vimeo' | 'local'; embedUrl: string } | null {
  const ytId = extractYouTubeId(url);
  if (ytId) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytId}` };
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoId}` };
  return null;
}

export function genVideoId(): string {
  return `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Insert Video dialog */
interface InsertVideoDialogProps {
  onInsert: (video: VideoEmbedData) => void;
  onClose: () => void;
}

export function InsertVideoDialog({ onInsert, onClose }: InsertVideoDialogProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlInsert = useCallback(() => {
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      setError('Please enter a valid YouTube or Vimeo URL');
      return;
    }
    onInsert({
      id: genVideoId(),
      type: parsed.type,
      url: parsed.embedUrl,
      autoPlay: false,
      loop: false,
      muted: false,
      x: 10, y: 10, width: 80, height: 60,
    });
  }, [url, onInsert]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onInsert({
        id: genVideoId(),
        type: 'local',
        url: reader.result as string,
        autoPlay: false,
        loop: false,
        muted: false,
        x: 10, y: 10, width: 80, height: 60,
      });
    };
    reader.readAsDataURL(file);
  }, [onInsert]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <h3>Insert Video</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={tab === 'url' ? 'btn-active' : ''} onClick={() => setTab('url')}>URL</button>
          <button className={tab === 'upload' ? 'btn-active' : ''} onClick={() => setTab('upload')}>Upload</button>
        </div>
        {tab === 'url' ? (
          <div>
            <input
              type="text"
              placeholder="YouTube or Vimeo URL…"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              style={{ width: '100%', padding: 8, marginBottom: 8 }}
            />
            {error && <div style={{ color: '#e53e3e', fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleUrlInsert} className="btn-primary">Insert</button>
            </div>
          </div>
        ) : (
          <div>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleFileUpload} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Video placeholder in editor mode */
interface VideoPlaceholderProps {
  video: VideoEmbedData;
  onRemove: (id: string) => void;
  onUpdate: (video: VideoEmbedData) => void;
}

export function VideoPlaceholder({ video, onRemove, onUpdate }: VideoPlaceholderProps) {
  const thumbnailUrl = video.type === 'youtube'
    ? `https://img.youtube.com/vi/${video.url.split('/embed/')[1]}/hqdefault.jpg`
    : undefined;

  return (
    <div
      className="video-placeholder-editor"
      style={{
        position: 'absolute',
        left: `${video.x}%`, top: `${video.y}%`,
        width: `${video.width}%`, height: `${video.height}%`,
        background: '#000', borderRadius: 4, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px dashed #666', cursor: 'pointer',
      }}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="Video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
      ) : (
        <div style={{ color: '#aaa', fontSize: 14 }}>🎬 Local Video</div>
      )}
      <div style={{ position: 'absolute', fontSize: 40, color: '#fff', opacity: 0.8 }}>▶</div>
      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
        <button onClick={() => onUpdate({ ...video, loop: !video.loop })} title="Toggle loop"
          style={{ fontSize: 11, padding: '2px 4px', background: video.loop ? '#4299e1' : '#666', color: '#fff', border: 'none', borderRadius: 3 }}>
          🔁
        </button>
        <button onClick={() => onUpdate({ ...video, autoPlay: !video.autoPlay })} title="Toggle auto-play"
          style={{ fontSize: 11, padding: '2px 4px', background: video.autoPlay ? '#4299e1' : '#666', color: '#fff', border: 'none', borderRadius: 3 }}>
          ▶
        </button>
        <button onClick={() => onUpdate({ ...video, muted: !video.muted })} title="Toggle mute"
          style={{ fontSize: 11, padding: '2px 4px', background: video.muted ? '#4299e1' : '#666', color: '#fff', border: 'none', borderRadius: 3 }}>
          🔇
        </button>
        <button onClick={() => onRemove(video.id)} title="Remove video"
          style={{ fontSize: 11, padding: '2px 4px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 3 }}>
          ✕
        </button>
      </div>
    </div>
  );
}

/** Video player in slideshow mode */
interface VideoPlayerProps {
  video: VideoEmbedData;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(video.autoPlay);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  }, [playing]);

  if (video.type === 'local') {
    return (
      <div
        style={{
          position: 'absolute',
          left: `${video.x}%`, top: `${video.y}%`,
          width: `${video.width}%`, height: `${video.height}%`,
        }}
        onClick={e => { e.stopPropagation(); togglePlay(); }}
      >
        <video
          ref={videoRef}
          src={video.url}
          autoPlay={video.autoPlay}
          loop={video.loop}
          muted={video.muted}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  // YouTube/Vimeo iframe
  const params = new URLSearchParams();
  if (video.autoPlay) params.set('autoplay', '1');
  if (video.loop) params.set('loop', '1');
  if (video.muted) params.set('mute', '1');
  const src = `${video.url}?${params.toString()}`;

  return (
    <div style={{
      position: 'absolute',
      left: `${video.x}%`, top: `${video.y}%`,
      width: `${video.width}%`, height: `${video.height}%`,
    }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; fullscreen"
        title="Embedded video"
      />
    </div>
  );
}
