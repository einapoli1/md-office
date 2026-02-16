import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QAQuestion {
  id: string;
  text: string;
  author: string;
  votes: number;
  votedBy: string[];
  answered: boolean;
  pinned: boolean;
  timestamp: number;
}

export interface QASession {
  code: string;
  questions: QAQuestion[];
  currentSlideIndex: number;
  currentSlideTitle: string;
  active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getStorageKey(code: string): string {
  return `md-qa-session-${code}`;
}

function getUserId(): string {
  let id = localStorage.getItem('md-qa-user-id');
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('md-qa-user-id', id);
  }
  return id;
}

// ── BroadcastChannel-based sync (same-origin, no server needed) ─────────

function getChannel(code: string): BroadcastChannel {
  return new BroadcastChannel(`md-qa-${code}`);
}

// ── Presenter Panel ────────────────────────────────────────────────────────

interface PresenterQAProps {
  slides: { content: string }[];
  currentSlideIndex: number;
  onClose: () => void;
}

export default function AudienceQA({ slides, currentSlideIndex, onClose }: PresenterQAProps) {
  const [session, setSession] = useState<QASession | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const broadcastState = useCallback((s: QASession) => {
    try {
      channelRef.current?.postMessage({ type: 'qa-state', session: s });
      localStorage.setItem(getStorageKey(s.code), JSON.stringify(s));
    } catch (_e) { /* ignore */ }
  }, []);

  // Start session
  const startSession = useCallback(() => {
    const code = generateSessionCode();
    const newSession: QASession = {
      code,
      questions: [],
      currentSlideIndex,
      currentSlideTitle: extractTitle(slides[currentSlideIndex]?.content || ''),
      active: true,
    };
    setSession(newSession);
    const ch = getChannel(code);
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'submit-question') {
        setSession(prev => {
          if (!prev) return prev;
          const q: QAQuestion = {
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            text: msg.text,
            author: msg.author,
            votes: 0,
            votedBy: [],
            answered: false,
            pinned: false,
            timestamp: Date.now(),
          };
          const next = { ...prev, questions: [...prev.questions, q] };
          broadcastState(next);
          return next;
        });
      } else if (msg.type === 'vote') {
        setSession(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            questions: prev.questions.map(q =>
              q.id === msg.questionId && !q.votedBy.includes(msg.userId)
                ? { ...q, votes: q.votes + 1, votedBy: [...q.votedBy, msg.userId] }
                : q
            ),
          };
          broadcastState(next);
          return next;
        });
      } else if (msg.type === 'request-state') {
        // New audience member requesting current state
        setSession(prev => {
          if (prev) broadcastState(prev);
          return prev;
        });
      }
    };

    broadcastState(newSession);
  }, [currentSlideIndex, slides, broadcastState]);

  // Sync slide changes
  useEffect(() => {
    if (!session) return;
    const title = extractTitle(slides[currentSlideIndex]?.content || '');
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, currentSlideIndex, currentSlideTitle: title };
      broadcastState(next);
      return next;
    });
  }, [currentSlideIndex, slides, session?.code, broadcastState]);

  // Cleanup
  useEffect(() => {
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const toggleAnswered = useCallback((qId: string) => {
    setSession(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        questions: prev.questions.map(q =>
          q.id === qId ? { ...q, answered: !q.answered } : q
        ),
      };
      broadcastState(next);
      return next;
    });
  }, [broadcastState]);

  const togglePinned = useCallback((qId: string) => {
    setSession(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        questions: prev.questions.map(q =>
          q.id === qId ? { ...q, pinned: !q.pinned } : { ...q, pinned: false }
        ),
      };
      broadcastState(next);
      return next;
    });
  }, [broadcastState]);

  const endSession = useCallback(() => {
    if (session) {
      const ended = { ...session, active: false };
      broadcastState(ended);
      localStorage.removeItem(getStorageKey(session.code));
    }
    channelRef.current?.close();
    setSession(null);
  }, [session, broadcastState]);

  if (!session) {
    return (
      <div className="qa-panel">
        <div className="qa-header">
          <h3>📋 Audience Q&A</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="qa-start">
          <p>Start a live Q&A session. Audience members can submit and vote on questions.</p>
          <button className="btn-primary" onClick={startSession}>Start Q&A Session</button>
        </div>
      </div>
    );
  }

  const pinnedQ = session.questions.find(q => q.pinned);
  const unanswered = session.questions
    .filter(q => !q.answered)
    .sort((a, b) => b.votes - a.votes);
  const answered = session.questions
    .filter(q => q.answered)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="qa-panel">
      <div className="qa-header">
        <h3>📋 Q&A Live</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="qa-session-info">
        <span className="qa-code-label">Session Code:</span>
        <span className="qa-code">{session.code}</span>
        <span className="qa-question-count">{session.questions.length} questions</span>
      </div>

      {pinnedQ && (
        <div className="qa-pinned">
          <span className="qa-pin-icon">📌</span>
          <span className="qa-pinned-text">{pinnedQ.text}</span>
        </div>
      )}

      <div className="qa-questions-list">
        {unanswered.length === 0 && answered.length === 0 && (
          <div className="qa-empty">No questions yet. Share the code with your audience!</div>
        )}
        {unanswered.map(q => (
          <div key={q.id} className={`qa-question ${q.pinned ? 'pinned' : ''}`}>
            <div className="qa-votes">
              <span className="qa-vote-count">▲ {q.votes}</span>
            </div>
            <div className="qa-question-body">
              <div className="qa-question-text">{q.text}</div>
              <div className="qa-question-meta">from {q.author}</div>
            </div>
            <div className="qa-question-actions">
              <button onClick={() => togglePinned(q.id)} title="Pin">{q.pinned ? '📌' : '📍'}</button>
              <button onClick={() => toggleAnswered(q.id)} title="Mark answered">✓</button>
            </div>
          </div>
        ))}
        {answered.length > 0 && <h4 className="qa-answered-header">Answered</h4>}
        {answered.map(q => (
          <div key={q.id} className="qa-question answered">
            <div className="qa-votes">
              <span className="qa-vote-count">▲ {q.votes}</span>
            </div>
            <div className="qa-question-body">
              <div className="qa-question-text">{q.text}</div>
              <div className="qa-question-meta">from {q.author}</div>
            </div>
            <div className="qa-question-actions">
              <button onClick={() => toggleAnswered(q.id)} title="Unmark">↩</button>
            </div>
          </div>
        ))}
      </div>

      <div className="qa-footer">
        <button className="btn-danger" onClick={endSession}>End Session</button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled Slide';
}

export { getUserId, getChannel, getStorageKey };
