import type { Editor } from '@tiptap/core';

export interface FormFieldData {
  fieldId: string;
  fieldType: string;
  label: string;
  value: string;
  required: boolean;
}

export interface FormValidationError {
  fieldId: string;
  label: string;
  message: string;
}

export function collectFormData(editor: Editor): FormFieldData[] {
  const fields: FormFieldData[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'formField') {
      fields.push({
        fieldId: node.attrs.fieldId,
        fieldType: node.attrs.fieldType,
        label: node.attrs.label,
        value: node.attrs.value || '',
        required: node.attrs.required,
      });
    }
  });
  return fields;
}

export function validateForm(editor: Editor): FormValidationError[] {
  const errors: FormValidationError[] = [];
  const data = collectFormData(editor);
  for (const field of data) {
    if (field.required && (!field.value || field.value === '' || field.value === 'false')) {
      errors.push({
        fieldId: field.fieldId,
        label: field.label,
        message: `"${field.label}" is required`,
      });
    }
  }
  return errors;
}

export function exportFormAsJSON(editor: Editor): void {
  const data = collectFormData(editor);
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, 'form-data.json', 'application/json');
}

export function exportFormAsCSV(editor: Editor): void {
  const data = collectFormData(editor);
  if (data.length === 0) return;

  const headers = ['fieldId', 'fieldType', 'label', 'value', 'required'];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    headers.join(','),
    ...data.map((f) =>
      [f.fieldId, f.fieldType, f.label, f.value, String(f.required)].map(escape).join(',')
    ),
  ];
  downloadFile(rows.join('\n'), 'form-data.csv', 'text/csv');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
