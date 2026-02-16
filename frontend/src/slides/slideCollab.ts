/**
 * Yjs collaboration layer for MD Slides.
 * Uses Y.Array<Y.Map> for slides, Y.Map for presentation metadata, awareness for cursors.
 */
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getUserColor } from '../utils/collabColors';
import type { Slide, SlideLayout, TransitionType, TransitionDuration, SlideShape, Fragment, PresentationMeta, Presentation } from './slideModel';
import { genSlideId } from './slideModel';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SlideAwarenessState {
  user: { name: string; color: string };
  activeSlide: number;
  cursorX: number | null;
  cursorY: number | null;
}

export interface RemoteSlideUser {
  name: string;
  color: string;
  activeSlide: number;
  cursorX: number | null;
  cursorY: number | null;
  clientId: number;
}

// ── Yjs accessors ──────────────────────────────────────────────────────────

function getSlidesArray(ydoc: Y.Doc): Y.Array<Y.Map<any>> {
  return ydoc.getArray('slides');
}

function getPresMeta(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap('presentation_meta');
}

function getMasterMap(ydoc: Y.Doc): Y.Map<any> {
  return ydoc.getMap('slide_master');
}

// ── Convert Slide ↔ Y.Map ──────────────────────────────────────────────────

function slideToYMap(slide: Slide, _ydoc: Y.Doc): Y.Map<any> {
  const ymap = new Y.Map<any>();
  ymap.set('id', slide.id);
  ymap.set('content', slide.content);
  ymap.set('layout', slide.layout);
  ymap.set('notes', slide.notes);
  ymap.set('transition', slide.transition);
  ymap.set('transitionDuration', slide.transitionDuration);
  ymap.set('shapes', JSON.stringify(slide.shapes));
  ymap.set('fragments', JSON.stringify(slide.fragments));
  return ymap;
}

function ymapToSlide(ymap: Y.Map<any>): Slide {
  return {
    id: (ymap.get('id') as string) || genSlideId(),
    content: (ymap.get('content') as string) || '',
    layout: (ymap.get('layout') as SlideLayout) || 'content',
    notes: (ymap.get('notes') as string) || '',
    transition: (ymap.get('transition') as TransitionType) || 'none',
    transitionDuration: (ymap.get('transitionDuration') as TransitionDuration) || '0.3s',
    shapes: safeJsonParse<SlideShape[]>(ymap.get('shapes') as string, []),
    fragments: safeJsonParse<Fragment[]>(ymap.get('fragments') as string, []),
  };
}

// ── Sync local → Yjs ──────────────────────────────────────────────────────

export function syncPresentationToYjs(pres: Presentation, ydoc: Y.Doc): void {
  ydoc.transact(() => {
    // Meta
    const metaMap = getPresMeta(ydoc);
    metaMap.set('title', pres.meta.title);
    metaMap.set('theme', pres.meta.theme);
    metaMap.set('aspectRatio', pres.meta.aspectRatio);

    // Slides
    const yslides = getSlidesArray(ydoc);
    yslides.delete(0, yslides.length);
    for (const slide of pres.slides) {
      yslides.push([slideToYMap(slide, ydoc)]);
    }
  });
}

// ── Sync Yjs → local ──────────────────────────────────────────────────────

export function syncPresentationFromYjs(ydoc: Y.Doc): Presentation {
  const metaMap = getPresMeta(ydoc);
  const meta: PresentationMeta = {
    title: (metaMap.get('title') as string) || 'Untitled',
    theme: (metaMap.get('theme') as string) || 'default',
    aspectRatio: (metaMap.get('aspectRatio') as string) || '16:9',
  };

  const yslides = getSlidesArray(ydoc);
  const slides: Slide[] = [];
  for (let i = 0; i < yslides.length; i++) {
    slides.push(ymapToSlide(yslides.get(i)));
  }

  if (slides.length === 0) {
    slides.push({
      id: genSlideId(),
      content: '# New Presentation',
      layout: 'title',
      notes: '',
      transition: 'none',
      transitionDuration: '0.3s',
      fragments: [],
      shapes: [],
    });
  }

  return { meta, slides };
}

// ── Fine-grained slide updates ─────────────────────────────────────────────

export function updateSlideFieldInYjs(
  ydoc: Y.Doc,
  slideIndex: number,
  field: string,
  value: any,
): void {
  const yslides = getSlidesArray(ydoc);
  if (slideIndex < 0 || slideIndex >= yslides.length) return;
  const ymap = yslides.get(slideIndex);
  if (field === 'shapes' || field === 'fragments') {
    ymap.set(field, JSON.stringify(value));
  } else {
    ymap.set(field, value);
  }
}

export function addSlideInYjs(ydoc: Y.Doc, slide: Slide, atIndex: number): void {
  const yslides = getSlidesArray(ydoc);
  yslides.insert(atIndex, [slideToYMap(slide, ydoc)]);
}

export function deleteSlideInYjs(ydoc: Y.Doc, index: number): void {
  const yslides = getSlidesArray(ydoc);
  if (index >= 0 && index < yslides.length) {
    yslides.delete(index, 1);
  }
}

export function reorderSlideInYjs(ydoc: Y.Doc, from: number, to: number): void {
  const yslides = getSlidesArray(ydoc);
  if (from < 0 || from >= yslides.length) return;
  ydoc.transact(() => {
    const slide = ymapToSlide(yslides.get(from));
    yslides.delete(from, 1);
    const insertAt = to > from ? to - 1 : to;
    yslides.insert(insertAt, [slideToYMap(slide, ydoc)]);
  });
}

export function updatePresMetaInYjs(ydoc: Y.Doc, key: string, value: string): void {
  getPresMeta(ydoc).set(key, value);
}

// ── Observers ──────────────────────────────────────────────────────────────

export function observeSlides(
  ydoc: Y.Doc,
  callback: () => void,
): () => void {
  const yslides = getSlidesArray(ydoc);
  const handler = () => callback();
  yslides.observeDeep(handler);
  return () => yslides.unobserveDeep(handler);
}

export function observePresMeta(
  ydoc: Y.Doc,
  callback: () => void,
): () => void {
  const metaMap = getPresMeta(ydoc);
  const handler = () => callback();
  metaMap.observe(handler);
  return () => metaMap.unobserve(handler);
}

// ── Awareness (slide cursors) ──────────────────────────────────────────────

export function setLocalSlideAwareness(
  provider: HocuspocusProvider,
  userName: string,
  activeSlide: number,
  cursorX: number | null = null,
  cursorY: number | null = null,
): void {
  if (!provider.awareness) return;
  const state: SlideAwarenessState = {
    user: { name: userName, color: getUserColor(userName) },
    activeSlide,
    cursorX,
    cursorY,
  };
  provider.awareness.setLocalStateField('slideCursor', state);
}

export function getRemoteSlideUsers(provider: HocuspocusProvider): RemoteSlideUser[] {
  if (!provider.awareness) return [];
  const users: RemoteSlideUser[] = [];
  const localId = provider.awareness.clientID;
  provider.awareness.getStates().forEach((state: any, clientId: number) => {
    if (clientId === localId) return;
    const sc = state?.slideCursor as SlideAwarenessState | undefined;
    if (!sc?.user) return;
    users.push({
      name: sc.user.name,
      color: sc.user.color,
      activeSlide: sc.activeSlide,
      cursorX: sc.cursorX,
      cursorY: sc.cursorY,
      clientId,
    });
  });
  return users;
}

export function onSlideAwarenessChange(
  provider: HocuspocusProvider,
  callback: (users: RemoteSlideUser[]) => void,
): () => void {
  if (!provider.awareness) return () => {};
  const handler = () => callback(getRemoteSlideUsers(provider));
  provider.awareness.on('change', handler);
  return () => provider.awareness!.off('change', handler);
}

// ── Master slide helpers ───────────────────────────────────────────────────

export interface SlideMasterData {
  fontFamily: string;
  headingFont: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  layouts: Record<string, MasterLayoutPlaceholder[]>;
}

export interface MasterLayoutPlaceholder {
  id: string;
  type: 'title' | 'subtitle' | 'body' | 'image' | 'footer';
  x: number;      // percent 0-100
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_MASTER: SlideMasterData = {
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFont: 'Inter, system-ui, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#222222',
  accentColor: '#4285F4',
  layouts: {
    title: [
      { id: 'p-title', type: 'title', x: 10, y: 30, width: 80, height: 20 },
      { id: 'p-subtitle', type: 'subtitle', x: 20, y: 55, width: 60, height: 10 },
    ],
    content: [
      { id: 'p-title', type: 'title', x: 5, y: 5, width: 90, height: 15 },
      { id: 'p-body', type: 'body', x: 5, y: 22, width: 90, height: 68 },
    ],
    'two-column': [
      { id: 'p-title', type: 'title', x: 5, y: 5, width: 90, height: 15 },
      { id: 'p-left', type: 'body', x: 5, y: 22, width: 43, height: 68 },
      { id: 'p-right', type: 'body', x: 52, y: 22, width: 43, height: 68 },
    ],
    image: [
      { id: 'p-title', type: 'title', x: 5, y: 5, width: 90, height: 12 },
      { id: 'p-image', type: 'image', x: 10, y: 20, width: 80, height: 70 },
    ],
    section: [
      { id: 'p-title', type: 'title', x: 10, y: 35, width: 80, height: 25 },
    ],
    blank: [],
  },
};

export function syncMasterToYjs(ydoc: Y.Doc, master: SlideMasterData): void {
  const ymap = getMasterMap(ydoc);
  ydoc.transact(() => {
    ymap.set('fontFamily', master.fontFamily);
    ymap.set('headingFont', master.headingFont);
    ymap.set('backgroundColor', master.backgroundColor);
    ymap.set('textColor', master.textColor);
    ymap.set('accentColor', master.accentColor);
    ymap.set('layouts', JSON.stringify(master.layouts));
  });
}

export function syncMasterFromYjs(ydoc: Y.Doc): SlideMasterData {
  const ymap = getMasterMap(ydoc);
  return {
    fontFamily: (ymap.get('fontFamily') as string) || DEFAULT_MASTER.fontFamily,
    headingFont: (ymap.get('headingFont') as string) || DEFAULT_MASTER.headingFont,
    backgroundColor: (ymap.get('backgroundColor') as string) || DEFAULT_MASTER.backgroundColor,
    textColor: (ymap.get('textColor') as string) || DEFAULT_MASTER.textColor,
    accentColor: (ymap.get('accentColor') as string) || DEFAULT_MASTER.accentColor,
    layouts: safeJsonParse(ymap.get('layouts') as string, DEFAULT_MASTER.layouts),
  };
}

export function observeMaster(ydoc: Y.Doc, callback: () => void): () => void {
  const ymap = getMasterMap(ydoc);
  const handler = () => callback();
  ymap.observe(handler);
  return () => ymap.unobserve(handler);
}

// ── Init helper ────────────────────────────────────────────────────────────

export interface SlideCollabHandle {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  destroy: () => void;
}

export function initSlideCollab(
  documentName: string,
  serverUrl: string,
  userName: string,
  presentation: Presentation,
  onSlidesChanged: () => void,
  onMetaChanged: () => void,
  onUsersChanged: (users: RemoteSlideUser[]) => void,
): SlideCollabHandle {
  const ydoc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: serverUrl,
    name: `slides:${documentName}`,
    document: ydoc,
  });

  if (provider.awareness) {
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: getUserColor(userName),
    });
  }

  const unsubscribers: (() => void)[] = [];

  const handleSynced = () => {
    const yslides = getSlidesArray(ydoc);

    if (yslides.length === 0) {
      syncPresentationToYjs(presentation, ydoc);
    }

    unsubscribers.push(observeSlides(ydoc, onSlidesChanged));
    unsubscribers.push(observePresMeta(ydoc, onMetaChanged));
    unsubscribers.push(onSlideAwarenessChange(provider, onUsersChanged));
  };

  if (provider.isSynced) {
    handleSynced();
  }
  provider.on('synced', handleSynced);

  return {
    ydoc,
    provider,
    destroy: () => {
      unsubscribers.forEach(fn => fn());
      provider.off('synced', handleSynced);
      provider.destroy();
      ydoc.destroy();
    },
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────

function safeJsonParse<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
