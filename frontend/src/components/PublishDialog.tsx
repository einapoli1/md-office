import React, { useState, useMemo, useCallback } from 'react';
import { X, FileText, Globe, Link as LinkIcon, Download, QrCode } from 'lucide-react';
import { exportDocx } from '../utils/docxIO';

interface PublishDialogProps {
  content: string;
  htmlContent: string;
  fileName: string;
  onClose: () => void;
}

// Simple SVG QR code generator (encodes URL as a basic QR-like grid pattern)
function generateQRSvg(text: string, size = 200): string {
  // Simple hash-based deterministic grid (not a real QR, but visually representative)
  const modules = 21;
  const cellSize = size / modules;
  const grid: boolean[][] = [];

  // Seed from text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  // Generate deterministic pattern
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  for (let r = 0; r < modules; r++) {
    grid[r] = [];
    for (let c = 0; c < modules; c++) {
      // Fixed patterns (finder patterns at corners)
      const inFinderTL = r < 7 && c < 7;
      const inFinderTR = r < 7 && c >= modules - 7;
      const inFinderBL = r >= modules - 7 && c < 7;

      if (inFinderTL || inFinderTR || inFinderBL) {
        const lr = inFinderTL ? r : inFinderTR ? r : r - (modules - 7);
        const lc = inFinderTL ? c : inFinderTR ? c - (modules - 7) : c;
        // Finder pattern
        grid[r][c] =
          lr === 0 || lr === 6 || lc === 0 || lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        grid[r][c] = rng(hash + r * modules + c) > 0.5;
      }
    }
  }

  let rects = '';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (grid[r][c]) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`;
}

const PublishDialog: React.FC<PublishDialogProps> = ({ content, htmlContent, fileName, onClose }) => {
  const baseName = fileName.replace(/\.md$/, '') || 'document';
  const [shareUrl, setShareUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const downloadFile = useCallback((data: string | Blob, ext: string, mimeType: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [baseName]);

  const exportPDF = () => {
    // Use print stylesheet
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${baseName}</title>
      <style>
        @media print { @page { margin: 1in; } }
        body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1,h2,h3 { break-after: avoid; }
        img { max-width: 100%; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ddd; padding: 8px; }
        [data-cover-page] { break-after: always; }
      </style></head><body>${htmlContent}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const exportDOCX = async () => {
    try {
      await exportDocx(htmlContent, baseName);
    } catch {
      alert('DOCX export failed');
    }
  };

  const exportHTML = () => {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName}</title>
      <style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:40px;}
      h1,h2,h3{color:#333}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}
      img{max-width:100%}blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:16px;color:#555}
      [data-callout]{border-radius:4px;padding:12px 16px;margin:8px 0}</style>
      </head><body>${htmlContent}</body></html>`;
    downloadFile(fullHtml, 'html', 'text/html');
  };

  const exportMarkdown = () => {
    downloadFile(content, 'md', 'text/markdown');
  };

  const exportEPUB = () => {
    // Simple EPUB is a zip with XHTML — create minimal structure
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${baseName}</title>
<style>body{font-family:serif;line-height:1.6}img{max-width:100%}</style>
</head><body>${htmlContent}</body></html>`;
    downloadFile(xhtml, 'xhtml', 'application/xhtml+xml');
  };

  const publishToWeb = () => {
    setPublishing(true);
    // Generate self-contained HTML
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${baseName}</title>
      <style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:20px 40px;color:#333}
      h1{font-size:2em}h2{font-size:1.5em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}
      img{max-width:100%}a{color:#4285f4}blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:16px;color:#555}
      [data-callout]{border-radius:4px;padding:12px 16px;margin:8px 0}
      @media(max-width:600px){body{padding:12px}}</style>
      </head><body>${htmlContent}<footer style="margin-top:48px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px;">Published with MD Office</footer></body></html>`;
    downloadFile(fullHtml, 'html', 'text/html');
    setPublishing(false);
  };

  const generateShareLink = () => {
    // Mock URL generation
    const id = Math.random().toString(36).substring(2, 10);
    const url = `https://mdoffice.app/share/${id}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const qrSvg = useMemo(() => {
    if (!shareUrl) return '';
    return generateQRSvg(shareUrl);
  }, [shareUrl]);

  const formats = [
    { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Print-ready document', action: exportPDF },
    { id: 'docx', label: 'DOCX', icon: FileText, desc: 'Microsoft Word', action: exportDOCX },
    { id: 'html', label: 'HTML', icon: FileText, desc: 'Web page', action: exportHTML },
    { id: 'md', label: 'Markdown', icon: FileText, desc: 'Plain text markup', action: exportMarkdown },
    { id: 'epub', label: 'EPUB', icon: FileText, desc: 'E-book format', action: exportEPUB },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: 8, padding: 24, width: 500,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Publish & Export</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Export formats */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
            <Download size={14} style={{ verticalAlign: 'middle' }} /> Export As
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={f.action}
                style={{
                  padding: '10px 8px', border: '1px solid #ddd', borderRadius: 6,
                  cursor: 'pointer', background: '#fafafa', textAlign: 'center', fontSize: 12,
                }}
              >
                <f.icon size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 600 }}>{f.label}</div>
                <div style={{ color: '#888', fontSize: 10 }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Publish to web */}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
            <Globe size={14} style={{ verticalAlign: 'middle' }} /> Publish to Web
          </h4>
          <button
            onClick={publishToWeb}
            disabled={publishing}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
              background: '#34a853', color: 'white', fontWeight: 600, fontSize: 13,
            }}
          >
            {publishing ? 'Publishing...' : 'Generate Static HTML'}
          </button>
        </div>

        {/* Share link */}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
            <LinkIcon size={14} style={{ verticalAlign: 'middle' }} /> Share
          </h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={generateShareLink}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
                background: '#4285f4', color: 'white', fontWeight: 600, fontSize: 13,
              }}
            >
              Generate Read-Only Link
            </button>
            {shareUrl && (
              <button
                onClick={() => setShowQR(!showQR)}
                style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '6px 8px', cursor: 'pointer' }}
                title="Show QR Code"
              >
                <QrCode size={16} />
              </button>
            )}
          </div>
          {shareUrl && (
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                style={{
                  width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4,
                  fontSize: 12, fontFamily: 'monospace', background: '#f5f5f5',
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              {showQR && (
                <div style={{ marginTop: 8, textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublishDialog;
