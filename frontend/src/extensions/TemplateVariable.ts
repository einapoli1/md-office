import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * TipTap extension that decorates {{variable}} syntax with pill/chip styling.
 * This is purely decorative — it doesn't change the document structure.
 */
export const TemplateVariable = Extension.create({
  name: 'templateVariable',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('templateVariable'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              const re = /\{\{(?:#each\s+\w+|\/each|#if\s+[\w.]+|\/if|else|(?:[a-zA-Z_][\w.]*))\}\}/g;
              let match: RegExpExecArray | null;
              while ((match = re.exec(text))) {
                const from = pos + match.index;
                const to = from + match[0].length;
                const content = match[0].slice(2, -2).trim();
                const isBlock = content.startsWith('#') || content.startsWith('/') || content === 'else';
                decorations.push(
                  Decoration.inline(from, to, {
                    class: isBlock ? 'template-variable-block' : 'template-variable',
                    'data-template-var': content,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
      new Plugin({
        key: new PluginKey('templateVariableClick'),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList?.contains('template-variable')) {
              const varName = target.getAttribute('data-template-var');
              if (varName) {
                window.dispatchEvent(
                  new CustomEvent('template-variable-click', { detail: { variable: varName } })
                );
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default TemplateVariable;
