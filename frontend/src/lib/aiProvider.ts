/**
 * Provider-agnostic AI client.
 * API keys are stored in localStorage, never sent to our backend.
 */

export type AIProvider = 'openai' | 'anthropic';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'md-office-ai-settings';

export function loadAISettings(): AISettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAISettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAIConfigured(): boolean {
  const s = loadAISettings();
  return !!(s && s.apiKey);
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call AI completion API (OpenAI or Anthropic format).
 * Runs entirely in the browser — API key goes directly to the provider.
 */
export async function aiComplete(
  messages: ChatMessage[],
  settings?: AISettings | null,
): Promise<string> {
  const s = settings || loadAISettings();
  if (!s || !s.apiKey) {
    throw new Error('AI not configured. Please add your API key in Settings.');
  }

  if (s.provider === 'anthropic') {
    return callAnthropic(messages, s);
  }
  return callOpenAI(messages, s);
}

async function callOpenAI(messages: ChatMessage[], s: AISettings): Promise<string> {
  const model = s.model || 'gpt-4o-mini';
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(messages: ChatMessage[], s: AISettings): Promise<string> {
  const model = s.model || 'claude-sonnet-4-20250514';
  // Anthropic Messages API format
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMsg?.content || undefined,
      messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

/* ------------------------------------------------------------------ */
/*  Convenience helpers for specific use cases                         */
/* ------------------------------------------------------------------ */

export async function aiSummarize(text: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: 'You are a helpful writing assistant. Summarize the given text concisely.' },
    { role: 'user', content: text },
  ]);
}

export async function aiRewrite(text: string, instruction: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: 'You are a helpful writing assistant. Rewrite the text according to the instruction. Return only the rewritten text.' },
    { role: 'user', content: `Instruction: ${instruction}\n\nText:\n${text}` },
  ]);
}

export async function aiGrammarFix(text: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: 'Fix grammar and spelling errors in the given text. Return only the corrected text, preserving the original meaning and style.' },
    { role: 'user', content: text },
  ]);
}

export async function aiTranslate(text: string, targetLang: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: `Translate the given text to ${targetLang}. Return only the translation.` },
    { role: 'user', content: text },
  ]);
}

export async function aiExpand(text: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: 'Expand on the given text with more detail, examples, and depth. Keep the same tone and style.' },
    { role: 'user', content: text },
  ]);
}

export async function aiFormulaSuggestion(description: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: 'You are a spreadsheet formula expert. Given a description of what the user wants, suggest the appropriate spreadsheet formula. Return only the formula, starting with =. Use standard Excel/Google Sheets syntax.' },
    { role: 'user', content: description },
  ]);
}

export async function aiGenerateSlides(outline: string): Promise<string> {
  return aiComplete([
    { role: 'system', content: `You are a presentation designer. Given bullet points, generate a slide deck in this exact JSON format:
[{"title": "Slide Title", "bullets": ["Point 1", "Point 2"], "notes": "Speaker notes"}]
Return only valid JSON array.` },
    { role: 'user', content: outline },
  ]);
}
