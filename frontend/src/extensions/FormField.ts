import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FormFieldView from '../components/FormFieldView';
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type FormFieldType = 'text-input' | 'dropdown' | 'checkbox' | 'date-picker' | 'signature';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formField: {
      insertFormField: (fieldType: FormFieldType, attrs?: Partial<FormFieldAttrs>) => ReturnType;
    };
  }
}

export interface FormFieldAttrs {
  fieldId: string;
  fieldType: FormFieldType;
  label: string;
  placeholder: string;
  options: string[];
  required: boolean;
  value: string;
}

export const FormField = Node.create({
  name: 'formField',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-field-id'),
      },
      fieldType: {
        default: 'text-input' as FormFieldType,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-field-type'),
      },
      label: { default: '' },
      placeholder: { default: '' },
      options: {
        default: [] as string[],
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-options');
          try { return raw ? JSON.parse(raw) : []; } catch { return []; }
        },
        renderHTML: (attrs: Record<string, any>) => ({
          'data-options': JSON.stringify(attrs.options),
        }),
      },
      required: { default: false },
      value: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-form-field]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-form-field': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FormFieldView);
  },

  addCommands() {
    return {
      insertFormField:
        (fieldType: FormFieldType, attrs?: Partial<FormFieldAttrs>) =>
        ({ commands }: any) => {
          const defaults: Record<FormFieldType, Partial<FormFieldAttrs>> = {
            'text-input': { label: 'Text Field', placeholder: 'Enter text...' },
            'dropdown': { label: 'Dropdown', placeholder: 'Select...', options: ['Option 1', 'Option 2', 'Option 3'] },
            'checkbox': { label: 'Checkbox' },
            'date-picker': { label: 'Date', placeholder: 'Pick a date...' },
            'signature': { label: 'Signature' },
          };
          return commands.insertContent({
            type: 'formField',
            attrs: {
              fieldId: uuidv4(),
              fieldType,
              ...defaults[fieldType],
              ...attrs,
            },
          });
        },
    };
  },
});

export default FormField;
