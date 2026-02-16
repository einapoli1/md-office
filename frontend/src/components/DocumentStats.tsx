import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  countWords, countSentences, countParagraphs, countCharacters,
  averageWordLength, averageSentenceLength, vocabularyRichness,
  fleschReadingEase, fleschKincaid, gunningFog,
  wordFrequency, estimateReadingTime, estimateSpeakingTime,
  sentenceLengthDistribution,
} from '../lib/textAnalysis';

interface Props {
  content: string;
  onClose: () => void;
}

const DocumentStats: React.FC<Props> = ({ content, onClose }) => {
  const [wpm, setWpm] = useState(250);

  const stats = useMemo(() => {
    const words = countWords(content);
    const sentences = countSentences(content);
    const paragraphs = countParagraphs(content);
    const charsWithSpaces = countCharacters(content, true);
    const charsNoSpaces = countCharacters(content, false);
    const avgWordLen = averageWordLength(content);
    const avgSentLen = averageSentenceLength(content);
    const richness = vocabularyRichness(content);
    const fre = fleschReadingEase(content);
    const fk = fleschKincaid(content);
    const gf = gunningFog(content);
    const topWords = wordFrequency(content).slice(0, 10);
    const readingTime = estimateReadingTime(content, wpm);
    const speakingTime = estimateSpeakingTime(content);
    const sentDist = sentenceLengthDistribution(content);
    return { words, sentences, paragraphs, charsWithSpaces, charsNoSpaces, avgWordLen, avgSentLen, richness, fre, fk, gf, topWords, readingTime, speakingTime, sentDist };
  }, [content, wpm]);

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    const m = Math.round(minutes);
    return m === 1 ? '1 min' : `${m} min`;
  };

  const maxWordCount = stats.topWords.length > 0 ? stats.topWords[0][1] : 1;
  const maxSentDist = Math.max(...stats.sentDist.map(d => d.count), 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 18 }}>Document Statistics</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px', fontSize: 14, lineHeight: 1.6 }}>
          {/* Basic counts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20 }}>
            <div><strong>Words:</strong> {stats.words.toLocaleString()}</div>
            <div><strong>Characters:</strong> {stats.charsWithSpaces.toLocaleString()}</div>
            <div><strong>Characters (no spaces):</strong> {stats.charsNoSpaces.toLocaleString()}</div>
            <div><strong>Sentences:</strong> {stats.sentences.toLocaleString()}</div>
            <div><strong>Paragraphs:</strong> {stats.paragraphs.toLocaleString()}</div>
            <div><strong>Avg word length:</strong> {stats.avgWordLen.toFixed(1)}</div>
            <div><strong>Avg sentence length:</strong> {stats.avgSentLen.toFixed(1)} words</div>
            <div><strong>Vocabulary richness:</strong> {(stats.richness * 100).toFixed(1)}%</div>
          </div>

          {/* Time estimates */}
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Time Estimates</h3>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span>Reading time at</span>
              <select value={wpm} onChange={e => setWpm(Number(e.target.value))} style={{ padding: '2px 4px' }}>
                <option value={200}>200</option>
                <option value={250}>250</option>
                <option value={300}>300</option>
              </select>
              <span>wpm: <strong>{formatTime(stats.readingTime)}</strong></span>
            </div>
            <div>Speaking time (130 wpm): <strong>{formatTime(stats.speakingTime)}</strong></div>
          </div>

          {/* Readability */}
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Readability</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20 }}>
            <div><strong>Flesch Reading Ease:</strong> {stats.fre.toFixed(1)}</div>
            <div><strong>Flesch-Kincaid Grade:</strong> {stats.fk.toFixed(1)}</div>
            <div><strong>Gunning Fog Index:</strong> {stats.gf.toFixed(1)}</div>
          </div>

          {/* Top words */}
          {stats.topWords.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Top 10 Words</h3>
              <div style={{ marginBottom: 20 }}>
                {stats.topWords.map(([word, count]) => (
                  <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 80, textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{word}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary, #eee)', borderRadius: 3, height: 18, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxWordCount) * 100}%`, background: 'var(--accent-color, #4285f4)', height: '100%', borderRadius: 3, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#888', width: 30 }}>{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Sentence length distribution */}
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Sentence Length Distribution</h3>
          <div>
            {stats.sentDist.map(({ range, count }) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ width: 50, textAlign: 'right', fontSize: 12, color: '#666' }}>{range}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary, #eee)', borderRadius: 3, height: 16, overflow: 'hidden' }}>
                  <div style={{ width: `${(count / maxSentDist) * 100}%`, background: 'var(--accent-color, #4285f4)', height: '100%', borderRadius: 3, minWidth: count > 0 ? 2 : 0 }} />
                </div>
                <span style={{ fontSize: 12, color: '#888', width: 24 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentStats;
