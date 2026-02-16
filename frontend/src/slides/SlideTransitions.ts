// Extended slide transitions — CSS-only animations

export type ExtendedTransitionType =
  | 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up'
  | 'zoom' | 'dissolve' | 'wipe'
  // New transitions
  | 'morph' | 'zoom-rotate' | 'curtain' | 'flip' | 'cube' | 'swipe';

export interface TransitionDef {
  name: string;
  label: string;
  css: string; // keyframes CSS
  className: string;
}

export const EXTENDED_TRANSITIONS: TransitionDef[] = [
  { name: 'none', label: 'No transition', css: '', className: '' },
  { name: 'fade', label: 'Fade', css: '', className: 'slideshow-trans-fade' },
  { name: 'slide-left', label: 'Slide Left', css: '', className: 'slideshow-trans-slide-left' },
  { name: 'slide-right', label: 'Slide Right', css: '', className: 'slideshow-trans-slide-right' },
  { name: 'slide-up', label: 'Slide Up', css: '', className: 'slideshow-trans-slide-up' },
  { name: 'zoom', label: 'Zoom', css: '', className: 'slideshow-trans-zoom' },
  { name: 'dissolve', label: 'Dissolve', css: '', className: 'slideshow-trans-dissolve' },
  { name: 'wipe', label: 'Wipe', css: '', className: 'slideshow-trans-wipe' },
  { name: 'morph', label: 'Morph', css: '', className: 'slideshow-trans-morph' },
  { name: 'zoom-rotate', label: 'Zoom Rotate', css: '', className: 'slideshow-trans-zoom-rotate' },
  { name: 'curtain', label: 'Curtain', css: '', className: 'slideshow-trans-curtain' },
  { name: 'flip', label: 'Flip', css: '', className: 'slideshow-trans-flip' },
  { name: 'cube', label: 'Cube', css: '', className: 'slideshow-trans-cube' },
  { name: 'swipe', label: 'Swipe', css: '', className: 'slideshow-trans-swipe' },
];

/** Get transition class name for a given transition type */
export function getTransitionClass(type: string): string {
  const t = EXTENDED_TRANSITIONS.find(t => t.name === type);
  return t?.className || '';
}
