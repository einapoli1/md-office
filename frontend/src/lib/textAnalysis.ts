// Pure text analysis functions

const STOP_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','her','she','or',
  'an','will','my','one','all','would','there','their','what','so','up','out','if','about',
  'who','get','which','go','me','when','make','can','like','time','no','just','him','know',
  'take','people','into','year','your','good','some','could','them','see','other','than',
  'then','now','look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any','these',
  'give','day','most','us','is','was','are','were','been','has','had','did','does','am',
  'being','having','doing','said','say','says','very','much','more','many','such','own',
]);

export function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return w.length > 0 ? 1 : 0;
  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // silent e
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--;
  // -ed ending
  if (w.endsWith('ed') && w.length > 3 && count > 1) count--;
  return Math.max(count, 1);
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

export function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return Math.max(sentences.length, text.trim().length > 0 ? 1 : 0);
}

export function countParagraphs(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  return Math.max(paragraphs.length, text.trim().length > 0 ? 1 : 0);
}

export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

function getWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(w => w.length > 0);
}

export function wordFrequency(text: string): [string, number][] {
  const freq = new Map<string, number>();
  const words = getWords(text);
  for (const word of words) {
    const w = word.toLowerCase().replace(/[^a-z'-]/g, '');
    if (w.length === 0 || STOP_WORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
}

export function estimateReadingTime(text: string, wpm = 250): number {
  return countWords(text) / wpm;
}

export function estimateSpeakingTime(text: string, wpm = 130): number {
  return countWords(text) / wpm;
}

export function averageWordLength(text: string): number {
  const words = getWords(text);
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0);
  return total / words.length;
}

export function averageSentenceLength(text: string): number {
  const sentences = countSentences(text);
  if (sentences === 0) return 0;
  return countWords(text) / sentences;
}

export function vocabularyRichness(text: string): number {
  const words = getWords(text).map(w => w.toLowerCase().replace(/[^a-z'-]/g, '')).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

export function fleschReadingEase(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  if (words === 0 || sentences === 0) return 0;
  const totalSyllables = getWords(text).reduce((sum, w) => sum + syllableCount(w), 0);
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (totalSyllables / words);
}

export function fleschKincaid(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  if (words === 0 || sentences === 0) return 0;
  const totalSyllables = getWords(text).reduce((sum, w) => sum + syllableCount(w), 0);
  return 0.39 * (words / sentences) + 11.8 * (totalSyllables / words) - 15.59;
}

export function gunningFog(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  if (words === 0 || sentences === 0) return 0;
  const complexWords = getWords(text).filter(w => syllableCount(w) >= 3).length;
  return 0.4 * ((words / sentences) + 100 * (complexWords / words));
}

export function sentenceLengthDistribution(text: string): { range: string; count: number }[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const ranges = [
    { range: '1-5', min: 1, max: 5, count: 0 },
    { range: '6-10', min: 6, max: 10, count: 0 },
    { range: '11-15', min: 11, max: 15, count: 0 },
    { range: '16-20', min: 16, max: 20, count: 0 },
    { range: '21-25', min: 21, max: 25, count: 0 },
    { range: '26-30', min: 26, max: 30, count: 0 },
    { range: '31+', min: 31, max: Infinity, count: 0 },
  ];
  for (const s of sentences) {
    const wc = s.trim().split(/\s+/).filter(w => w.length > 0).length;
    for (const r of ranges) {
      if (wc >= r.min && wc <= r.max) { r.count++; break; }
    }
  }
  return ranges.map(({ range, count }) => ({ range, count }));
}
