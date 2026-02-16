export interface SlideTheme {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export const THEMES: SlideTheme[] = [
  {
    id: 'default',
    name: 'Default',
    vars: {
      '--slide-bg': '#ffffff',
      '--slide-text': '#333333',
      '--slide-accent': '#1a73e8',
      '--slide-heading-font': "'Google Sans', 'Segoe UI', sans-serif",
      '--slide-body-font': "'Roboto', 'Segoe UI', sans-serif",
      '--slide-heading-color': '#202124',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    vars: {
      '--slide-bg': '#1a1a2e',
      '--slide-text': '#e0e0e0',
      '--slide-accent': '#e94560',
      '--slide-heading-font': "'Google Sans', 'Segoe UI', sans-serif",
      '--slide-body-font': "'Roboto', 'Segoe UI', sans-serif",
      '--slide-heading-color': '#ffffff',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    vars: {
      '--slide-bg': '#f5f5f5',
      '--slide-text': '#444444',
      '--slide-accent': '#6c63ff',
      '--slide-heading-font': "'Inter', 'Helvetica Neue', sans-serif",
      '--slide-body-font': "'Inter', 'Helvetica Neue', sans-serif",
      '--slide-heading-color': '#222222',
    },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    vars: {
      '--slide-bg': '#ffffff',
      '--slide-text': '#333333',
      '--slide-accent': '#0d47a1',
      '--slide-heading-font': "'Georgia', serif",
      '--slide-body-font': "'Roboto', 'Segoe UI', sans-serif",
      '--slide-heading-color': '#1a237e',
    },
  },
];

export function getTheme(id: string): SlideTheme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function applyThemeVars(el: HTMLElement, theme: SlideTheme) {
  Object.entries(theme.vars).forEach(([k, v]) => el.style.setProperty(k, v));
}
