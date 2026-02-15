import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PageBreakWrapperProps {
  children: React.ReactNode;
  pageHeight?: number;
  gapHeight?: number;
}

const PageBreakWrapper: React.FC<PageBreakWrapperProps> = ({
  children,
  pageHeight = 912, // Content height per page (1056 - 144 for top/bottom padding)
  gapHeight = 28,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gapPositions, setGapPositions] = useState<number[]>([]);
  const isCalculating = useRef(false);

  const calculatePageBreaks = useCallback(() => {
    if (!containerRef.current || isCalculating.current) return;
    isCalculating.current = true;

    const proseMirror = containerRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (!proseMirror) { isCalculating.current = false; return; }

    // Step 1: Clear all previous page break margins
    proseMirror.querySelectorAll('[data-page-break-margin]').forEach((el) => {
      (el as HTMLElement).style.marginBottom = '';
      (el as HTMLElement).removeAttribute('data-page-break-margin');
    });

    // Step 2: Calculate where page breaks should go
    const elements = Array.from(proseMirror.children) as HTMLElement[];
    const proseMirrorRect = proseMirror.getBoundingClientRect();
    
    let currentPageBottom = pageHeight;
    const breakElements: { element: HTMLElement; extraMargin: number; gapY: number }[] = [];

    for (const el of elements) {
      const elRect = el.getBoundingClientRect();
      const elTop = elRect.top - proseMirrorRect.top;
      const elBottom = elTop + elRect.height;

      if (elBottom > currentPageBottom) {
        // This element crosses the page boundary
        // Find the previous element (last one that fits on this page)
        const elIndex = elements.indexOf(el);
        const prevEl = elIndex > 0 ? elements[elIndex - 1] : null;
        
        if (prevEl) {
          const prevRect = prevEl.getBoundingClientRect();
          const prevBottom = prevRect.bottom - proseMirrorRect.top;
          
          // Gap goes after previous element: fill remaining page space + visual gap
          const remainingOnPage = currentPageBottom - prevBottom;
          const totalMargin = remainingOnPage + gapHeight;
          
          breakElements.push({
            element: prevEl,
            extraMargin: totalMargin,
            gapY: prevBottom + remainingOnPage, // Position at page bottom
          });
          
          currentPageBottom += pageHeight + totalMargin;
        } else {
          currentPageBottom += pageHeight;
        }
      }
    }

    // Step 3: Apply margins and collect gap positions
    const newGapPositions: number[] = [];
    
    breakElements.forEach(({ element, extraMargin }) => {
      element.style.marginBottom = `${extraMargin}px`;
      element.setAttribute('data-page-break-margin', 'true');
    });

    // Step 4: After margins are applied, read actual gap positions from DOM
    requestAnimationFrame(() => {
      const pmRect = proseMirror.getBoundingClientRect();
      breakElements.forEach(({ element, extraMargin }) => {
        const rect = element.getBoundingClientRect();
        const elBottom = rect.bottom - pmRect.top;
        // The gap should be at the content bottom, which is elBottom minus the extra margin we added
        const contentBottom = elBottom - extraMargin;
        // Add remaining page space offset to position gap correctly
        newGapPositions.push(contentBottom);
      });
      
      setGapPositions(newGapPositions);
      // Delay releasing the lock so observer doesn't immediately retrigger
      setTimeout(() => { isCalculating.current = false; }, 100);
    });
  }, [pageHeight, gapHeight]);

  useEffect(() => {
    const timer = setTimeout(calculatePageBreaks, 300);

    if (!containerRef.current) return () => clearTimeout(timer);
    const proseMirror = containerRef.current.querySelector('.ProseMirror');
    if (!proseMirror) return () => clearTimeout(timer);

    let debounceTimer: number;
    const observer = new MutationObserver(() => {
      if (isCalculating.current) return;
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(calculatePageBreaks, 300);
    });

    observer.observe(proseMirror, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(calculatePageBreaks, 200);
    });
    resizeObserver.observe(proseMirror);

    return () => {
      clearTimeout(timer);
      clearTimeout(debounceTimer);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [calculatePageBreaks]);

  return (
    <div ref={containerRef} className="page-break-wrapper" style={{ position: 'relative' }}>
      {children}
      {gapPositions.map((top, i) => (
        <div
          key={`gap-${i}`}
          className="page-break-gap"
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: '-72px',
            right: '-72px', 
            height: `${gapHeight}px`,
            backgroundColor: '#f0f2f4',
            zIndex: 20,
            pointerEvents: 'none',
            boxShadow: 'inset 0 3px 5px -3px rgba(0,0,0,0.12), inset 0 -3px 5px -3px rgba(0,0,0,0.12)',
          }}
        />
      ))}
    </div>
  );
};

export default PageBreakWrapper;
