import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestionInsert: (suggestionId: string) => ReturnType;
      setSuggestionDelete: (suggestionId: string) => ReturnType;
      unsetSuggestion: () => ReturnType;
    };
  }
}

export const SuggestionExtension = Mark.create<SuggestionOptions>({
  name: 'suggestion',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) {
            return {};
          }
          return {
            'data-suggestion-id': attributes.suggestionId,
          };
        },
      },
      suggestionType: {
        default: 'insert',
        parseHTML: (element) => element.getAttribute('data-suggestion-type'),
        renderHTML: (attributes) => ({
          'data-suggestion-type': attributes.suggestionType,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const type = mark.attrs.suggestionType;
    const className = type === 'insert' ? 'suggestion-insert' : 'suggestion-delete';
    
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: className,
      }),
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
    };
  },
});

export default SuggestionExtension;