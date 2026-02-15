import React, { useState } from 'react';
import { X, Hash, Calendar, FileText } from 'lucide-react';

export interface HeaderFooterContent {
  header: { left: string; center: string; right: string };
  footer: { left: string; center: string; right: string };
}

const defaultContent: HeaderFooterContent = {
  header: { left: '', center: '', right: '' },
  footer: { left: '', center: '{page}', right: '' },
};

interface HeaderFooterEditorProps {
  type: 'header' | 'footer';
  content: HeaderFooterContent;
  onChange: (content: HeaderFooterContent) => void;
  onClose: () => void;
  documentTitle?: string;
}

const HeaderFooterEditor: React.FC<HeaderFooterEditorProps> = ({
  type,
  content,
  onChange,
  onClose,
  documentTitle: _documentTitle = 'Untitled',
}) => {
  const section = content[type];

  const update = (field: 'left' | 'center' | 'right', value: string) => {
    onChange({
      ...content,
      [type]: { ...section, [field]: value },
    });
  };

  const insertAt = (field: 'left' | 'center' | 'right', token: string) => {
    update(field, section[field] + token);
  };

  // Track which field is focused for insert buttons
  const [activeField, setActiveField] = useState<'left' | 'center' | 'right'>('center');

  return (
    <div className="hf-editor-overlay" onClick={onClose}>
      <div className="hf-editor" onClick={(e) => e.stopPropagation()}>
        <div className="hf-editor-header">
          <span className="hf-editor-title">
            Edit {type === 'header' ? 'Header' : 'Footer'}
          </span>
          <div className="hf-editor-actions">
            <button
              className="hf-insert-btn"
              onClick={() => insertAt(activeField, '{page}')}
              title="Insert page number"
            >
              <Hash size={14} /> Page #
            </button>
            <button
              className="hf-insert-btn"
              onClick={() => insertAt(activeField, '{date}')}
              title="Insert date"
            >
              <Calendar size={14} /> Date
            </button>
            <button
              className="hf-insert-btn"
              onClick={() => insertAt(activeField, '{title}')}
              title="Insert document title"
            >
              <FileText size={14} /> Title
            </button>
            <button className="hf-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="hf-editor-fields">
          <input
            className="hf-field hf-field-left"
            value={section.left}
            onChange={(e) => update('left', e.target.value)}
            onFocus={() => setActiveField('left')}
            placeholder="Left"
          />
          <input
            className="hf-field hf-field-center"
            value={section.center}
            onChange={(e) => update('center', e.target.value)}
            onFocus={() => setActiveField('center')}
            placeholder="Center"
          />
          <input
            className="hf-field hf-field-right"
            value={section.right}
            onChange={(e) => update('right', e.target.value)}
            onFocus={() => setActiveField('right')}
            placeholder="Right"
          />
        </div>
        <div className="hf-editor-hint">
          Use {'{page}'} for page number, {'{date}'} for today's date, {'{title}'} for document title.
        </div>
      </div>
    </div>
  );
};

// Resolve tokens in a header/footer string
export function resolveTokens(
  text: string,
  pageNum: number,
  totalPages: number,
  title: string
): string {
  const today = new Date().toLocaleDateString();
  return text
    .replace(/\{page\}/g, String(pageNum))
    .replace(/\{pages\}/g, String(totalPages))
    .replace(/\{date\}/g, today)
    .replace(/\{title\}/g, title);
}

export { HeaderFooterEditor, defaultContent };
export default HeaderFooterEditor;
