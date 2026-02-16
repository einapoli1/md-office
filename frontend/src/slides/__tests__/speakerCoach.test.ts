import { describe, it, expect } from 'vitest';
import { countFillers, computePacingScore, generateTips, FILLER_WORDS } from '../SpeakerCoach';
import type { SessionSummary } from '../SpeakerCoach';

describe('SpeakerCoach helpers', () => {
  describe('countFillers', () => {
    it('counts filler words in text', () => {
      const result = countFillers('Um so like I was um basically saying you know');
      expect(result['um']).toBe(2);
      expect(result['like']).toBe(1);
      expect(result['basically']).toBe(1);
      expect(result['you know']).toBe(1);
      expect(result['so']).toBe(1);
    });

    it('returns zero for clean text', () => {
      const result = countFillers('The presentation covers three main topics');
      for (const fw of FILLER_WORDS) {
        expect(result[fw]).toBe(0);
      }
    });

    it('handles empty text', () => {
      const result = countFillers('');
      for (const fw of FILLER_WORDS) {
        expect(result[fw]).toBe(0);
      }
    });
  });

  describe('computePacingScore', () => {
    it('returns 5 for too few samples', () => {
      expect(computePacingScore([130])).toBe(5);
    });

    it('gives high score for consistent pace in ideal range', () => {
      const score = computePacingScore([130, 135, 128, 132, 140]);
      expect(score).toBeGreaterThanOrEqual(7);
    });

    it('gives lower score for variable pace', () => {
      const score = computePacingScore([80, 180, 90, 170, 85]);
      expect(score).toBeLessThan(7);
    });
  });

  describe('generateTips', () => {
    it('suggests speaking faster when WPM is low', () => {
      const summary: SessionSummary = {
        totalTime: 60000,
        slideStats: [],
        averageWPM: 90,
        totalFillerCounts: { um: 0, uh: 0, like: 0, 'you know': 0, basically: 0, actually: 0, so: 0 },
        pacingScore: 5,
        tips: [],
      };
      const tips = generateTips(summary);
      expect(tips.some(t => t.includes('faster'))).toBe(true);
    });

    it('warns about filler words', () => {
      const summary: SessionSummary = {
        totalTime: 60000,
        slideStats: [],
        averageWPM: 130,
        totalFillerCounts: { um: 10, uh: 3, like: 2, 'you know': 0, basically: 0, actually: 0, so: 0 },
        pacingScore: 7,
        tips: [],
      };
      const tips = generateTips(summary);
      expect(tips.some(t => t.includes('"um"'))).toBe(true);
    });
  });
});
