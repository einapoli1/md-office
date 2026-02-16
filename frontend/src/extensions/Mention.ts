import { Mention as TiptapMention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import MentionList from '../components/MentionList';

export interface MentionUser {
  id: string;
  name: string;
  email?: string;
}

export const SAMPLE_USERS: MentionUser[] = [
  { id: '1', name: 'Jack Napoli', email: 'jack@example.com' },
  { id: '2', name: 'Eva', email: 'eva@example.com' },
  { id: '3', name: 'Guest User', email: 'guest@example.com' },
];

export const MentionExtension = TiptapMention.configure({
  HTMLAttributes: {
    class: 'mention-chip',
  },
  suggestion: {
    items: ({ query }: { query: string }) => {
      return SAMPLE_USERS.filter((user) =>
        user.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props: any) {
          component?.updateProps(props);
          if (!props.clientRect) return;
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return (component?.ref as any)?.onKeyDown(props);
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  },
});

export default MentionExtension;
