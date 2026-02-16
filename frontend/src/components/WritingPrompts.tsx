import React, { useState, useMemo, memo } from 'react';
import { X, Sparkles, Type, Lightbulb, ArrowRight } from 'lucide-react';

interface WritingPromptsProps {
  editor: any;
  onClose: () => void;
}

type Tab = 'continue' | 'starters' | 'prompts';
type StarterCategory = 'narrative' | 'argumentative' | 'descriptive' | 'transition';
type PromptCategory = 'fiction' | 'academic' | 'business' | 'creative';

const SENTENCE_STARTERS: Record<StarterCategory, string[]> = {
  narrative: [
    'It all began when...',
    'Little did they know...',
    'As the sun set over the horizon...',
    'The moment everything changed was...',
    'Years later, looking back...',
    'In the heart of the city...',
    'Without warning...',
    'The silence was broken by...',
    'From that day forward...',
    'Once upon a time, in a place not so different from here...',
  ],
  argumentative: [
    'While some may argue that...',
    'Evidence suggests that...',
    'On the contrary...',
    'It is worth noting that...',
    'A compelling case can be made for...',
    'Critics often overlook the fact that...',
    'The data clearly demonstrates...',
    'One cannot ignore the reality that...',
    'This raises an important question:',
    'A closer examination reveals...',
  ],
  descriptive: [
    'The air was thick with...',
    'Every detail seemed to...',
    'A mosaic of colors...',
    'The texture was reminiscent of...',
    'Beneath the surface...',
    'The landscape stretched endlessly...',
    'A faint aroma of...',
    'The sound echoed through...',
    'Shadows danced across...',
    'The warmth of the sun...',
  ],
  transition: [
    'Furthermore...',
    'In addition to this...',
    'Consequently...',
    'On the other hand...',
    'Nevertheless...',
    'In light of these findings...',
    'Similarly...',
    'As a result...',
    'To summarize...',
    'Moving forward...',
    'In contrast...',
    'Meanwhile...',
    'Subsequently...',
    'Above all...',
    'In conclusion...',
  ],
};

const WRITING_PROMPTS: Record<PromptCategory, string[]> = {
  fiction: [
    'Write a story about a letter that arrives 50 years late.',
    'A character discovers they can hear plants communicate.',
    'Two strangers meet during a power outage that lasts a week.',
    'Write about an object that changes hands through three generations.',
    'A detective investigates a crime that hasn\'t happened yet.',
    'Describe a world where music is the only form of currency.',
    'A character wakes up speaking a language they\'ve never learned.',
    'Write about the last bookshop in a digital world.',
  ],
  academic: [
    'Analyze the impact of remote work on urban development.',
    'Discuss the ethical implications of AI-generated content.',
    'Compare two approaches to addressing climate change.',
    'Examine the role of social media in modern democracy.',
    'Evaluate the effectiveness of current education models.',
    'Explore the relationship between technology and privacy.',
    'Argue for or against universal basic income.',
    'Discuss the future of space exploration and its benefits.',
  ],
  business: [
    'Draft a proposal for improving team collaboration.',
    'Write a case study about a successful product pivot.',
    'Outline a strategy for entering a new market segment.',
    'Create an executive summary for a quarterly review.',
    'Write a memo about implementing sustainability practices.',
    'Draft a change management plan for a digital transformation.',
    'Propose a customer retention strategy based on data insights.',
    'Write about lessons learned from a project post-mortem.',
  ],
  creative: [
    'Write a poem using only questions.',
    'Describe your favorite memory using all five senses.',
    'Write a letter to your future self, ten years from now.',
    'Create a dialogue between two inanimate objects.',
    'Write about a color without naming it.',
    'Describe a mundane routine as if it were an epic adventure.',
    'Write a story in exactly 50 words.',
    'Create a recipe for happiness, using metaphorical ingredients.',
  ],
};

const CONTINUATION_TEMPLATES = [
  (lastWords: string) => `Building on "${lastWords}," consider exploring the implications further by examining...`,
  (lastWords: string) => `This naturally leads to the question of how "${lastWords}" connects to the broader theme...`,
  (lastWords: string) => `To expand on this point about "${lastWords}," it may be helpful to provide specific examples such as...`,
];

const WritingPrompts: React.FC<WritingPromptsProps> = ({ editor, onClose }) => {
  const [tab, setTab] = useState<Tab>('continue');
  const [starterCat, setStarterCat] = useState<StarterCategory>('narrative');
  const [promptCat, setPromptCat] = useState<PromptCategory>('fiction');

  const insertAtCursor = (text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  };

  // Generate continuation suggestions based on last paragraph
  const continuations = useMemo(() => {
    if (!editor) return [];
    const text = editor.getText() || '';
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    const lastPara = paragraphs[paragraphs.length - 1] || '';
    const words = lastPara.trim().split(/\s+/);
    const lastWords = words.slice(-5).join(' ') || 'your writing';

    return CONTINUATION_TEMPLATES.map(fn => fn(lastWords));
  }, [editor, tab]);

  const randomPrompt = () => {
    const list = WRITING_PROMPTS[promptCat];
    return list[Math.floor(Math.random() * list.length)];
  };

  const [currentPrompt, setCurrentPrompt] = useState(() => WRITING_PROMPTS.fiction[0]);

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    fontSize: 12,
    border: 'none',
    borderBottom: active ? '2px solid #4285f4' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    color: active ? '#4285f4' : 'inherit',
  });

  const itemStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid var(--border-color, #e0e0e0)',
    background: 'var(--bg-secondary, #fafafa)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  };

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 16,
      width: 360,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--bg-primary, white)',
      border: '1px solid var(--border-color, #ddd)',
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #eee)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          <Sparkles size={16} /> Writing Assistant
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #eee)' }}>
        <button style={tabBtnStyle(tab === 'continue')} onClick={() => setTab('continue')}>
          <ArrowRight size={12} style={{ marginRight: 4 }} /> Continue
        </button>
        <button style={tabBtnStyle(tab === 'starters')} onClick={() => setTab('starters')}>
          <Type size={12} style={{ marginRight: 4 }} /> Starters
        </button>
        <button style={tabBtnStyle(tab === 'prompts')} onClick={() => setTab('prompts')}>
          <Lightbulb size={12} style={{ marginRight: 4 }} /> Prompts
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'continue' && (
          <>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              Suggestions based on your last paragraph — click to insert:
            </div>
            {continuations.map((text, i) => (
              <div key={i} style={itemStyle} onClick={() => insertAtCursor(text)}>
                <Sparkles size={14} style={{ color: '#4285f4', marginTop: 2, flexShrink: 0 }} />
                <span>{text}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'starters' && (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {(Object.keys(SENTENCE_STARTERS) as StarterCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setStarterCat(cat)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    borderRadius: 12,
                    border: starterCat === cat ? '1px solid #4285f4' : '1px solid var(--border-color, #ddd)',
                    background: starterCat === cat ? '#e8f0fe' : 'transparent',
                    color: starterCat === cat ? '#4285f4' : 'inherit',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            {SENTENCE_STARTERS[starterCat].map((s, i) => (
              <div key={i} style={itemStyle} onClick={() => insertAtCursor(s + ' ')}>
                <Type size={14} style={{ color: '#0f9d58', marginTop: 2, flexShrink: 0 }} />
                <span>{s}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'prompts' && (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {(Object.keys(WRITING_PROMPTS) as PromptCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setPromptCat(cat); setCurrentPrompt(WRITING_PROMPTS[cat][Math.floor(Math.random() * WRITING_PROMPTS[cat].length)]); }}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    borderRadius: 12,
                    border: promptCat === cat ? '1px solid #f4a024' : '1px solid var(--border-color, #ddd)',
                    background: promptCat === cat ? '#fef3e0' : 'transparent',
                    color: promptCat === cat ? '#e65100' : 'inherit',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div style={{ ...itemStyle, background: 'linear-gradient(135deg, #fff8e1, #fff3e0)', border: '1px solid #ffe0b2' }}>
              <Lightbulb size={14} style={{ color: '#f4a024', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontStyle: 'italic' }}>{currentPrompt}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCurrentPrompt(randomPrompt())}
                style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color, #ddd)', background: 'var(--bg-secondary, #f5f5f5)', cursor: 'pointer' }}
              >
                🎲 New Prompt
              </button>
              <button
                onClick={() => insertAtCursor(currentPrompt + '\n\n')}
                style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, border: 'none', background: '#4285f4', color: 'white', cursor: 'pointer' }}
              >
                Insert Prompt
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>More prompts:</div>
            {WRITING_PROMPTS[promptCat].slice(0, 4).map((p, i) => (
              <div key={i} style={itemStyle} onClick={() => insertAtCursor(p + '\n\n')}>
                <Lightbulb size={14} style={{ color: '#f4a024', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 12 }}>{p}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(WritingPrompts);
