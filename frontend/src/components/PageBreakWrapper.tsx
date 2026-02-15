import React, { useEffect, useRef, useState } from 'react';

interface PageBreakWrapperProps {
  children: React.ReactNode;
  pageHeight?: number; // Height of one page in pixels
  gapHeight?: number;  // Height of the visual gap between pages
}

interface PageBreak {
  id: string;
  elementIndex: number;
  top: number;
}

const PageBreakWrapper: React.FC<PageBreakWrapperProps> = ({
  children,
  pageHeight = 1056,
  gapHeight = 24,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([]);

  const calculatePageBreaks = () => {
    if (!containerRef.current) return;

    const proseMirrorElement = containerRef.current.querySelector('.ProseMirror');
    if (!proseMirrorElement) return;

    // Clear any existing page break styling
    const existingElements = proseMirrorElement.querySelectorAll('.page-break-after');
    existingElements.forEach((el) => {
      el.classList.remove('page-break-after');
      (el as HTMLElement).style.marginBottom = '';
    });

    const children = Array.from(proseMirrorElement.children) as HTMLElement[];
    let accumulatedHeight = 0;
    let currentPage = 1;
    const newPageBreaks: PageBreak[] = [];

    children.forEach((child, index) => {
      const childRect = child.getBoundingClientRect();
      const childHeight = childRect.height;
      
      // Check if adding this element would exceed the page height
      if (accumulatedHeight + childHeight > pageHeight * currentPage) {
        // We need a page break before this element
        const breakTop = accumulatedHeight;
        
        // Add margin to the previous element to create space for the page break
        if (index > 0) {
          const previousElement = children[index - 1];
          previousElement.classList.add('page-break-after');
          previousElement.style.marginBottom = `${gapHeight}px`;
          
          newPageBreaks.push({
            id: `page-break-${currentPage}`,
            elementIndex: index - 1,
            top: breakTop,
          });
        }
        
        currentPage++;
        accumulatedHeight = breakTop + gapHeight; // Account for the gap
      }
      
      accumulatedHeight += childHeight;
    });

    setPageBreaks(newPageBreaks);
  };

  useEffect(() => {
    // Initial calculation with delay to let content render
    const initialTimer = setTimeout(calculatePageBreaks, 200);

    // Set up mutation observer to watch for content changes
    if (!containerRef.current) return () => clearTimeout(initialTimer);

    const proseMirrorElement = containerRef.current.querySelector('.ProseMirror');
    if (!proseMirrorElement) return () => clearTimeout(initialTimer);

    let recalcTimer: number;

    const observer = new MutationObserver(() => {
      // Debounce the recalculation
      clearTimeout(recalcTimer);
      recalcTimer = window.setTimeout(calculatePageBreaks, 150);
    });

    observer.observe(proseMirrorElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Also listen for resize events
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(recalcTimer);
      recalcTimer = window.setTimeout(calculatePageBreaks, 150);
    });

    resizeObserver.observe(proseMirrorElement);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(recalcTimer);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [pageHeight, gapHeight]);

  return (
    <div ref={containerRef} className="page-break-wrapper" style={{ position: 'relative' }}>
      {children}
      
      {/* Render page break visual gaps */}
      {pageBreaks.map((pageBreak) => (
        <div
          key={pageBreak.id}
          className="page-break-gap"
          style={{
            position: 'absolute',
            top: `${pageBreak.top}px`,
            left: '-72px',
            right: '-72px',
            height: `${gapHeight}px`,
            backgroundColor: '#e8eaed',
            zIndex: 10,
            pointerEvents: 'none',
            marginTop: '0px',
            boxShadow: `
              0 -8px 16px -8px rgba(0, 0, 0, 0.1) inset,
              0 8px 16px -8px rgba(0, 0, 0, 0.1) inset
            `,
          }}
        />
      ))}
    </div>
  );
};

export default PageBreakWrapper;