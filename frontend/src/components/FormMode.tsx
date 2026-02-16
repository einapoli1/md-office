import React, { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { collectFormData } from '../lib/formExport';

interface Props {
  editor: Editor | null;
}

const FormMode: React.FC<Props> = ({ editor }) => {
  const [fillMode, setFillMode] = useState(false);
  const [progress, setProgress] = useState({ filled: 0, total: 0 });

  const updateProgress = useCallback(() => {
    if (!editor) return;
    const data = collectFormData(editor);
    const total = data.length;
    const filled = data.filter((f) => f.value && f.value !== '' && f.value !== 'false').length;
    setProgress({ filled, total });
  }, [editor]);

  useEffect(() => {
    (window as any).__formFillMode = fillMode;
    if (editor) {
      editor.setEditable(!fillMode);
      // In fill mode we still want form fields to be interactive via NodeView
    }
    if (fillMode) updateProgress();
  }, [fillMode, editor, updateProgress]);

  // Listen for form field changes
  useEffect(() => {
    if (!editor || !fillMode) return;
    const handler = () => updateProgress();
    editor.on('transaction', handler);
    return () => { editor.off('transaction', handler); };
  }, [editor, fillMode, updateProgress]);

  // Listen for toggle event from menu
  useEffect(() => {
    const handler = () => setFillMode((v) => !v);
    window.addEventListener('form-fill-toggle', handler);
    return () => window.removeEventListener('form-fill-toggle', handler);
  }, []);

  if (!fillMode) return null;

  return (
    <div className="form-mode-bar">
      <span className="form-mode-badge">📝 Form Fill Mode</span>
      <span className="form-mode-progress">
        {progress.filled}/{progress.total} fields completed
      </span>
      <button onClick={() => setFillMode(false)} className="form-mode-exit">Exit</button>
    </div>
  );
};

export default FormMode;
