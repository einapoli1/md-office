// OCR Extractor — Extract text from pasted/dropped images using Tesseract.js

import { useState, useCallback, useRef } from 'react';

interface OCRExtractorProps {
  imageData: string; // data URL or blob URL
  onInsert: (text: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'ara', label: 'Arabic' },
  { code: 'rus', label: 'Russian' },
  { code: 'hin', label: 'Hindi' },
];

export default function OCRExtractor({ imageData, onInsert, onClose }: OCRExtractorProps) {
  const [language, setLanguage] = useState('eng');
  const [extractedText, setExtractedText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const workerRef = useRef<any>(null);

  const runOCR = useCallback(async () => {
    setStatus('loading');
    setProgress(0);
    setExtractedText('');
    setErrorMsg('');

    try {
      // Lazy load tesseract.js
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker(language, undefined, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round((m.progress ?? 0) * 100));
          }
        },
      });
      workerRef.current = worker;

      const { data } = await worker.recognize(imageData);
      setExtractedText(data.text);
      setStatus('done');
      await worker.terminate();
      workerRef.current = null;
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'OCR failed');
    }
  }, [imageData, language]);

  const handleInsert = () => {
    if (extractedText.trim()) {
      onInsert(extractedText.trim());
    }
  };

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="ocr-dialog" onClick={e => e.stopPropagation()}>
        <div className="ocr-dialog-header">
          <h3>📷 Extract Text from Image</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="ocr-dialog-body">
          <div className="ocr-image-preview">
            <img src={imageData} alt="OCR source" />
          </div>

          <div className="ocr-controls">
            <div className="ocr-lang-select">
              <label>Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} disabled={status === 'loading'}>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {status === 'idle' && (
              <button className="ocr-extract-btn" onClick={runOCR}>
                🔍 Extract Text
              </button>
            )}

            {status === 'loading' && (
              <div className="ocr-progress">
                <div className="ocr-progress-bar">
                  <div className="ocr-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="ocr-progress-text">Recognizing... {progress}%</span>
              </div>
            )}

            {status === 'error' && (
              <div className="ocr-error">
                <span>❌ {errorMsg}</span>
                <button className="ocr-retry-btn" onClick={runOCR}>Retry</button>
              </div>
            )}
          </div>

          {status === 'done' && (
            <div className="ocr-result">
              <label>Extracted Text</label>
              <textarea
                className="ocr-result-text"
                value={extractedText}
                onChange={e => setExtractedText(e.target.value)}
                rows={8}
                placeholder="No text detected"
              />
              <span className="ocr-hint">
                {extractedText.trim() ? `${extractedText.trim().split(/\s+/).length} words detected` : 'No text was detected. Try a different language or clearer image.'}
              </span>
            </div>
          )}
        </div>

        <div className="ocr-dialog-footer">
          <button className="cf-btn-cancel" onClick={onClose}>Cancel</button>
          {status === 'done' && extractedText.trim() && (
            <button className="cf-save-btn" onClick={handleInsert}>
              Insert Text
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hook to detect image paste/drop and offer OCR */
export function useOCRPaste(): {
  ocrImage: string | null;
  setOcrImage: (img: string | null) => void;
  handlePaste: (e: ClipboardEvent) => void;
  handleDrop: (e: DragEvent) => void;
} {
  const [ocrImage, setOcrImage] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOcrImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) processFile(file);
        break;
      }
    }
  }, [processFile]);

  const handleDrop = useCallback((e: DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        processFile(file);
        break;
      }
    }
  }, [processFile]);

  return { ocrImage, setOcrImage, handlePaste, handleDrop };
}
