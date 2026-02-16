import { useState, useEffect, useRef, useCallback } from 'react';
import type { QASession } from './AudienceQA';
import { getUserId, getChannel } from './AudienceQA';

// ── Audience View ──────────────────────────────────────────────────────────

export default function AudienceView() {
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState<QASession | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('md-qa-display-name') || '');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const userId = getUserId();

  const joinSession = useCallback(() => {
    if (!code.trim() || !displayName.trim()) return;
    localStorage.setItem('md-qa-display-name', displayName);

    const ch = getChannel(code.toUpperCase().trim());
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'qa-state' && msg.session) {
        setSession(msg.session);
      }
    };

    // Request current state from presenter
    ch.postMessage({ type: 'request-state' });

    // Also try loading from localStorage as fallback
    try {
      const stored = localStorage.getItem(`md-qa-session-${code.toUpperCase().trim()}`);
      if (stored) setSession(JSON.parse(stored));
    } catch (_e) { /* ignore */ }

    setJoined(true);
  }, [code, displayName]);

  // Cleanup
  useEffect(() => {
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const submitQuestion = useCallback(() => {
    if (!questionText.trim() || !channelRef.current) return;
    channelRef.current.postMessage({
      type: 'submit-question',
      text: questionText.trim(),
      author: displayName,
      userId,
    });
    setQuestionText('');
  }, [questionText, displayName, userId]);

  const vote = useCallback((questionId: string) => {
    channelRef.current?.postMessage({
      type: 'vote',
      questionId,
      userId,
    });
  }, [userId]);

  // ── Join Screen ──────────────────────────────────────────────────────────

  if (!joined) {
    return (
      <div className="audience-view">
        <div className="audience-join">
          <h2>Join Q&A Session</h2>
          <div className="audience-join-form">
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="audience-input"
            />
            <input
              type="text"
              placeholder="Session code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="audience-input code-input"
            />
            <button
              className="btn-primary"
              onClick={joinSession}
              disabled={!code.trim() || !displayName.trim()}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Session Not Found ────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="audience-view">
        <div className="audience-waiting">
          <h2>Connecting...</h2>
          <p>Waiting for the presenter to start the session ({code})</p>
          <button className="btn-secondary" onClick={() => { setJoined(false); channelRef.current?.close(); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!session.active) {
    return (
      <div className="audience-view">
        <div className="audience-ended">
          <h2>Session Ended</h2>
          <p>The Q&A session has ended. Thank you for participating!</p>
          <button className="btn-secondary" onClick={() => { setJoined(false); setSession(null); channelRef.current?.close(); }}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  // ── Active Session ───────────────────────────────────────────────────────

  const sortedQuestions = [...session.questions]
    .filter(q => !q.answered)
    .sort((a, b) => b.votes - a.votes);
  const answeredQuestions = session.questions.filter(q => q.answered);

  return (
    <div className="audience-view">
      <div className="audience-header">
        <div className="audience-slide-info">
          <span className="audience-slide-num">Slide {session.currentSlideIndex + 1}</span>
          <span className="audience-slide-title">{session.currentSlideTitle}</span>
        </div>
        <span className="audience-code">Code: {session.code}</span>
      </div>

      <div className="audience-question-form">
        <input
          type="text"
          placeholder="Ask a question..."
          value={questionText}
          onChange={e => setQuestionText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitQuestion(); }}
          className="audience-input"
        />
        <button
          className="btn-primary"
          onClick={submitQuestion}
          disabled={!questionText.trim()}
        >
          Ask
        </button>
      </div>

      <div className="audience-questions">
        {sortedQuestions.length === 0 && answeredQuestions.length === 0 && (
          <div className="audience-empty">No questions yet. Be the first to ask!</div>
        )}
        {sortedQuestions.map(q => (
          <div key={q.id} className={`audience-question ${q.pinned ? 'pinned' : ''}`}>
            <button
              className={`audience-vote-btn ${q.votedBy.includes(userId) ? 'voted' : ''}`}
              onClick={() => vote(q.id)}
              disabled={q.votedBy.includes(userId)}
            >
              ▲ {q.votes}
            </button>
            <div className="audience-question-body">
              <div className="audience-question-text">{q.text}</div>
              <div className="audience-question-author">{q.author}</div>
            </div>
            {q.pinned && <span className="audience-pin">📌</span>}
          </div>
        ))}
        {answeredQuestions.length > 0 && (
          <>
            <div className="audience-answered-divider">Answered</div>
            {answeredQuestions.map(q => (
              <div key={q.id} className="audience-question answered">
                <span className="audience-vote-count">▲ {q.votes}</span>
                <div className="audience-question-body">
                  <div className="audience-question-text">{q.text}</div>
                  <div className="audience-question-author">{q.author}</div>
                </div>
                <span className="audience-check">✓</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
