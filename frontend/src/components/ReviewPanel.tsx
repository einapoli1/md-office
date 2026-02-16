import React, { useState, useMemo, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, XCircle, Filter, Download, MessageSquare, PenTool, GitCommit } from 'lucide-react';
import type { Comment } from './CommentsSidebar';

interface Suggestion {
  id: string;
  author: string;
  type: 'insert' | 'delete';
  text: string;
  createdAt: string;
  accepted?: boolean;
}

export interface TrackedChange {
  id: string;
  author: string;
  type: 'insertion' | 'deletion' | 'formatting';
  text: string;
  createdAt: string;
  accepted?: boolean;
}

interface ReviewPanelProps {
  comments: Comment[];
  suggestions: Suggestion[];
  changes: TrackedChange[];
  onResolveComment: (id: string) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onAcceptChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onNavigateToItem: (type: 'comment' | 'suggestion' | 'change', id: string) => void;
  onClose: () => void;
}

type TabType = 'comments' | 'suggestions' | 'changes';
type FilterStatus = 'all' | 'resolved' | 'unresolved';

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  comments, suggestions, changes,
  onResolveComment, onAcceptSuggestion, onRejectSuggestion,
  onAcceptChange, onRejectChange, onNavigateToItem, onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('comments');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const authors = useMemo(() => {
    const set = new Set<string>();
    comments.forEach(c => set.add(c.author));
    suggestions.forEach(s => set.add(s.author));
    changes.forEach(ch => set.add(ch.author));
    return Array.from(set);
  }, [comments, suggestions, changes]);

  const filterByDate = useCallback((dateStr: string) => {
    if (!filterDateFrom && !filterDateTo) return true;
    const d = new Date(dateStr).getTime();
    if (filterDateFrom && d < new Date(filterDateFrom).getTime()) return false;
    if (filterDateTo && d > new Date(filterDateTo + 'T23:59:59').getTime()) return false;
    return true;
  }, [filterDateFrom, filterDateTo]);

  const filteredComments = useMemo(() => comments.filter(c => {
    if (filterStatus === 'resolved' && !c.resolved) return false;
    if (filterStatus === 'unresolved' && c.resolved) return false;
    if (filterAuthor && c.author !== filterAuthor) return false;
    return filterByDate(c.createdAt);
  }), [comments, filterStatus, filterAuthor, filterByDate]);

  const filteredSuggestions = useMemo(() => suggestions.filter(s => {
    if (filterStatus === 'resolved' && s.accepted === undefined) return false;
    if (filterStatus === 'unresolved' && s.accepted !== undefined) return false;
    if (filterAuthor && s.author !== filterAuthor) return false;
    return filterByDate(s.createdAt);
  }), [suggestions, filterStatus, filterAuthor, filterByDate]);

  const filteredChanges = useMemo(() => changes.filter(ch => {
    if (filterStatus === 'resolved' && ch.accepted === undefined) return false;
    if (filterStatus === 'unresolved' && ch.accepted !== undefined) return false;
    if (filterAuthor && ch.author !== filterAuthor) return false;
    return filterByDate(ch.createdAt);
  }), [changes, filterStatus, filterAuthor, filterByDate]);

  const currentItems = activeTab === 'comments' ? filteredComments
    : activeTab === 'suggestions' ? filteredSuggestions : filteredChanges;

  const handlePrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex(i => Math.min(currentItems.length - 1, i + 1));

  const handleAcceptAll = () => {
    if (activeTab === 'suggestions') filteredSuggestions.forEach(s => { if (s.accepted === undefined) onAcceptSuggestion(s.id); });
    if (activeTab === 'changes') filteredChanges.forEach(ch => { if (ch.accepted === undefined) onAcceptChange(ch.id); });
  };

  const handleRejectAll = () => {
    if (activeTab === 'suggestions') filteredSuggestions.forEach(s => { if (s.accepted === undefined) onRejectSuggestion(s.id); });
    if (activeTab === 'changes') filteredChanges.forEach(ch => { if (ch.accepted === undefined) onRejectChange(ch.id); });
  };

  const handleBulkResolve = () => {
    filteredComments.forEach(c => { if (!c.resolved) onResolveComment(c.id); });
  };

  const exportMarkdown = () => {
    const lines: string[] = ['# Review Summary\n'];
    lines.push(`- **Comments:** ${comments.length} (${comments.filter(c => c.resolved).length} resolved)`);
    lines.push(`- **Suggestions:** ${suggestions.length} (${suggestions.filter(s => s.accepted !== undefined).length} reviewed)`);
    lines.push(`- **Changes:** ${changes.length}\n`);

    if (comments.length) {
      lines.push('## Comments\n');
      comments.forEach(c => {
        lines.push(`- [${c.resolved ? 'x' : ' '}] **${c.author}** (${new Date(c.createdAt).toLocaleDateString()}): ${c.text}`);
      });
      lines.push('');
    }
    if (suggestions.length) {
      lines.push('## Suggestions\n');
      suggestions.forEach(s => {
        const status = s.accepted === true ? '✅' : s.accepted === false ? '❌' : '⏳';
        lines.push(`- ${status} **${s.author}** (${new Date(s.createdAt).toLocaleDateString()}): ${s.type} "${s.text}"`);
      });
      lines.push('');
    }
    if (changes.length) {
      lines.push('## Tracked Changes\n');
      changes.forEach(ch => {
        const status = ch.accepted === true ? '✅' : ch.accepted === false ? '❌' : '⏳';
        lines.push(`- ${status} **${ch.author}** (${new Date(ch.createdAt).toLocaleDateString()}): ${ch.type} "${ch.text}"`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-summary.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #e0e0e0)',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Review Panel</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Filters">
            <Filter size={16} />
          </button>
          <button onClick={exportMarkdown} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Export summary">
            <Download size={16} />
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '8px 16px', fontSize: 12, color: '#666', display: 'flex', gap: 16, borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
        <span><MessageSquare size={12} style={{ verticalAlign: -2 }} /> {comments.length} comments</span>
        <span><PenTool size={12} style={{ verticalAlign: -2 }} /> {suggestions.length} suggestions</span>
        <span><GitCommit size={12} style={{ verticalAlign: -2 }} /> {changes.length} changes</span>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              style={{ fontSize: 12, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }}>
              <option value="all">All</option>
              <option value="resolved">Resolved</option>
              <option value="unresolved">Unresolved</option>
            </select>
            <select value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}
              style={{ fontSize: 12, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }}>
              <option value="">All authors</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }} />
            <span>to</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
        {(['comments', 'suggestions', 'changes'] as TabType[]).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setCurrentIndex(0); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? 'var(--bg-primary, #fff)' : 'var(--bg-secondary, #f5f5f5)',
              borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
            }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({
              tab === 'comments' ? filteredComments.length : tab === 'suggestions' ? filteredSuggestions.length : filteredChanges.length
            })
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handlePrev} disabled={currentIndex <= 0} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: currentIndex <= 0 ? 0.3 : 1 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 12, lineHeight: '20px' }}>
            {currentItems.length > 0 ? `${currentIndex + 1} / ${currentItems.length}` : '0 / 0'}
          </span>
          <button onClick={handleNext} disabled={currentIndex >= currentItems.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: currentIndex >= currentItems.length - 1 ? 0.3 : 1 }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {activeTab === 'comments' && (
            <button onClick={handleBulkResolve} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc', background: '#f0f0f0', cursor: 'pointer' }}>
              Resolve All
            </button>
          )}
          {(activeTab === 'suggestions' || activeTab === 'changes') && (
            <>
              <button onClick={handleAcceptAll} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer' }}>
                Accept All
              </button>
              <button onClick={handleRejectAll} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ea4335', background: '#fce8e6', color: '#ea4335', cursor: 'pointer' }}>
                Reject All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {activeTab === 'comments' && filteredComments.map((c, i) => (
          <div key={c.id} onClick={() => { setCurrentIndex(i); onNavigateToItem('comment', c.id); }}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderLeft: i === currentIndex ? '3px solid #1a73e8' : '3px solid transparent',
              background: i === currentIndex ? 'var(--bg-hover, #f0f4ff)' : 'transparent',
              opacity: c.resolved ? 0.6 : 1,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{formatDate(c.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>{c.text}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {c.resolved
                ? <span style={{ fontSize: 11, color: '#34a853' }}>✓ Resolved</span>
                : <button onClick={e => { e.stopPropagation(); onResolveComment(c.id); }}
                    style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                    Resolve
                  </button>
              }
            </div>
          </div>
        ))}

        {activeTab === 'suggestions' && filteredSuggestions.map((s, i) => (
          <div key={s.id} onClick={() => { setCurrentIndex(i); onNavigateToItem('suggestion', s.id); }}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderLeft: i === currentIndex ? '3px solid #1a73e8' : '3px solid transparent',
              background: i === currentIndex ? 'var(--bg-hover, #f0f4ff)' : 'transparent',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{s.author}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{formatDate(s.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{
                padding: '1px 4px', borderRadius: 2, fontSize: 11, marginRight: 6,
                background: s.type === 'insert' ? '#e6f4ea' : '#fce8e6',
                color: s.type === 'insert' ? '#34a853' : '#ea4335',
              }}>{s.type}</span>
              {s.text}
            </div>
            {s.accepted === undefined ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); onAcceptSuggestion(s.id); }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer' }}>
                  <Check size={10} /> Accept
                </button>
                <button onClick={e => { e.stopPropagation(); onRejectSuggestion(s.id); }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, border: '1px solid #ea4335', background: '#fce8e6', color: '#ea4335', cursor: 'pointer' }}>
                  <XCircle size={10} /> Reject
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: s.accepted ? '#34a853' : '#ea4335' }}>
                {s.accepted ? '✓ Accepted' : '✗ Rejected'}
              </span>
            )}
          </div>
        ))}

        {activeTab === 'changes' && filteredChanges.map((ch, i) => (
          <div key={ch.id} onClick={() => { setCurrentIndex(i); onNavigateToItem('change', ch.id); }}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderLeft: i === currentIndex ? '3px solid #1a73e8' : '3px solid transparent',
              background: i === currentIndex ? 'var(--bg-hover, #f0f4ff)' : 'transparent',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ch.author}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{formatDate(ch.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{
                padding: '1px 4px', borderRadius: 2, fontSize: 11, marginRight: 6,
                background: ch.type === 'insertion' ? '#e6f4ea' : ch.type === 'deletion' ? '#fce8e6' : '#e8f0fe',
                color: ch.type === 'insertion' ? '#34a853' : ch.type === 'deletion' ? '#ea4335' : '#1a73e8',
              }}>{ch.type}</span>
              {ch.text}
            </div>
            {ch.accepted === undefined ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); onAcceptChange(ch.id); }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer' }}>
                  <Check size={10} /> Accept
                </button>
                <button onClick={e => { e.stopPropagation(); onRejectChange(ch.id); }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, border: '1px solid #ea4335', background: '#fce8e6', color: '#ea4335', cursor: 'pointer' }}>
                  <XCircle size={10} /> Reject
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: ch.accepted ? '#34a853' : '#ea4335' }}>
                {ch.accepted ? '✓ Accepted' : '✗ Rejected'}
              </span>
            )}
          </div>
        ))}

        {currentItems.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
            No {activeTab} found
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPanel;
