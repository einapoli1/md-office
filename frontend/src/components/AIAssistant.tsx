import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Copy, ArrowDownToLine, Replace, Loader2, Settings } from 'lucide-react';
import { aiComplete, loadAISettings, saveAISettings, isAIConfigured, AIProvider } from '../lib/aiProvider';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  editor: any; // TipTap editor instance
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: 'Summarize', prompt: 'Summarize this text concisely', icon: '📝' },
  { label: 'Expand', prompt: 'Expand on this text with more detail', icon: '📖' },
  { label: 'Simplify', prompt: 'Simplify this text for easier reading', icon: '✨' },
  { label: 'Fix grammar', prompt: 'Fix any grammar and spelling errors in this text. Return only the corrected text.', icon: '✅' },
  { label: 'Translate', prompt: 'Translate this text to Spanish', icon: '🌐' },
  { label: 'Formal tone', prompt: 'Rewrite this text in a formal, professional tone', icon: '👔' },
  { label: 'Casual tone', prompt: 'Rewrite this text in a casual, conversational tone', icon: '💬' },
  { label: 'Make shorter', prompt: 'Make this text shorter while keeping the key points', icon: '✂️' },
];

const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022'],
};

async function getAIResponse(prompt: string, text: string): Promise<string> {
  if (!isAIConfigured()) {
    // Fallback: placeholder response
    await new Promise(r => setTimeout(r, 500));
    return `_(AI not configured. Add your API key in AI Settings to get real responses.)_\n\nPrompt: "${prompt}"\nText preview: "${text.slice(0, 100)}..."`;
  }

  return aiComplete([
    { role: 'system', content: 'You are a helpful writing assistant. Follow the user\'s instruction precisely. Return only the result text unless asked for an explanation.' },
    { role: 'user', content: `${prompt}\n\nText:\n${text}` },
  ]);
}

/* AI Settings Panel */
const AISettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const existing = loadAISettings();
  const [provider, setProvider] = useState<AIProvider>(existing?.provider || 'openai');
  const [apiKey, setApiKey] = useState(existing?.apiKey || '');
  const [model, setModel] = useState(existing?.model || '');

  const handleSave = () => {
    saveAISettings({ provider, apiKey, model: model || DEFAULT_MODELS[provider][0] });
    onClose();
  };

  return (
    <div className="ai-settings-panel">
      <div className="ai-settings-header">
        <h4>AI Settings</h4>
        <button onClick={onClose}><X size={16} /></button>
      </div>
      <div className="ai-settings-body">
        <label>
          Provider
          <select value={provider} onChange={e => { setProvider(e.target.value as AIProvider); setModel(''); }}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
          />
          <small>Stored locally in your browser. Never sent to our servers.</small>
        </label>
        <label>
          Model
          <select value={model} onChange={e => setModel(e.target.value)}>
            {DEFAULT_MODELS[provider].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button className="ai-settings-save" onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  );
};

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, editor }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getSelectedText = (): string => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    if (from === to) return '';
    return editor.state.doc.textBetween(from, to, '\n');
  };

  const getDocumentText = (): string => {
    if (!editor) return '';
    return editor.state.doc.textContent;
  };

  const handleSubmit = async (prompt?: string) => {
    const userPrompt = prompt || input.trim();
    if (!userPrompt || loading) return;

    const selectedText = getSelectedText();
    const contextText = selectedText || getDocumentText();

    if (!contextText) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please select some text or have content in your document first.',
        timestamp: new Date(),
      }]);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${userPrompt}${selectedText ? '\n\n> ' + selectedText.slice(0, 200) + (selectedText.length > 200 ? '...' : '') : ' (entire document)'}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await getAIResponse(userPrompt, contextText);
      setLastResult(result);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Something went wrong. Please try again.'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!lastResult || !editor) return;
    const clean = lastResult.replace(/_(.*?)_/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1');
    editor.chain().focus().insertContent(clean).run();
  };

  const handleReplace = () => {
    if (!lastResult || !editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const clean = lastResult.replace(/_(.*?)_/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1');
    editor.chain().focus().deleteRange({ from, to }).insertContent(clean).run();
  };

  const handleCopy = () => {
    if (lastResult) navigator.clipboard.writeText(lastResult);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  if (showSettings) {
    return (
      <div className="ai-assistant-panel">
        <AISettingsPanel onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  const configured = isAIConfigured();

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <div className="ai-assistant-title">
          <Sparkles size={18} />
          <span>AI Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="ai-assistant-close" onClick={() => setShowSettings(true)} title="AI Settings">
            <Settings size={16} />
          </button>
          <button className="ai-assistant-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {!configured && (
        <div className="ai-settings-banner" onClick={() => setShowSettings(true)}>
          <Settings size={14} />
          <span>Add your API key for real AI responses</span>
        </div>
      )}

      <div className="ai-assistant-quick-actions">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.label}
            className="ai-quick-action-btn"
            onClick={() => handleSubmit(action.prompt)}
            disabled={loading}
            title={action.prompt}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <div className="ai-assistant-messages">
        {messages.length === 0 && (
          <div className="ai-assistant-empty">
            <Sparkles size={32} style={{ opacity: 0.3 }} />
            <p>Select text and use a quick action, or type a prompt below.</p>
            <p className="ai-assistant-hint">Works on selected text or entire document.</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`ai-message ai-message-${msg.role}`}>
            <div className="ai-message-content">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="ai-message ai-message-assistant">
            <div className="ai-message-content ai-message-loading">
              <Loader2 size={16} className="ai-spinner" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {lastResult && !loading && (
        <div className="ai-assistant-actions">
          <button className="ai-action-btn" onClick={handleInsert} title="Insert at cursor">
            <ArrowDownToLine size={14} />
            <span>Insert</span>
          </button>
          <button className="ai-action-btn" onClick={handleReplace} title="Replace selected text">
            <Replace size={14} />
            <span>Replace</span>
          </button>
          <button className="ai-action-btn" onClick={handleCopy} title="Copy to clipboard">
            <Copy size={14} />
            <span>Copy</span>
          </button>
        </div>
      )}

      <div className="ai-assistant-input-row">
        <textarea
          ref={inputRef}
          className="ai-assistant-input"
          placeholder="Ask AI to help you write..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={() => handleSubmit()}
          disabled={!input.trim() || loading}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;
