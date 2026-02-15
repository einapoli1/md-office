import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface ImageResizeOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageResize: {
      setImage: (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) => ReturnType;
    };
  }
}

const imageResizePluginKey = new PluginKey('imageResize');

export const ImageResize = Node.create<ImageResizeOptions>({
  name: 'image',
  
  addOptions() {
    return {
      inline: true,
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, any> = {};
    if (HTMLAttributes.width) attrs.style = `width: ${HTMLAttributes.width}px; height: ${HTMLAttributes.height ? HTMLAttributes.height + 'px' : 'auto'};`;
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs)];
  },

  addCommands() {
    return {
      setImage: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },

  addProseMirrorPlugins() {
    let resizing: {
      node: HTMLImageElement;
      pos: number;
      handle: string;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
      aspectRatio: number;
    } | null = null;

    return [
      new Plugin({
        key: imageResizePluginKey,
        props: {
          decorations(state) {
            const { selection } = state;
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'image') return;
              
              // Check if this image node is selected
              const nodeFrom = pos;
              const nodeTo = pos + node.nodeSize;
              const isSelected = selection.from <= nodeFrom && selection.to >= nodeTo;
              
              if (isSelected) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'image-resize-selected',
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },

          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList.contains('image-resize-handle')) return false;

              event.preventDefault();
              event.stopPropagation();

              const handle = target.dataset.handle!;
              const wrapper = target.closest('.image-resize-selected') as HTMLElement;
              if (!wrapper) return false;

              const img = wrapper.querySelector('img') || wrapper as HTMLImageElement;
              if (!img || img.tagName !== 'IMG') return false;

              // Find the node position
              const pos = view.posAtDOM(img, 0);
              const startWidth = img.clientWidth || img.naturalWidth || 200;
              const startHeight = img.clientHeight || img.naturalHeight || 200;

              resizing = {
                node: img,
                pos,
                handle,
                startX: event.clientX,
                startY: event.clientY,
                startWidth,
                startHeight,
                aspectRatio: startWidth / startHeight,
              };

              const onMouseMove = (e: MouseEvent) => {
                if (!resizing) return;

                const dx = e.clientX - resizing.startX;
                const dy = e.clientY - resizing.startY;
                let newWidth = resizing.startWidth;
                let newHeight = resizing.startHeight;
                const isCorner = ['nw', 'ne', 'sw', 'se'].includes(resizing.handle);

                switch (resizing.handle) {
                  case 'se':
                    newWidth = Math.max(50, resizing.startWidth + dx);
                    newHeight = newWidth / resizing.aspectRatio;
                    break;
                  case 'sw':
                    newWidth = Math.max(50, resizing.startWidth - dx);
                    newHeight = newWidth / resizing.aspectRatio;
                    break;
                  case 'ne':
                    newWidth = Math.max(50, resizing.startWidth + dx);
                    newHeight = newWidth / resizing.aspectRatio;
                    break;
                  case 'nw':
                    newWidth = Math.max(50, resizing.startWidth - dx);
                    newHeight = newWidth / resizing.aspectRatio;
                    break;
                  case 'e':
                    newWidth = Math.max(50, resizing.startWidth + dx);
                    break;
                  case 'w':
                    newWidth = Math.max(50, resizing.startWidth - dx);
                    break;
                  case 'n':
                    newHeight = Math.max(50, resizing.startHeight - dy);
                    break;
                  case 's':
                    newHeight = Math.max(50, resizing.startHeight + dy);
                    break;
                }

                if (isCorner && newHeight < 50) {
                  newHeight = 50;
                  newWidth = 50 * resizing.aspectRatio;
                }

                resizing.node.style.width = `${newWidth}px`;
                resizing.node.style.height = `${newHeight}px`;
              };

              const onMouseUp = () => {
                if (resizing) {
                  const width = Math.round(parseFloat(resizing.node.style.width));
                  const height = Math.round(parseFloat(resizing.node.style.height));
                  
                  // Update the node attributes
                  const { state } = view;
                  let nodePos = -1;
                  state.doc.descendants((node, pos) => {
                    if (pos === resizing!.pos || (node.type.name === 'image' && node.attrs.src === resizing!.node.getAttribute('src'))) {
                      // Try exact position first
                      if (pos === resizing!.pos) nodePos = pos;
                      else if (nodePos === -1) nodePos = pos;
                    }
                  });

                  if (nodePos >= 0) {
                    const tr = state.tr.setNodeMarkup(nodePos, undefined, {
                      ...state.doc.nodeAt(nodePos)!.attrs,
                      width,
                      height,
                    });
                    view.dispatch(tr);
                  }

                  resizing = null;
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };

              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);

              return true;
            },
          },
        },
      }),
      // Plugin to add resize handles to selected images
      new Plugin({
        props: {
          decorations(state) {
            const { selection } = state;
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'image') return;

              const nodeFrom = pos;
              const nodeTo = pos + node.nodeSize;
              const isSelected = selection.from <= nodeFrom && selection.to >= nodeTo;

              if (isSelected) {
                // We use a widget decoration after the image to inject handles
                // The handles are rendered via CSS on .image-resize-selected
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },

        view() {
          return {
            update(view) {
              // Remove old handles
              view.dom.querySelectorAll('.image-resize-handle').forEach(el => el.remove());

              // Add handles to selected images
              view.dom.querySelectorAll('.image-resize-selected img, img.image-resize-selected').forEach((img) => {
                const parent = img.parentElement;
                if (!parent) return;
                
                // Make parent relative for handle positioning
                const target = img.tagName === 'IMG' ? img : img;
                const container = target.parentElement!;
                
                // Check if handles already exist
                if (container.querySelector('.image-resize-handle')) return;

                // Ensure positioning context
                const computedStyle = window.getComputedStyle(container);
                if (computedStyle.position === 'static') {
                  container.style.position = 'relative';
                }
                container.style.display = 'inline-block';

                const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
                handles.forEach(h => {
                  const handle = document.createElement('div');
                  handle.className = `image-resize-handle image-resize-handle-${h}`;
                  handle.dataset.handle = h;
                  handle.contentEditable = 'false';
                  container.appendChild(handle);
                });

                // Apply stored dimensions
                const imgEl = target as HTMLImageElement;
                const nodePos = view.posAtDOM(imgEl, 0);
                const node = view.state.doc.nodeAt(nodePos);
                if (node?.attrs.width) {
                  imgEl.style.width = `${node.attrs.width}px`;
                  imgEl.style.height = `${node.attrs.height}px`;
                }
              });
            },
          };
        },
      }),
    ];
  },
});
