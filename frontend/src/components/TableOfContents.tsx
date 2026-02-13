import React, { useState, useEffect, useMemo } from 'react';
import { List, ChevronDown, ChevronRight } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: number;
  element?: HTMLElement;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, className = '' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  // Extract headings from markdown content
  const headings = useMemo(() => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const extracted: Heading[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      extracted.push({
        id: id || `heading-${extracted.length}`,
        text,
        level
      });
    }

    return extracted;
  }, [content]);

  // Update heading elements and setup intersection observer
  useEffect(() => {
    if (headings.length === 0) return;

    const updateElements = () => {
      headings.forEach(heading => {
        const element = document.getElementById(heading.id) || 
                       document.querySelector(`h${heading.level}[data-heading="${heading.text}"]`) ||
                       Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                         .find(el => el.textContent?.trim() === heading.text);
        
        if (element) {
          element.id = heading.id;
          heading.element = element as HTMLElement;
        }
      });
    };

    // Update elements after a short delay to ensure content is rendered
    const timeout = setTimeout(updateElements, 100);

    return () => clearTimeout(timeout);
  }, [headings, content]);

  // Setup intersection observer for active heading tracking
  useEffect(() => {
    const elementsWithHeadings = headings
      .map(h => h.element)
      .filter((el): el is HTMLElement => el !== undefined);

    if (elementsWithHeadings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let visibleHeadings = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => entry.target.id);

        if (visibleHeadings.length > 0) {
          setActiveHeading(visibleHeadings[0]);
        }
      },
      {
        rootMargin: '-20px 0px -80% 0px',
        threshold: 0
      }
    );

    elementsWithHeadings.forEach(element => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      setActiveHeading(headingId);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className={`table-of-contents ${className}`}>
      <div 
        className="toc-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderBottom: isCollapsed ? '1px solid var(--border)' : 'none',
          borderRadius: isCollapsed ? '8px' : '8px 8px 0 0',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '14px',
          color: 'var(--text)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <List size={16} />
          Table of Contents
        </div>
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </div>

      {!isCollapsed && (
        <div 
          className="toc-content"
          style={{
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            background: 'var(--bg-secondary)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          {headings.map((heading, index) => (
            <button
              key={heading.id}
              onClick={() => scrollToHeading(heading.id)}
              className={`toc-item ${activeHeading === heading.id ? 'active' : ''}`}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: activeHeading === heading.id ? 'var(--accent-light)' : 'transparent',
                color: activeHeading === heading.id ? 'var(--accent)' : 'var(--text)',
                padding: '8px 12px',
                paddingLeft: `${12 + (heading.level - 1) * 16}px`,
                fontSize: heading.level <= 2 ? '14px' : '13px',
                fontWeight: heading.level <= 2 ? '500' : '400',
                cursor: 'pointer',
                borderBottom: index < headings.length - 1 ? '1px solid var(--border-light)' : 'none',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (activeHeading !== heading.id) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeHeading !== heading.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableOfContents;