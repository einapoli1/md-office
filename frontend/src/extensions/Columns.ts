import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count: number) => ReturnType;
    };
  }
}

export const Columns = Extension.create({
  name: 'columns',

  addOptions() {
    return {
      columnGap: 40,
    };
  },

  addStorage() {
    return {
      columnCount: 1,
    };
  },

  addCommands() {
    return {
      setColumns:
        (count: number) =>
        ({ editor }) => {
          this.storage.columnCount = count;
          const editorElement = editor.view.dom;
          if (count <= 1) {
            editorElement.style.columnCount = '';
            editorElement.style.columnGap = '';
            editorElement.classList.remove('columns-2', 'columns-3');
          } else {
            editorElement.style.columnCount = String(count);
            editorElement.style.columnGap = `${this.options.columnGap}px`;
            editorElement.classList.remove('columns-2', 'columns-3');
            editorElement.classList.add(`columns-${count}`);
          }
          return true;
        },
    };
  },
});
