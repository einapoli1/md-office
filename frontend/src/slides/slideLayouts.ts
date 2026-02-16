import { SlideLayout } from './slideModel';

export interface LayoutDef {
  name: SlideLayout;
  label: string;
  description: string;
  icon: string; // emoji
}

export const LAYOUTS: LayoutDef[] = [
  { name: 'title', label: 'Title Slide', description: 'Large centered heading + subtitle', icon: '🎯' },
  { name: 'content', label: 'Content', description: 'Heading + body content', icon: '📝' },
  { name: 'two-column', label: 'Two Column', description: 'Split left/right layout', icon: '▥' },
  { name: 'image', label: 'Image', description: 'Full or half-slide image', icon: '🖼️' },
  { name: 'section', label: 'Section', description: 'Large text divider', icon: '📌' },
  { name: 'blank', label: 'Blank', description: 'Empty canvas', icon: '⬜' },
];

export function getLayout(name: SlideLayout): LayoutDef {
  return LAYOUTS.find(l => l.name === name) || LAYOUTS[1];
}
