import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioNarrationData {
  slideId: string;
  audioUrl: string; // base64 data URL or blob URL
  durationMs: number;
  autoAdvance: boolean;
}

/** Check if MediaRecorder is supported */
function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

interface AudioNarrationDialogProps {
  slideId: string;
  existing?: AudioNarrationData;
  onSave: (data: AudioNarrationData) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function AudioNarrationDialog({ slideId, existing, onSave, onRemove, onClose }: AudioNarrationDialogProps) {
  const [tab, setTab] = useState<'record' | 'upload'>('record');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(existing?.audioUrl || '');
  const [durationMs, setDurationMs] = useState(existing?.durationMs || 0);
  const [autoAdvance, setAutoAdvance] = useState(existing?.autoAdvance ?? true);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  const startRecording = useCallback(async () => {
    if (!isMediaRecorderSupported()) {
      alert('MediaRecorder is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudioUrl(reader.result as string);
          // Get duration from audio element
          const audio = new Audio(reader.result as string);
          audio.onloadedmetadata = () => {
            setDurationMs(Math.round(audio.duration * 1000));
          };
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Could not access microphone. Please allow microphone access.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAudioUrl(dataUrl);
      const audio = new Audio(dataUrl);
      audio.onloadedmetadata = () => {
        setDurationMs(Math.round(audio.duration * 1000));
      };
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [recording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <h3>Audio Narration</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={tab === 'record' ? 'btn-active' : ''} onClick={() => setTab('record')}>Record</button>
          <button className={tab === 'upload' ? 'btn-active' : ''} onClick={() => setTab('upload')}>Upload</button>
        </div>

        {tab === 'record' ? (
          <div>
            {!isMediaRecorderSupported() ? (
              <div style={{ color: '#e53e3e', marginBottom: 12 }}>MediaRecorder not supported in this browser.</div>
            ) : (
              <div style={{ textAlign: 'center', padding: 16 }}>
                {recording ? (
                  <>
                    <div style={{ fontSize: 24, color: '#e53e3e', marginBottom: 8 }}>🔴 Recording</div>
                    <div style={{ fontSize: 20, fontFamily: 'monospace', marginBottom: 12 }}>{formatTime(recordingTime)}</div>
                    <button onClick={stopRecording} className="btn-primary" style={{ background: '#e53e3e' }}>⏹ Stop</button>
                  </>
                ) : (
                  <button onClick={startRecording} className="btn-primary" style={{ fontSize: 16, padding: '8px 24px' }}>
                    🎙 Start Recording
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <input type="file" accept="audio/*" onChange={handleFileUpload} />
          </div>
        )}

        {audioUrl && (
          <div style={{ marginTop: 12 }}>
            <audio ref={audioPreviewRef} src={audioUrl} controls style={{ width: '100%' }} />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Duration: {formatTime(Math.round(durationMs / 1000))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13 }}>
              <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />
              Auto-advance to next slide when audio ends
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {existing && (
            <button onClick={onRemove} style={{ color: '#e53e3e', marginRight: 'auto' }}>Remove</button>
          )}
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => { if (audioUrl) onSave({ slideId, audioUrl, durationMs, autoAdvance }); }}
            className="btn-primary"
            disabled={!audioUrl}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Waveform indicator shown on slide thumbnail */
export function AudioWaveformIndicator({ hasAudio }: { hasAudio: boolean }) {
  if (!hasAudio) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 2, right: 2,
      background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '1px 4px',
      display: 'flex', alignItems: 'center', gap: 2,
    }}>
      <span style={{ fontSize: 10, color: '#4299e1' }}>🔊</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 10 }}>
        {[3, 6, 4, 8, 5].map((h, i) => (
          <div key={i} style={{
            width: 2, height: h, background: '#4299e1', borderRadius: 1,
            animation: `waveform-pulse 1s ease-in-out ${i * 0.1}s infinite alternate`,
          }} />
        ))}
      </div>
    </div>
  );
}

/** Audio player for slideshow mode */
interface SlideshowAudioPlayerProps {
  narration: AudioNarrationData;
  onEnded: () => void;
  playing: boolean;
}

export function SlideshowAudioPlayer({ narration, onEnded, playing }: SlideshowAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.play().catch(() => { /* autoplay blocked */ });
    } else {
      audioRef.current.pause();
    }
  }, [playing]);

  return (
    <audio
      ref={audioRef}
      src={narration.audioUrl}
      onEnded={() => { if (narration.autoAdvance) onEnded(); }}
      style={{ display: 'none' }}
    />
  );
}
