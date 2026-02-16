import { useState, useEffect, useRef, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

let mermaidCounter = 0;

export function MermaidNodeView({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(false);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [localCode, setLocalCode] = useState(node.attrs.code || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const renderDiagram = useCallback(async (code: string) => {
    if (!code.trim()) { setSvg(''); setError(''); return; }
    try {
      const id = `mermaid-${++mermaidCounter}`;
      const { svg: rendered } = await mermaid.render(id, code);
      setSvg(rendered);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Invalid mermaid syntax');
      setSvg('');
    }
  }, []);

  useEffect(() => { renderDiagram(node.attrs.code || ''); }, [node.attrs.code, renderDiagram]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      setLocalCode(node.attrs.code || '');
    }
  }, [editing, node.attrs.code]);

  const finishEdit = () => {
    updateAttributes({ code: localCode });
    setEditing(false);
    renderDiagram(localCode);
  };

  return (
    <NodeViewWrapper className={`mermaid-block-wrapper ${selected ? 'selected' : ''}`}>
      {editing ? (
        <div className="mermaid-edit-panel">
          <div className="mermaid-edit-header">
            <span>Mermaid Diagram</span>
            <button className="mermaid-done-btn" onClick={finishEdit}>Done</button>
          </div>
          <textarea
            ref={textareaRef}
            className="mermaid-code-editor"
            value={localCode}
            onChange={(e) => setLocalCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') finishEdit(); }}
            rows={Math.max(5, localCode.split('\n').length + 1)}
            spellCheck={false}
          />
          {error && <div className="mermaid-error">{error}</div>}
        </div>
      ) : (
        <div className="mermaid-render-panel" onDoubleClick={() => setEditing(true)} title="Double-click to edit">
          {svg ? (
            <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : error ? (
            <div className="mermaid-error">{error}</div>
          ) : (
            <div className="mermaid-placeholder">Empty diagram — double-click to edit</div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
