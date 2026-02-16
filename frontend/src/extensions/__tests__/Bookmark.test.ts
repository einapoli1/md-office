import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Bookmark } from '../Bookmark';

function createEditor(content = '<p>Hello world</p>') {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Bookmark],
    content,
  });
}

function findNode(json: any, type: string): any {
  if (json.type === type) return json;
  if (json.content) {
    for (const child of json.content) {
      const found = findNode(child, type);
      if (found) return found;
    }
  }
  return null;
}

function findAllNodes(json: any, type: string): any[] {
  const results: any[] = [];
  if (json.type === type) results.push(json);
  if (json.content) {
    for (const child of json.content) {
      results.push(...findAllNodes(child, type));
    }
  }
  return results;
}

describe('Bookmark extension', () => {
  it('registers the bookmark node type', () => {
    const editor = createEditor();
    expect(editor.schema.nodes.bookmark).toBeDefined();
    editor.destroy();
  });

  it('inserts a bookmark', () => {
    const editor = createEditor();
    editor.commands.insertBookmark('Chapter 1');
    const json = editor.getJSON();
    const bm = findNode(json, 'bookmark');
    expect(bm).toBeTruthy();
    expect(bm.attrs.name).toBe('Chapter 1');
    expect(bm.attrs.id).toBe('bookmark-chapter-1');
    editor.destroy();
  });

  it('removes a bookmark by name', () => {
    const editor = createEditor();
    editor.commands.insertBookmark('ToRemove');
    let bm = findNode(editor.getJSON(), 'bookmark');
    expect(bm).toBeTruthy();

    editor.commands.removeBookmark('ToRemove');
    bm = findNode(editor.getJSON(), 'bookmark');
    expect(bm).toBeNull();
    editor.destroy();
  });

  it('sanitizes bookmark id', () => {
    const editor = createEditor();
    editor.commands.insertBookmark('Hello World!');
    const bm = findNode(editor.getJSON(), 'bookmark');
    expect(bm.attrs.id).toBe('bookmark-hello-world');
    editor.destroy();
  });
});
