import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';

export interface SuggestionOptions {
  HTMLAttributes: Record<string, any>;
  onSuggestionClick?: (suggestionId: string) => void;
}

export const suggestionModeKey = new PluginKey('suggestionMode');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestionInsert: (suggestionId: string) => ReturnType;
      setSuggestionDelete: (suggestionId: string) => ReturnType;
      unsetSuggestion: () => ReturnType;
      toggleSuggestionMode: () => ReturnType;
    };
  }
}

export const SuggestionExtension = Mark.create<SuggestionOptions>({
  name: 'suggestion',

  addOptions() {
    return {
      HTMLAttributes: {},
      onSuggestionClick: undefined,
    };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) return {};
          return { 'data-suggestion-id': attributes.suggestionId };
        },
      },
      suggestionType: {
        default: 'insert',
        parseHTML: (element) => element.getAttribute('data-suggestion-type'),
        renderHTML: (attributes) => ({
          'data-suggestion-type': attributes.suggestionType,
        }),
      },
      author: {
        default: 'Guest',
        parseHTML: (element) => element.getAttribute('data-suggestion-author'),
        renderHTML: (attributes) => ({
          'data-suggestion-author': attributes.author,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const type = mark.attrs.suggestionType;
    const className = type === 'insert' ? 'suggestion-insert' : 'suggestion-delete';
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: className }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionInsert:
        (suggestionId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { suggestionId, suggestionType: 'insert' });
        },
      setSuggestionDelete:
        (suggestionId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { suggestionId, suggestionType: 'delete' });
        },
      unsetSuggestion:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleSuggestionMode:
        () =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            const current = suggestionModeKey.getState(state) ?? false;
            tr.setMeta(suggestionModeKey, !current);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const markType = this.type;
    const onSuggestionClick = this.options.onSuggestionClick;

    return [
      // Suggestion mode state tracker
      new Plugin({
        key: suggestionModeKey,
        state: {
          init() { return false; },
          apply(tr, value) {
            const meta = tr.getMeta(suggestionModeKey);
            if (meta !== undefined) return meta;
            return value;
          },
        },
      }),

      // Input interceptor — in suggestion mode, wrap typed text with insert marks
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            const isSuggestionMode = suggestionModeKey.getState(view.state);
            if (!isSuggestionMode) return false;

            const suggestionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const { tr } = view.state;

            // If there's a selection (from !== to), mark the deleted text
            if (from !== to) {
              const deleteId = `s-${Date.now()}-del`;
              tr.addMark(from, to, markType.create({ suggestionId: deleteId, suggestionType: 'delete' }));
              // Don't actually delete — just mark it
              // Insert new text after the selection with insert mark
              tr.insertText(text, to);
              tr.addMark(to, to + text.length, markType.create({ suggestionId, suggestionType: 'insert' }));
            } else {
              // Simple insert
              tr.insertText(text, from);
              tr.addMark(from, from + text.length, markType.create({ suggestionId, suggestionType: 'insert' }));
            }

            // Preserve suggestion mode
            tr.setMeta(suggestionModeKey, true);
            view.dispatch(tr);

            // Notify about new suggestion
            window.dispatchEvent(new CustomEvent('suggestion-add', {
              detail: { suggestionId, type: 'insert', text },
            }));

            return true; // Handled
          },

          handleKeyDown(view, event) {
            const isSuggestionMode = suggestionModeKey.getState(view.state);
            if (!isSuggestionMode) return false;

            // Handle delete/backspace in suggestion mode
            if (event.key === 'Backspace' || event.key === 'Delete') {
              const { from, to, empty } = view.state.selection;
              if (empty) {
                // Single char delete
                const deleteFrom = event.key === 'Backspace' ? from - 1 : from;
                const deleteTo = event.key === 'Backspace' ? from : to + 1;
                if (deleteFrom < 0) return true;

                // Check if the char is already a suggestion-insert — if so, just remove it
                const node = view.state.doc.nodeAt(deleteFrom);
                if (node) {
                  const marks = view.state.doc.resolve(deleteFrom).marksAcross(view.state.doc.resolve(deleteTo));
                  const insertMark = marks?.find((m: any) => m.type === markType && m.attrs.suggestionType === 'insert');
                  if (insertMark) {
                    // Deleting a suggested insert — just remove it entirely
                    const tr = view.state.tr.delete(deleteFrom, deleteTo);
                    tr.setMeta(suggestionModeKey, true);
                    view.dispatch(tr);
                    return true;
                  }
                }

                // Mark as deletion suggestion
                const suggestionId = `s-${Date.now()}-del`;
                const tr = view.state.tr.addMark(
                  deleteFrom, deleteTo,
                  markType.create({ suggestionId, suggestionType: 'delete' })
                );
                // Move cursor past the "deleted" char
                tr.setSelection(Selection.near(tr.doc.resolve(deleteTo)));
                tr.setMeta(suggestionModeKey, true);
                view.dispatch(tr);

                window.dispatchEvent(new CustomEvent('suggestion-add', {
                  detail: { suggestionId, type: 'delete' },
                }));
                return true;
              } else {
                // Selection delete — mark whole selection as delete
                const suggestionId = `s-${Date.now()}-del`;
                const tr = view.state.tr.addMark(
                  from, to,
                  markType.create({ suggestionId, suggestionType: 'delete' })
                );
                tr.setMeta(suggestionModeKey, true);
                view.dispatch(tr);

                window.dispatchEvent(new CustomEvent('suggestion-add', {
                  detail: { suggestionId, type: 'delete' },
                }));
                return true;
              }
            }

            return false;
          },

          handleClick(view, pos) {
            if (!onSuggestionClick) return false;
            const marks = view.state.doc.resolve(pos).marks();
            const sugMark = marks.find((m: any) => m.type === markType);
            if (sugMark) {
              onSuggestionClick(sugMark.attrs.suggestionId);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default SuggestionExtension;
