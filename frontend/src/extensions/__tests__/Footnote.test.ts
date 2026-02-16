import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Footnote } from '../Footnote';

function createEditor(content = '<p>Hello world</p>') {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Footnote],
    content,
  });
}

describe('Footnote extension', () => {
  it('registers the footnote node type', () => {
    const editor = createEditor();
    expect(editor.schema.nodes.footnote).toBeDefined();
    editor.destroy();
  });

  it('inserts a footnote via command', () => {
    const editor = createEditor();
    editor.commands.setFootnote('This is a note');
    const json = editor.getJSON();
    const footnoteNode = findNode(json, 'footnote');
    expect(footnoteNode).toBeTruthy();
    expect(footnoteNode.attrs.content).toBe('This is a note');
    editor.destroy();
  });

  it('auto-numbers multiple footnotes', () => {
    const editor = createEditor('<p>First sentence. Second sentence.</p>');
    // Move to end and insert two footnotes
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.setFootnote('Note one');
    editor.commands.setFootnote('Note two');

    const json = editor.getJSON();
    const footnotes = findAllNodes(json, 'footnote');
    expect(footnotes.length).toBe(2);
    // Each should have a unique id
    expect(footnotes[0].attrs.id).not.toBe(footnotes[1].attrs.id);
    editor.destroy();
  });

  it('insertFootnote is an alias for setFootnote', () => {
    const editor = createEditor();
    editor.commands.insertFootnote('Alias test');
    const json = editor.getJSON();
    const fn = findNode(json, 'footnote');
    expect(fn).toBeTruthy();
    expect(fn.attrs.content).toBe('Alias test');
    editor.destroy();
  });
});

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
