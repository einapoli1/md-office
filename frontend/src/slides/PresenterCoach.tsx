import { useState, useMemo } from 'react';
import { Slide, Presentation } from './slideModel';
import type { SlideTimings } from './RehearsalMode';

interface Issue {
  slideIndex: number;
  category: 'text' | 'design' | 'structure' | 'pacing';
  severity: 'warning' | 'error' | 'info';
  message: string;
  fix?: () => Slide[];
}

interface ScoreBreakdown {
  text: number;
  design: number;
  structure: number;
  pacing: number;
  overall: number;
}

interface Props {
  presentation: Presentation;
  timings?: SlideTimings;
  onUpdateSlides: (slides: Slide[]) => void;
  onClose: () => void;
}

function countBulletPoints(content: string): number {
  return content.split('\n').filter(l => /^\s*[-*+]\s/.test(l)).length;
}

function hasTitle(content: string): boolean {
  return /^#[^#]/m.test(content);
}

function wordCount(content: string): number {
  return content.replace(/<!--[\s\S]*?-->/g, '').replace(/[#*_`\[\]()!]/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function getFontSizes(content: string): number[] {
  const sizes: number[] = [];
  const m = content.match(/font-size:\s*(\d+)/g);
  if (m) m.forEach(s => { const n = s.match(/(\d+)/); if (n) sizes.push(parseInt(n[1])); });
  return sizes;
}

function getHeadingLevels(content: string): number[] {
  const levels: number[] = [];
  const lines = content.split('\n');
  for (const l of lines) {
    const m = l.match(/^(#{1,6})\s/);
    if (m) levels.push(m[1].length);
  }
  return levels;
}

export default function PresenterCoach({ presentation, timings, onUpdateSlides, onClose }: Props) {
  const [showDetails, setShowDetails] = useState(true);
  const slides = presentation.slides;

  const { issues, score } = useMemo(() => {
    const issues: Issue[] = [];

    // Analyze each slide
    slides.forEach((slide, i) => {
      const bullets = countBulletPoints(slide.content);
      const words = wordCount(slide.content);
      const fonts = getFontSizes(slide.content);
      const lines = slide.content.split('\n').filter(l => l.trim().length > 0).length;

      // Too much text (>6 bullet points)
      if (bullets > 6) {
        issues.push({
          slideIndex: i,
          category: 'text',
          severity: 'warning',
          message: `Slide ${i + 1} has ${bullets} bullet points — consider splitting into two slides`,
          fix: () => {
            const contentLines = slide.content.split('\n');
            const bulletLines = contentLines.filter(l => /^\s*[-*+]\s/.test(l));
            const nonBulletLines = contentLines.filter(l => !/^\s*[-*+]\s/.test(l));
            const mid = Math.ceil(bulletLines.length / 2);
            const first = [...nonBulletLines, ...bulletLines.slice(0, mid)].join('\n');
            const second = [...nonBulletLines, ...bulletLines.slice(mid)].join('\n');
            const newSlides = [...slides];
            newSlides[i] = { ...slide, content: first };
            newSlides.splice(i + 1, 0, { ...slide, id: `slide-fix-${Date.now()}`, content: second });
            return newSlides;
          },
        });
      }

      // Wall of text (>150 words, no bullets)
      if (words > 150 && bullets === 0) {
        issues.push({
          slideIndex: i,
          category: 'text',
          severity: 'error',
          message: `Slide ${i + 1} has ${words} words with no bullet points — wall of text`,
        });
      }

      // Missing title
      if (!hasTitle(slide.content) && slide.layout !== 'blank') {
        issues.push({
          slideIndex: i,
          category: 'structure',
          severity: 'warning',
          message: `Slide ${i + 1} is missing a title`,
          fix: () => {
            const newSlides = [...slides];
            newSlides[i] = { ...slide, content: `# Slide ${i + 1}\n\n${slide.content}` };
            return newSlides;
          },
        });
      }

      // Tiny font sizes
      if (fonts.some(f => f < 14)) {
        issues.push({
          slideIndex: i,
          category: 'design',
          severity: 'warning',
          message: `Slide ${i + 1} has tiny font sizes — may be hard to read`,
          fix: () => {
            const newSlides = [...slides];
            newSlides[i] = {
              ...slide,
              content: slide.content.replace(/font-size:\s*(\d+)/g, (_, sz) => {
                const n = parseInt(sz);
                return `font-size: ${n < 14 ? 18 : n}`;
              }),
            };
            return newSlides;
          },
        });
      }

      // Too many lines without structure
      if (lines > 12 && bullets === 0 && getHeadingLevels(slide.content).length <= 1) {
        issues.push({
          slideIndex: i,
          category: 'text',
          severity: 'info',
          message: `Slide ${i + 1} has ${lines} lines — consider adding structure with headings or bullets`,
        });
      }
    });

    // Too many slides
    if (slides.length > 30) {
      issues.push({
        slideIndex: -1,
        category: 'structure',
        severity: 'warning',
        message: `Presentation has ${slides.length} slides — consider consolidating`,
      });
    }

    // Inconsistent heading levels across slides
    const headingCounts = slides.map(s => getHeadingLevels(s.content));
    const h1Slides = headingCounts.filter(h => h.includes(1)).length;
    const h2Slides = headingCounts.filter(h => h.includes(2) && !h.includes(1)).length;
    if (h1Slides > 0 && h2Slides > 3) {
      issues.push({
        slideIndex: -1,
        category: 'design',
        severity: 'info',
        message: `Inconsistent heading levels: ${h1Slides} slides use H1, ${h2Slides} slides use H2 as title`,
      });
    }

    // Pacing from rehearsal timings
    if (timings && timings.perSlide.length > 0) {
      timings.perSlide.forEach((ms, i) => {
        if (ms > 0 && ms < 30000) {
          issues.push({
            slideIndex: i,
            category: 'pacing',
            severity: 'warning',
            message: `Slide ${i + 1} was presented in only ${(ms / 1000).toFixed(0)}s — too fast?`,
          });
        }
        if (ms > 300000) {
          issues.push({
            slideIndex: i,
            category: 'pacing',
            severity: 'warning',
            message: `Slide ${i + 1} took ${(ms / 60000).toFixed(1)} minutes — consider splitting`,
          });
        }
      });
    }

    // Compute scores
    const categoryIssues = (cat: string) => issues.filter(i => i.category === cat);
    const categoryScore = (cat: string) => {
      const ci = categoryIssues(cat);
      const errorPenalty = ci.filter(i => i.severity === 'error').length * 15;
      const warnPenalty = ci.filter(i => i.severity === 'warning').length * 8;
      const infoPenalty = ci.filter(i => i.severity === 'info').length * 3;
      return Math.max(0, 100 - errorPenalty - warnPenalty - infoPenalty);
    };

    const score: ScoreBreakdown = {
      text: categoryScore('text'),
      design: categoryScore('design'),
      structure: categoryScore('structure'),
      pacing: categoryScore('pacing'),
      overall: 0,
    };
    score.overall = Math.round((score.text + score.design + score.structure + score.pacing) / 4);

    return { issues, score };
  }, [slides, timings]);

  const severityIcon = (s: string) => s === 'error' ? '🔴' : s === 'warning' ? '🟡' : '🔵';
  const scoreColor = (s: number) => s >= 80 ? '#0f9d58' : s >= 60 ? '#f4b400' : '#db4437';

  return (
    <div className="presenter-coach-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 24,
        width: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🎯 Presenter Coach</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Overall Score */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: '50%',
            border: `4px solid ${scoreColor(score.overall)}`,
            fontSize: 28, fontWeight: 700, color: scoreColor(score.overall),
          }}>
            {score.overall}
          </div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Overall Score</div>
        </div>

        {/* Category Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {(['text', 'design', 'structure', 'pacing'] as const).map(cat => (
            <div key={cat} style={{
              textAlign: 'center', padding: 8, borderRadius: 8,
              background: 'var(--bg-secondary, #f5f5f5)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(score[cat]) }}>{score[cat]}</div>
              <div style={{ fontSize: 11, textTransform: 'capitalize', color: '#666' }}>{cat}</div>
            </div>
          ))}
        </div>

        {/* Issues */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>
            {issues.length === 0 ? '✅ No issues found!' : `${issues.length} issue${issues.length !== 1 ? 's' : ''} found`}
          </h3>
          {issues.length > 0 && (
            <button onClick={() => setShowDetails(!showDetails)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#4285f4', fontSize: 13,
            }}>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {showDetails && issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map((issue, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                borderRadius: 6, background: 'var(--bg-secondary, #f5f5f5)',
                fontSize: 13,
              }}>
                <span>{severityIcon(issue.severity)}</span>
                <span style={{ flex: 1 }}>{issue.message}</span>
                {issue.fix && (
                  <button
                    onClick={() => onUpdateSlides(issue.fix!())}
                    style={{
                      padding: '3px 10px', borderRadius: 4, border: '1px solid #4285f4',
                      background: '#4285f4', color: '#fff', cursor: 'pointer', fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Fix
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!timings && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fff3cd', fontSize: 13, color: '#856404' }}>
            💡 Run Rehearsal mode first to get pacing feedback
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 6, background: '#4285f4',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14,
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
