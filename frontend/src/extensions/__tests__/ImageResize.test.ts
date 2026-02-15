import { describe, it, expect, afterEach } from 'vitest';
import { createEditorWithImage } from '../../test/editor-helper';
import type { Editor } from '@tiptap/core';

describe('ImageResize extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('registers as image node type', () => {
    editor = createEditorWithImage();
    const imageType = editor.schema.nodes.image;
    expect(imageType).toBeDefined();
  });

  it('stores width and height attributes', () => {
    editor = createEditorWithImage();
    editor.commands.setImage({ src: 'test.png', width: 300, height: 200 });
    const html = editor.getHTML();
    expect(html).toContain('test.png');
    expect(html).toContain('300');
  });

  it('stores alt and title attributes', () => {
    editor = createEditorWithImage();
    editor.commands.setImage({ src: 'img.png', alt: 'My image', title: 'Title' });
    const html = editor.getHTML();
    expect(html).toContain('alt="My image"');
    expect(html).toContain('title="Title"');
  });

  it('image node has all expected attributes in schema', () => {
    editor = createEditorWithImage();
    const imageType = editor.schema.nodes.image;
    const attrNames = Object.keys(imageType.spec.attrs || {});
    expect(attrNames).toContain('src');
    expect(attrNames).toContain('width');
    expect(attrNames).toContain('height');
    expect(attrNames).toContain('alt');
    expect(attrNames).toContain('title');
  });

  it('renders width/height as inline style', () => {
    editor = createEditorWithImage();
    editor.commands.setImage({ src: 'x.png', width: 150, height: 100 });
    const html = editor.getHTML();
    expect(html).toContain('width: 150px');
  });
});
