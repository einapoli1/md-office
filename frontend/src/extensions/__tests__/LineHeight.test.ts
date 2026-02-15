import { describe, it, expect, afterEach } from 'vitest';
import { createEditorWithLineHeight } from '../../test/editor-helper';
import type { Editor } from '@tiptap/core';

describe('LineHeight extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('registers the lineHeight extension', () => {
    editor = createEditorWithLineHeight();
    const ext = editor.extensionManager.extensions.find(e => e.name === 'lineHeight');
    expect(ext).toBeDefined();
  });

  it('paragraph has lineHeight attribute defaulting to null', () => {
    editor = createEditorWithLineHeight('<p>Test</p>');
    const attrs = editor.getAttributes('paragraph');
    expect(attrs.lineHeight).toBeNull();
  });

  it('setLineHeight command updates paragraph lineHeight', () => {
    editor = createEditorWithLineHeight('<p>Test paragraph</p>');
    editor.commands.selectAll();
    editor.commands.setLineHeight('1.5');
    const attrs = editor.getAttributes('paragraph');
    expect(attrs.lineHeight).toBe('1.5');
  });

  it('setLineHeight renders as inline style', () => {
    editor = createEditorWithLineHeight('<p>Test</p>');
    editor.commands.selectAll();
    editor.commands.setLineHeight('2');
    const html = editor.getHTML();
    expect(html).toContain('line-height: 2');
  });

  it('parses lineHeight from HTML style', () => {
    editor = createEditorWithLineHeight('<p style="line-height: 1.8">Styled</p>');
    const attrs = editor.getAttributes('paragraph');
    expect(attrs.lineHeight).toBe('1.8');
  });
});
