import React, { useState, useEffect, useCallback } from 'react';

export interface TourStep {
  target: string;       // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const DEFAULT_STEPS: TourStep[] = [
  {
    target: '.docs-toolbar',
    title: 'Formatting Toolbar',
    content: 'Use the toolbar to format text — bold, italic, headings, lists, and more.',
    placement: 'bottom',
  },
  {
    target: '.menu-items',
    title: 'Menu Bar',
    content: 'Access all features from the menu bar: File, Edit, View, Insert, Format, and Tools.',
    placement: 'bottom',
  },
  {
    target: '.menu-item:nth-child(4)',
    title: 'Insert Menu',
    content: 'Insert images, tables, links, equations, and special characters.',
    placement: 'bottom',
  },
  {
    target: '.share-btn',
    title: 'Collaborate',
    content: 'Share your document and collaborate in real-time with others.',
    placement: 'bottom',
  },
  {
    target: '.menu-item:nth-child(1)',
    title: 'Version History',
    content: 'Every change is tracked with git. Open File → Version History to browse past revisions.',
    placement: 'bottom',
  },
  {
    target: '.status-bar',
    title: 'Keyboard Shortcuts',
    content: 'Press ⌘/ to see all keyboard shortcuts. You\'re ready to go!',
    placement: 'top',
  },
];

const STORAGE_KEY = 'onboarding-complete';

interface OnboardingTourProps {
  steps?: TourStep[];
  run: boolean;
  onFinish: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps = DEFAULT_STEPS, run, onFinish }) => {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    const step = steps[current];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [current, steps]);

  useEffect(() => {
    if (!run) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [run, measure]);

  if (!run || current >= steps.length) return null;

  const step = steps[current];
  const isLast = current === steps.length - 1;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setCurrent(0);
    onFinish();
  };

  const next = () => {
    if (isLast) { finish(); return; }
    setCurrent(c => c + 1);
  };

  // Tooltip positioning
  const pad = 12;
  const tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 10002 };
  if (rect) {
    const placement = step.placement || 'bottom';
    if (placement === 'bottom') {
      tooltipStyle.top = rect.bottom + pad;
      tooltipStyle.left = rect.left + rect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (placement === 'top') {
      tooltipStyle.bottom = window.innerHeight - rect.top + pad;
      tooltipStyle.left = rect.left + rect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (placement === 'right') {
      tooltipStyle.top = rect.top + rect.height / 2;
      tooltipStyle.left = rect.right + pad;
      tooltipStyle.transform = 'translateY(-50%)';
    } else {
      tooltipStyle.top = rect.top + rect.height / 2;
      tooltipStyle.right = window.innerWidth - rect.left + pad;
      tooltipStyle.transform = 'translateY(-50%)';
    }
  } else {
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* Dark overlay with spotlight hole */}
      <svg className="tour-overlay" style={{ position: 'fixed', inset: 0, zIndex: 10001, pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
      </svg>

      {/* Click-catcher behind tooltip */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10001 }} onClick={e => e.stopPropagation()} />

      {/* Tooltip */}
      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="tour-tooltip-header">
          <span className="tour-step-count">{current + 1}/{steps.length}</span>
          <h4>{step.title}</h4>
        </div>
        <p>{step.content}</p>
        <div className="tour-tooltip-actions">
          <button className="tour-skip-btn" onClick={finish}>Skip</button>
          <button className="tour-next-btn" onClick={next}>{isLast ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;
export { STORAGE_KEY };
