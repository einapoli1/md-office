/**
 * EquationEvaluator — ProseMirror plugin that scans math nodes,
 * evaluates them against document variable chips, and renders results
 * as decorations appended after the equation.
 */
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core';
import { collectVariables } from './VariableChip';
import { solveEquation, formatResult } from '../utils/mathSolver';

const equationEvalKey = new PluginKey('equationEvaluator');

export const EquationEvaluator = Extension.create({
  name: 'equationEvaluator',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: equationEvalKey,

        state: {
          init(_, state) {
            return buildDecorations(state);
          },
          apply(tr, oldDecos, _oldState, newState) {
            // Recompute on any doc or variable change
            if (tr.docChanged || tr.getMeta('variableChanged')) {
              return buildDecorations(newState);
            }
            return oldDecos.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },

        view() {
          return {
            update(view) {
              // Listen for variable-changed events
              const handler = () => {
                const tr = view.state.tr.setMeta('variableChanged', true);
                view.dispatch(tr);
              };
              window.addEventListener('variable-changed', handler);
              // Store cleanup
              (this as any)._cleanup = () => window.removeEventListener('variable-changed', handler);
            },
            destroy() {
              (this as any)?._cleanup?.();
            },
          };
        },
      }),
    ];
  },
});

function buildDecorations(state: any): DecorationSet {
  const variables = collectVariables(state.doc);
  const decorations: Decoration[] = [];

  state.doc.descendants((node: any, pos: number) => {
    // The Mathematics extension renders inline/block math as nodes
    // with type 'math' or similar. Check for text with $ delimiters or math nodes.
    if (node.type.name === 'mathematics') {
      const latex = node.attrs?.latex || node.textContent || '';
      if (!latex) return;

      const { result, missing } = solveEquation(latex, variables);
      const endPos = pos + node.nodeSize;

      if (result !== null && missing.length === 0) {
        const widget = Decoration.widget(endPos, () => {
          const span = document.createElement('span');
          span.className = 'equation-result solved';
          span.textContent = ` = ${formatResult(result)}`;
          span.title = 'Computed result';
          return span;
        }, { side: 1 });
        decorations.push(widget);
      } else if (missing.length > 0) {
        const widget = Decoration.widget(endPos, () => {
          const span = document.createElement('span');
          span.className = 'equation-result unsolved';
          span.textContent = ' ?';
          span.title = `Missing variables: ${missing.join(', ')}`;
          return span;
        }, { side: 1 });
        decorations.push(widget);
      }
    }
  });

  return DecorationSet.create(state.doc, decorations);
}

export default EquationEvaluator;
