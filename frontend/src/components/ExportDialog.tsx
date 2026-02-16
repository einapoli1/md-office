import React, { useCallback, useState } from 'react';
import { X, FileText, Code, Printer, FileType } from 'lucide-react';
import { exportDocx } from '../utils/docxIO';

interface ExportDialogProps {
  content: string;
  htmlContent: string;
  fileName: string;
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ content, htmlContent, fileName, onClose }) => {
  const baseName = fileName.replace(/\.md$/, '') || 'document';

  const downloadFile = useCallback((data: string, ext: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    import('./Toast').then(({ toast }) => toast(`Exported as ${baseName}.${ext}`, 'success'));
    onClose();
  }, [baseName, onClose]);

  const exportMarkdown = () => downloadFile(content, 'md', 'text/markdown');

  const exportHTML = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${baseName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 816px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #202124; }
    h1 { font-size: 26px; font-weight: 400; margin-bottom: 8px; }
    h2 { font-size: 20px; font-weight: 400; margin-top: 24px; }
    h3 { font-size: 16px; font-weight: 600; margin-top: 20px; }
    p { margin: 8px 0; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    pre { background: #f8f9fa; padding: 16px; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 3px solid #dadce0; margin: 12px 0; padding: 8px 16px; color: #5f6368; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #dadce0; padding: 8px 12px; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #dadce0; margin: 24px 0; }
    a { color: #1a73e8; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    downloadFile(fullHtml, 'html', 'text/html');
  };

  const exportPDF = () => {
    // Use the app's own print stylesheet for a clean result
    onClose();
    requestAnimationFrame(() => window.print());
  };

  const [exportingDocx, setExportingDocx] = useState(false);

  const exportWord = async () => {
    setExportingDocx(true);
    try {
      const blob = await exportDocx(htmlContent, baseName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      import('./Toast').then(({ toast }) => toast(`Exported as ${baseName}.docx`, 'success'));
      onClose();
    } catch (err) {
      console.error('DOCX export failed:', err);
      import('./Toast').then(({ toast }) => toast('Failed to export DOCX', 'error'));
    } finally {
      setExportingDocx(false);
    }
  };

  const exportPlainText = () => {
    const text = content
      .replace(/^---[\s\S]*?---\n/m, '')
      .replace(/[#*`_\[\]()!]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    downloadFile(text, 'txt', 'text/plain');
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Download as</h3>
          <button className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="export-options">
          <button className="export-option" onClick={exportMarkdown}>
            <FileText size={20} />
            <div className="export-option-text">
              <span className="export-option-name">Markdown (.md)</span>
              <span className="export-option-desc">Original markdown source</span>
            </div>
          </button>
          <button className="export-option" onClick={exportHTML}>
            <Code size={20} />
            <div className="export-option-text">
              <span className="export-option-name">HTML (.html)</span>
              <span className="export-option-desc">Styled web page</span>
            </div>
          </button>
          <button className="export-option" onClick={exportWord} disabled={exportingDocx}>
            <FileType size={20} />
            <div className="export-option-text">
              <span className="export-option-name">Word Document (.docx)</span>
              <span className="export-option-desc">{exportingDocx ? 'Exporting...' : 'Microsoft Word format'}</span>
            </div>
          </button>
          <button className="export-option" onClick={exportPDF}>
            <Printer size={20} />
            <div className="export-option-text">
              <span className="export-option-name">PDF (via Print)</span>
              <span className="export-option-desc">Print dialog with Save as PDF option</span>
            </div>
          </button>
          <button className="export-option" onClick={exportPlainText}>
            <FileText size={20} />
            <div className="export-option-text">
              <span className="export-option-name">Plain text (.txt)</span>
              <span className="export-option-desc">Formatting removed</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
