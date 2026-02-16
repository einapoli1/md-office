import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TabStop } from '../TabStop';

function createEditor(content = '<p>Hello world</p>') {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, TabStop],
    content,
  });
}

describe('TabStop extension', () => {
  it('registers the tabStop node type', () => {
    const editor = createEditor();
    expect(editor.schema.nodes.tabStop).toBeDefined();
    editor.destroy();
  });

  it('inserts a tab stop via insertContent', () => {
    const editor = createEditor();
    editor.commands.insertContent({ type: 'tabStop' });
    const json = editor.getJSON();
    const hasTab = JSON.stringify(json).includes('"type":"tabStop"');
    expect(hasTab).toBe(true);
    editor.destroy();
  });

  it('is an inline atom node', () => {
    const editor = createEditor();
    const nodeType = editor.schema.nodes.tabStop;
    expect(nodeType.isInline).toBe(true);
    expect(nodeType.isAtom).toBe(true);
    editor.destroy();
  });
});
