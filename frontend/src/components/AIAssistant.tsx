import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Copy, ArrowDownToLine, Replace, Loader2 } from 'lucide-react';

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
  { label: 'Fix grammar', prompt: 'Fix any grammar and spelling errors in this text', icon: '✅' },
  { label: 'Translate', prompt: 'Translate this text to Spanish', icon: '🌐' },
  { label: 'Formal tone', prompt: 'Rewrite this text in a formal, professional tone', icon: '👔' },
  { label: 'Casual tone', prompt: 'Rewrite this text in a casual, conversational tone', icon: '💬' },
  { label: 'Make shorter', prompt: 'Make this text shorter while keeping the key points', icon: '✂️' },
];

/** Placeholder AI response generator — swap with real API later */
async function getAIResponse(prompt: string, text: string, _apiEndpoint?: string): Promise<string> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

  const lower = prompt.toLowerCase();
  if (lower.includes('summarize')) {
    const words = text.split(/\s+/);
    const shortened = words.slice(0, Math.max(10, Math.floor(words.length / 3))).join(' ');
    return `**Summary:** ${shortened}${words.length > 10 ? '...' : ''}\n\n_(This is a placeholder summary. Connect to an AI backend for real results.)_`;
  }
  if (lower.includes('grammar') || lower.includes('fix')) {
    return `${text}\n\n_(Placeholder: grammar check would be applied here. Connect to an AI backend for real results.)_`;
  }
  if (lower.includes('expand')) {
    return `${text}\n\nAdditionally, this topic encompasses several important aspects that deserve further exploration.\n\n_(Placeholder expansion. Connect to an AI backend for real results.)_`;
  }
  if (lower.includes('simplify')) {
    return `${text.split('.').slice(0, 2).join('. ')}.\n\n_(Placeholder simplification. Connect to an AI backend for real results.)_`;
  }
  if (lower.includes('translate')) {
    return `_(Translation placeholder. Connect to an AI backend for real results.)_\n\nOriginal: ${text.slice(0, 100)}...`;
  }
  if (lower.includes('shorter') || lower.includes('concise')) {
    const words = text.split(/\s+/);
    return words.slice(0, Math.max(5, Math.floor(words.length / 2))).join(' ') + '.\n\n_(Placeholder. Connect to an AI backend for real results.)_';
  }
  if (lower.includes('formal')) {
    return `I would like to bring to your attention the following: ${text.slice(0, 100)}...\n\n_(Placeholder formal rewrite. Connect to an AI backend for real results.)_`;
  }
  if (lower.includes('casual')) {
    return `Hey! So basically: ${text.slice(0, 100)}...\n\n_(Placeholder casual rewrite. Connect to an AI backend for real results.)_`;
  }

  return `Here's a response to "${prompt}":\n\n${text.slice(0, 150)}...\n\n_(This is a placeholder response. Configure an AI backend endpoint for real results.)_`;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, editor }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
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
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!lastResult || !editor) return;
    // Clean markdown formatting for insertion
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

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <div className="ai-assistant-title">
          <Sparkles size={18} />
          <span>AI Assistant</span>
        </div>
        <button className="ai-assistant-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

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
