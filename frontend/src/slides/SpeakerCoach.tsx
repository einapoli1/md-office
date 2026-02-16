import { useState, useEffect, useRef, useCallback } from 'react';
import { Slide } from './slideModel';

// ── Types ──────────────────────────────────────────────────────────────────

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'so'] as const;
type FillerWord = typeof FILLER_WORDS[number];

interface SlideStats {
  slideIndex: number;
  startTime: number;
  endTime: number;
  wordCount: number;
  fillerCounts: Record<FillerWord, number>;
  wpmSamples: number[];
}

interface SessionSummary {
  totalTime: number;
  slideStats: SlideStats[];
  averageWPM: number;
  totalFillerCounts: Record<FillerWord, number>;
  pacingScore: number;
  tips: string[];
}

interface Props {
  slides: Slide[];
  currentSlideIndex: number;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countFillers(text: string): Record<FillerWord, number> {
  const lower = text.toLowerCase();
  const counts = {} as Record<FillerWord, number>;
  for (const fw of FILLER_WORDS) {
    const regex = new RegExp(`\\b${fw.replace(' ', '\\s+')}\\b`, 'gi');
    counts[fw] = (lower.match(regex) || []).length;
  }
  return counts;
}

function computePacingScore(wpmSamples: number[]): number {
  if (wpmSamples.length < 2) return 5;
  const mean = wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length;
  const variance = wpmSamples.reduce((s, v) => s + (v - mean) ** 2, 0) / wpmSamples.length;
  const cv = Math.sqrt(variance) / (mean || 1);
  // Lower CV = more consistent = higher score
  const inRange = mean >= 120 && mean <= 150 ? 2 : 0;
  const consistencyScore = Math.max(1, Math.min(8, Math.round(8 - cv * 10)));
  return Math.min(10, consistencyScore + inRange);
}

function generateTips(summary: SessionSummary): string[] {
  const tips: string[] = [];
  if (summary.averageWPM < 110) tips.push('Try speaking a bit faster — your pace is below the ideal 120-150 WPM range.');
  if (summary.averageWPM > 160) tips.push('Slow down a little — you\'re speaking above the ideal 120-150 WPM range.');
  const totalFillers = Object.values(summary.totalFillerCounts).reduce((a, b) => a + b, 0);
  if (totalFillers > 5) {
    const worst = Object.entries(summary.totalFillerCounts).sort((a, b) => b[1] - a[1])[0];
    tips.push(`You used "${worst[0]}" ${worst[1]} times. Try pausing silently instead.`);
  }
  const slideTimes = summary.slideStats.map(s => s.endTime - s.startTime);
  const maxTime = Math.max(...slideTimes);
  const minTime = Math.min(...slideTimes.filter(t => t > 0));
  if (maxTime > 0 && minTime > 0 && maxTime / minTime > 3) {
    tips.push('Some slides took much longer than others. Consider balancing content across slides.');
  }
  if (summary.pacingScore >= 8) tips.push('Great pacing! Your delivery was very consistent.');
  if (tips.length === 0) tips.push('Good job! Keep practicing to refine your delivery.');
  return tips;
}

// ── WPM Gauge ──────────────────────────────────────────────────────────────

function WPMGauge({ wpm }: { wpm: number }) {
  const pct = Math.min(100, (wpm / 200) * 100);
  const color = wpm >= 120 && wpm <= 150 ? '#4caf50' : wpm < 100 || wpm > 170 ? '#f44336' : '#ff9800';
  return (
    <div className="speaker-coach-gauge">
      <div className="gauge-label">WPM</div>
      <div className="gauge-bar">
        <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
        <div className="gauge-target" style={{ left: '60%', width: '15%' }} />
      </div>
      <div className="gauge-value" style={{ color }}>{wpm}</div>
    </div>
  );
}

// ── Summary View ───────────────────────────────────────────────────────────

function SummaryView({ summary, slides: _slides, onClose }: { summary: SessionSummary; slides: Slide[]; onClose: () => void }) {
  const maxSlideTime = Math.max(...summary.slideStats.map(s => s.endTime - s.startTime), 1);
  const fmt = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="speaker-coach-summary">
      <h2>Rehearsal Summary</h2>
      <div className="summary-stats-row">
        <div className="summary-stat">
          <span className="stat-value">{fmt(summary.totalTime)}</span>
          <span className="stat-label">Total Time</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">{Math.round(summary.averageWPM)}</span>
          <span className="stat-label">Avg WPM</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">{summary.pacingScore}/10</span>
          <span className="stat-label">Pacing Score</span>
        </div>
      </div>

      <h3>Time per Slide</h3>
      <div className="slide-time-chart">
        {summary.slideStats.map((ss, i) => {
          const dur = ss.endTime - ss.startTime;
          const pct = (dur / maxSlideTime) * 100;
          return (
            <div key={i} className="slide-time-bar-row">
              <span className="slide-time-label">Slide {i + 1}</span>
              <div className="slide-time-bar">
                <div className="slide-time-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="slide-time-value">{fmt(dur)}</span>
            </div>
          );
        })}
      </div>

      <h3>Filler Words</h3>
      <div className="filler-breakdown">
        {FILLER_WORDS.filter(fw => summary.totalFillerCounts[fw] > 0).map(fw => (
          <span key={fw} className="filler-chip">{fw}: {summary.totalFillerCounts[fw]}</span>
        ))}
        {Object.values(summary.totalFillerCounts).every(c => c === 0) && (
          <span className="filler-none">No filler words detected! 🎉</span>
        )}
      </div>

      <h3>Tips</h3>
      <ul className="summary-tips">
        {summary.tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>

      <button className="btn-primary" onClick={onClose}>Done</button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SpeakerCoach({ slides, currentSlideIndex, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentWPM, setCurrentWPM] = useState(0);
  const [fillerCounts, setFillerCounts] = useState<Record<FillerWord, number>>(() => {
    const c = {} as Record<FillerWord, number>;
    for (const fw of FILLER_WORDS) c[fw] = 0;
    return c;
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [slideElapsedMs, setSlideElapsedMs] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [silenceDuration, setSilenceDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const slideStartRef = useRef(0);
  const slideStatsRef = useRef<SlideStats[]>([]);
  const wpmSamplesRef = useRef<number[]>([]);
  const wordBufferRef = useRef(0);
  const lastSpeechRef = useRef(Date.now());
  const slideIdxRef = useRef(currentSlideIndex);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const activeRef = useRef(false);

  // Track slide changes
  useEffect(() => {
    if (!isRecording) return;
    const now = Date.now();
    // Save current slide stats
    const prev = slideStatsRef.current[slideStatsRef.current.length - 1];
    if (prev && prev.slideIndex === slideIdxRef.current) {
      prev.endTime = now;
    }
    // Start new slide stats
    slideIdxRef.current = currentSlideIndex;
    slideStartRef.current = now;
    const newStats: SlideStats = {
      slideIndex: currentSlideIndex,
      startTime: now,
      endTime: now,
      wordCount: 0,
      fillerCounts: (() => { const c = {} as Record<FillerWord, number>; for (const fw of FILLER_WORDS) c[fw] = 0; return c; })(),
      wpmSamples: [],
    };
    slideStatsRef.current.push(newStats);
    setSlideElapsedMs(0);
  }, [currentSlideIndex, isRecording]);

  const stopRecognition = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_e) { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const finishSession = useCallback(() => {
    stopRecognition();
    setIsRecording(false);
    const now = Date.now();
    // Close last slide stats
    const last = slideStatsRef.current[slideStatsRef.current.length - 1];
    if (last) last.endTime = now;

    const totalTime = now - startTimeRef.current;
    const allWPM = wpmSamplesRef.current;
    const avgWPM = allWPM.length > 0 ? allWPM.reduce((a, b) => a + b, 0) / allWPM.length : 0;

    const totalFillers = {} as Record<FillerWord, number>;
    for (const fw of FILLER_WORDS) totalFillers[fw] = 0;
    for (const ss of slideStatsRef.current) {
      for (const fw of FILLER_WORDS) totalFillers[fw] += ss.fillerCounts[fw];
    }

    const pacingScore = computePacingScore(allWPM);
    const summaryData: SessionSummary = {
      totalTime,
      slideStats: slideStatsRef.current,
      averageWPM: avgWPM,
      totalFillerCounts: totalFillers,
      pacingScore,
      tips: [],
    };
    summaryData.tips = generateTips(summaryData);
    setSummary(summaryData);
  }, [stopRecognition]);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    activeRef.current = true;

    const now = Date.now();
    startTimeRef.current = now;
    slideStartRef.current = now;
    lastSpeechRef.current = now;
    wordBufferRef.current = 0;
    wpmSamplesRef.current = [];
    slideStatsRef.current = [{
      slideIndex: currentSlideIndex,
      startTime: now,
      endTime: now,
      wordCount: 0,
      fillerCounts: (() => { const c = {} as Record<FillerWord, number>; for (const fw of FILLER_WORDS) c[fw] = 0; return c; })(),
      wpmSamples: [],
    }];

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      const words = transcript.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return;

      lastSpeechRef.current = Date.now();
      wordBufferRef.current += words.length;
      setTotalWords(w => w + words.length);

      // Count fillers
      const fillers = countFillers(transcript);
      setFillerCounts(prev => {
        const next = { ...prev };
        for (const fw of FILLER_WORDS) next[fw] += fillers[fw];
        return next;
      });

      // Update current slide stats
      const currentStats = slideStatsRef.current[slideStatsRef.current.length - 1];
      if (currentStats) {
        currentStats.wordCount += words.length;
        for (const fw of FILLER_WORDS) currentStats.fillerCounts[fw] += fillers[fw];
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (activeRef.current) {
        try { recognition.start(); } catch (_e) { /* ignore */ }
      }
    };

    recognition.start();
    setIsRecording(true);
    setSummary(null);

    // Timer for WPM sampling and elapsed time
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);
      setSlideElapsedMs(Date.now() - slideStartRef.current);

      // Compute WPM from rolling word buffer (sample every 3s)
      const minutes = elapsed / 60000;
      if (minutes > 0) {
        const wpm = Math.round(wordBufferRef.current / minutes);
        setCurrentWPM(wpm);
        wpmSamplesRef.current.push(wpm);
        const currentStats = slideStatsRef.current[slideStatsRef.current.length - 1];
        if (currentStats) currentStats.wpmSamples.push(wpm);
      }

      // Silence detection
      const silenceMs = Date.now() - lastSpeechRef.current;
      setSilenceDuration(Math.floor(silenceMs / 1000));
    }, 1000);
  }, [currentSlideIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const totalFillerCount = Object.values(fillerCounts).reduce((a, b) => a + b, 0);

  if (summary) {
    return (
      <div className="speaker-coach-overlay">
        <SummaryView summary={summary} slides={slides} onClose={onClose} />
      </div>
    );
  }

  return (
    <div className="speaker-coach-overlay">
      <div className="speaker-coach-panel">
        <div className="speaker-coach-header">
          <h3>🎤 Speaker Coach</h3>
          <button className="btn-close" onClick={() => { stopRecognition(); onClose(); }}>✕</button>
        </div>

        {!isRecording ? (
          <div className="speaker-coach-start">
            <p>Practice your presentation with real-time feedback on pacing, filler words, and timing.</p>
            <button className="btn-primary" onClick={startRecording}>▶ Start Rehearsal</button>
          </div>
        ) : (
          <div className="speaker-coach-live">
            <WPMGauge wpm={currentWPM} />

            <div className="coach-stats-grid">
              <div className="coach-stat">
                <span className="coach-stat-value">{fmt(elapsedMs)}</span>
                <span className="coach-stat-label">Total Time</span>
              </div>
              <div className="coach-stat">
                <span className="coach-stat-value">{fmt(slideElapsedMs)}</span>
                <span className="coach-stat-label">Slide Time</span>
              </div>
              <div className="coach-stat">
                <span className="coach-stat-value">{totalFillerCount}</span>
                <span className="coach-stat-label">Filler Words</span>
              </div>
              <div className="coach-stat">
                <span className="coach-stat-value">{totalWords}</span>
                <span className="coach-stat-label">Words</span>
              </div>
            </div>

            {silenceDuration > 5 && (
              <div className="coach-silence-warning">⏸ Silence: {silenceDuration}s</div>
            )}

            <div className="coach-filler-list">
              {FILLER_WORDS.filter(fw => fillerCounts[fw] > 0).map(fw => (
                <span key={fw} className="filler-chip warning">{fw}: {fillerCounts[fw]}</span>
              ))}
            </div>

            <div className="coach-slide-info">
              Slide {currentSlideIndex + 1} of {slides.length}
            </div>

            <div className="coach-actions">
              <button className="btn-danger" onClick={finishSession}>⏹ Stop & Review</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { FILLER_WORDS, countFillers, computePacingScore, generateTips };
export type { SessionSummary, SlideStats };
