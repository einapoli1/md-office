import { describe, it, expect, afterEach } from 'vitest';
import { createEditorWithImage } from '../../test/editor-helper';
import type { Editor } from '@tiptap/core';

describe('ImageDrop extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('registers the imageDrop extension', () => {
    editor = createEditorWithImage();
    const ext = editor.extensionManager.extensions.find(e => e.name === 'imageDrop');
    expect(ext).toBeDefined();
  });

  it('adds ProseMirror plugins for drop/paste handling', () => {
    editor = createEditorWithImage();
    // The imageDrop extension should add at least one plugin
    const plugins = editor.state.plugins;
    const hasImageDropPlugin = plugins.some(p => (p as any).key?.includes('imageDrop'));
    expect(hasImageDropPlugin).toBe(true);
  });
});
