import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { LineHeight } from '../extensions/LineHeight';
import { ImageResize } from '../extensions/ImageResize';
import { ImageDrop } from '../extensions/ImageDrop';

export function createTestEditor(options: {
  content?: string;
  extensions?: any[];
} = {}) {
  const { content = '<p>Hello world</p>', extensions = [] } = options;

  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit,
      ...extensions,
    ],
    content,
  });

  return editor;
}

export function createEditorWithLineHeight(content?: string) {
  return createTestEditor({
    content,
    extensions: [LineHeight],
  });
}

export function createEditorWithImage(content?: string) {
  return createTestEditor({
    content,
    extensions: [ImageResize, ImageDrop],
  });
}
