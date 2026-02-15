import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface PageBreaksOptions {
  pageHeight: number;
  gapHeight: number;
  enabled: boolean;
}

const pageBreaksKey = new PluginKey('pageBreaks');

export const PageBreaks = Extension.create<PageBreaksOptions>({
  name: 'pageBreaks',

  addOptions() {
    return {
      pageHeight: 1056,
      gapHeight: 24,
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: pageBreaksKey,

        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, decoSet) {
            const meta = tr.getMeta(pageBreaksKey);
            if (meta?.decos !== undefined) {
              return meta.decos;
            }
            if (tr.docChanged) {
              return decoSet.map(tr.mapping, tr.doc);
            }
            return decoSet;
          },
        },

        props: {
          decorations(state) {
            return pageBreaksKey.getState(state);
          },
        },

        view(editorView) {
          let pending = false;
          let isOwnDispatch = false;

          const calculate = () => {
            pending = false;
            if (!options.enabled) return;

            const view = editorView;
            const dom = view.dom as HTMLElement;
            const { pageHeight, gapHeight } = options;

            // Step 1: Clear existing decorations so we measure clean layout
            const currentDecos = pageBreaksKey.getState(view.state);
            if (currentDecos && currentDecos !== DecorationSet.empty) {
              isOwnDispatch = true;
              const clearTr = view.state.tr.setMeta(pageBreaksKey, { decos: DecorationSet.empty });
              view.dispatch(clearTr);
              isOwnDispatch = false;
              // Force reflow after clearing
              void dom.offsetHeight;
            }

            // Step 2: Measure which elements cross page boundaries
            const pmRect = dom.getBoundingClientRect();
            const children = Array.from(dom.children) as HTMLElement[];

            let pageBottom = pageHeight;
            let cumulativeOffset = 0;
            const breaks: { domIndex: number; pushPx: number }[] = [];

            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              const rect = child.getBoundingClientRect();
              const elTop = rect.top - pmRect.top - cumulativeOffset;
              const elBottom = rect.bottom - pmRect.top - cumulativeOffset;

              if (elBottom > pageBottom && elTop < pageBottom) {
                const pushAmount = (pageBottom - elTop) + gapHeight;
                breaks.push({ domIndex: i, pushPx: pushAmount });
                cumulativeOffset += pushAmount;
                pageBottom += pageHeight;
              } else if (elTop >= pageBottom) {
                pageBottom += pageHeight;
                i--;
                continue;
              }
            }

            if (breaks.length === 0) return;

            // Step 3: Map DOM indices to ProseMirror positions
            const decorations: Decoration[] = [];
            for (const brk of breaks) {
              const child = children[brk.domIndex];
              if (!child) continue;

              try {
                const pmPos = view.posAtDOM(child, 0);
                const resolved = view.state.doc.resolve(pmPos);
                const nodeStart = resolved.before(1);
                const nodeEnd = resolved.after(1);

                decorations.push(
                  Decoration.node(nodeStart, nodeEnd, {
                    style: `margin-top: ${brk.pushPx}px`,
                    'data-page-break': String(brk.domIndex),
                  })
                );

                // Track page number: breaks array index + 1 = page that just ended
                const pageNum = breaks.indexOf(brk) + 1;

                decorations.push(
                  Decoration.widget(nodeStart, () => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'page-break-gap-wrapper';
                    Object.assign(wrapper.style, {
                      position: 'relative',
                      marginLeft: '-72px',
                      marginRight: '-72px',
                      width: 'calc(100% + 144px)',
                      pointerEvents: 'none',
                      zIndex: '20',
                    });

                    // Page number for the page that just ended
                    const pageNumEl = document.createElement('div');
                    pageNumEl.className = 'page-number';
                    pageNumEl.textContent = String(pageNum);

                    // Gap between pages
                    const gap = document.createElement('div');
                    gap.className = 'page-break-gap';
                    Object.assign(gap.style, {
                      height: `${gapHeight}px`,
                      width: '100%',
                      backgroundColor: '#f0f2f4',
                      boxShadow: 'inset 0 3px 5px -3px rgba(0,0,0,0.15), inset 0 -3px 5px -3px rgba(0,0,0,0.15)',
                    });

                    // Header area for next page (shows page number for last page via CSS)
                    const headerArea = document.createElement('div');
                    headerArea.className = 'page-header-area';
                    headerArea.setAttribute('data-page', String(pageNum + 1));

                    wrapper.appendChild(pageNumEl);
                    wrapper.appendChild(gap);
                    wrapper.appendChild(headerArea);
                    return wrapper;
                  }, { side: -1, key: `pb-${brk.domIndex}` })
                );
              } catch {
                // posAtDOM can throw if element isn't in the PM tree
                continue;
              }
            }

            if (decorations.length === 0) return;

            // Step 4: Apply decorations
            isOwnDispatch = true;
            const decos = DecorationSet.create(view.state.doc, decorations);
            const tr = view.state.tr.setMeta(pageBreaksKey, { decos });
            view.dispatch(tr);
            isOwnDispatch = false;
          };

          const scheduleCalc = () => {
            if (pending) return;
            pending = true;
            setTimeout(calculate, 150);
          };

          // Initial
          setTimeout(scheduleCalc, 500);

          return {
            update(view, prevState) {
              if (isOwnDispatch) return; // Skip our own decoration transactions
              if (!prevState.doc.eq(view.state.doc)) {
                scheduleCalc();
              }
            },
            destroy() {},
          };
        },
      }),
    ];
  },
});
