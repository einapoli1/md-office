import { describe, it, expect } from 'vitest';
import {
  syllableCount, countWords, countSentences, countParagraphs, countCharacters,
  wordFrequency, estimateReadingTime, estimateSpeakingTime, averageWordLength,
  averageSentenceLength, vocabularyRichness, fleschReadingEase, fleschKincaid,
  gunningFog, sentenceLengthDistribution,
} from '../lib/textAnalysis';

describe('syllableCount', () => {
  it('counts single-syllable words', () => {
    expect(syllableCount('cat')).toBe(1);
    expect(syllableCount('dog')).toBe(1);
  });
  it('counts multi-syllable words', () => {
    expect(syllableCount('beautiful')).toBeGreaterThanOrEqual(2);
    expect(syllableCount('information')).toBeGreaterThanOrEqual(3);
  });
  it('returns 0 for empty string', () => {
    expect(syllableCount('')).toBe(0);
  });
  it('returns 1 for short words', () => {
    expect(syllableCount('I')).toBe(1);
    expect(syllableCount('a')).toBe(1);
  });
  it('strips non-alpha characters', () => {
    expect(syllableCount('hello!')).toBe(2);
  });
});

describe('countWords', () => {
  it('counts words in normal text', () => {
    expect(countWords('hello world')).toBe(2);
  });
  it('returns 0 for empty text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
  it('handles multiple spaces', () => {
    expect(countWords('one   two   three')).toBe(3);
  });
});

describe('countSentences', () => {
  it('counts sentences by punctuation', () => {
    expect(countSentences('Hello. World!')).toBe(2);
  });
  it('returns 1 for text without punctuation', () => {
    expect(countSentences('hello world')).toBe(1);
  });
  it('returns 0 for empty text', () => {
    expect(countSentences('')).toBe(0);
  });
});

describe('countParagraphs', () => {
  it('counts paragraphs separated by blank lines', () => {
    expect(countParagraphs('Para one\n\nPara two')).toBe(2);
  });
  it('returns 1 for single paragraph', () => {
    expect(countParagraphs('Just one paragraph')).toBe(1);
  });
  it('returns 0 for empty text', () => {
    expect(countParagraphs('')).toBe(0);
  });
});

describe('countCharacters', () => {
  it('counts with spaces', () => {
    expect(countCharacters('hi there')).toBe(8);
  });
  it('counts without spaces', () => {
    expect(countCharacters('hi there', false)).toBe(7);
  });
});

describe('wordFrequency', () => {
  it('returns sorted frequency excluding stop words', () => {
    const result = wordFrequency('apple banana apple cherry apple banana');
    expect(result[0]).toEqual(['apple', 3]);
    expect(result[1]).toEqual(['banana', 2]);
  });
  it('returns empty for empty text', () => {
    expect(wordFrequency('')).toEqual([]);
  });
  it('excludes stop words', () => {
    const result = wordFrequency('the the the apple');
    expect(result).toEqual([['apple', 1]]);
  });
});

describe('readability scores', () => {
  const text = 'The cat sat on the mat. The dog ran in the park. It was a sunny day.';

  it('fleschReadingEase returns a number', () => {
    const score = fleschReadingEase(text);
    expect(score).toBeGreaterThan(0);
  });
  it('fleschKincaid returns a grade level', () => {
    const score = fleschKincaid(text);
    expect(typeof score).toBe('number');
  });
  it('gunningFog returns a number', () => {
    const score = gunningFog(text);
    expect(score).toBeGreaterThan(0);
  });
  it('returns 0 for empty text', () => {
    expect(fleschReadingEase('')).toBe(0);
    expect(fleschKincaid('')).toBe(0);
    expect(gunningFog('')).toBe(0);
  });
});

describe('estimateReadingTime', () => {
  it('estimates based on word count and WPM', () => {
    const text = Array(250).fill('word').join(' ');
    expect(estimateReadingTime(text)).toBeCloseTo(1, 1);
  });
});

describe('estimateSpeakingTime', () => {
  it('estimates slower than reading', () => {
    const text = 'word '.repeat(130);
    expect(estimateSpeakingTime(text)).toBeCloseTo(1, 1);
  });
});

describe('averageWordLength', () => {
  it('computes average', () => {
    expect(averageWordLength('cat dog')).toBeCloseTo(3, 0);
  });
  it('returns 0 for empty', () => {
    expect(averageWordLength('')).toBe(0);
  });
});

describe('averageSentenceLength', () => {
  it('computes words per sentence', () => {
    expect(averageSentenceLength('One two. Three four.')).toBeCloseTo(2, 0);
  });
});

describe('vocabularyRichness', () => {
  it('returns 1 for all unique words', () => {
    expect(vocabularyRichness('alpha beta gamma')).toBe(1);
  });
  it('returns less than 1 for repeated words', () => {
    expect(vocabularyRichness('hello hello hello')).toBeLessThan(1);
  });
  it('returns 0 for empty', () => {
    expect(vocabularyRichness('')).toBe(0);
  });
});

describe('sentenceLengthDistribution', () => {
  it('distributes sentences into ranges', () => {
    const dist = sentenceLengthDistribution('Short. Also short.');
    expect(dist.find(r => r.range === '1-5')!.count).toBe(2);
  });
});
