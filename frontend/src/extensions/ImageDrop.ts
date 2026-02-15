import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const imageDropPluginKey = new PluginKey('imageDrop');

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageDrop = Extension.create({
  name: 'imageDrop',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: imageDropPluginKey,
        props: {
          handleDOMEvents: {
            dragover(view, event) {
              const hasFiles = event.dataTransfer?.types?.includes('Files');
              if (hasFiles) {
                event.preventDefault();
                view.dom.closest('.google-docs-editor')?.classList.add('image-drag-over');
              }
              return false;
            },
            dragleave(view, event) {
              const related = event.relatedTarget as Node | null;
              const editorWrapper = view.dom.closest('.google-docs-editor');
              if (editorWrapper && (!related || !editorWrapper.contains(related))) {
                editorWrapper.classList.remove('image-drag-over');
              }
              return false;
            },
            drop(view, event) {
              view.dom.closest('.google-docs-editor')?.classList.remove('image-drag-over');

              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;

              const images = Array.from(files).filter(f => f.type.startsWith('image/'));
              if (images.length === 0) return false;

              event.preventDefault();

              // Get drop position in document
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });

              images.forEach(async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                if (pos) {
                  editor.chain().focus().setTextSelection(pos.pos).setImage({ src: dataUrl }).run();
                } else {
                  editor.chain().focus().setImage({ src: dataUrl }).run();
                }
              });

              return true;
            },
          },
          handlePaste(view, event) {
            const files = event.clipboardData?.files;
            if (!files || files.length === 0) return false;

            const images = Array.from(files).filter(f => f.type.startsWith('image/'));
            if (images.length === 0) return false;

            event.preventDefault();

            images.forEach(async (file) => {
              const dataUrl = await readFileAsDataUrl(file);
              editor.chain().focus().setImage({ src: dataUrl }).run();
            });

            return true;
          },
        },
      }),
    ];
  },
});
