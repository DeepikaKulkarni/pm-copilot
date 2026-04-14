import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatApi, contextApi } from './api/client';

/* ─── Icon helpers (inline SVGs to avoid extra deps) ─── */
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z"/></svg>
);
const ClipboardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);
const LayersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);

/* ─── Agent badge colors ─── */
const AGENT_COLORS = {
  tech_stack_explainer: { bg: '#10b981', label: 'Tech Stack' },
  architecture_mapper: { bg: '#8b5cf6', label: 'Architecture' },
  country_readiness: { bg: '#f59e0b', label: 'Country Readiness' },
  action_plan: { bg: '#ef4444', label: 'Action Plan' },
  supervisor: { bg: '#6b7280', label: 'Supervisor' },
};

/* ─── Message component ─── */
function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const agent = AGENT_COLORS[message.agent] || AGENT_COLORS.supervisor;

  return (
    <div className={`flex gap-3 py-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-soft)' }}>
          <SparkleIcon />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {!isUser && message.agent && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: agent.bg + '22', color: agent.bg }}>
              {agent.label}
            </span>
            {message.model && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {message.model}
              </span>
            )}
            {message.totalTime && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {message.totalTime}ms
              </span>
            )}
            {message.retrievalSource && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: message.retrievalSource === 'hybrid' ? '#f59e0b22' : '#10b98122',
                  color: message.retrievalSource === 'hybrid' ? '#f59e0b' : '#10b981',
                }}>
                {message.retrievalSource === 'hybrid' ? 'RAG + Web' : 'RAG'}
              </span>
            )}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 ${isUser
          ? 'bg-copilot-600 text-white rounded-br-md'
          : 'rounded-bl-md'
          }`}
          style={!isUser ? { background: 'var(--bg-card)', border: '1px solid var(--border-color)' } : {}}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="markdown-content text-sm">
              <ReactMarkdown>{message.content?.replace(/\n---\n\*.+\*$/, '')}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <span className="text-xs font-semibold">PM</span>
        </div>
      )}
    </div>
  );
}

/* ─── Context Panel ─── */
function ContextPanel({ context, setContext, onSave, onClear }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(context || '');

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <LayersIcon />
          <h3 className="text-sm font-semibold">Architecture Context</h3>
        </div>
        <div className="flex gap-2">
          {context ? (
            <>
              <button onClick={() => { setIsEditing(!isEditing); setDraft(context); }}
                className="text-xs px-2 py-1 rounded-md hover:opacity-80"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              <button onClick={onClear}
                className="text-xs px-2 py-1 rounded-md hover:opacity-80"
                style={{ background: '#ef444422', color: '#ef4444' }}>
                Clear
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!context && !isEditing ? (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            Paste your architecture notes, tech stack doc, or README to give the copilot context about your system.
          </p>
          <button onClick={() => setIsEditing(true)}
            className="w-full text-sm py-2 rounded-lg border border-dashed hover:opacity-80"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            + Add Architecture Context
          </button>
        </div>
      ) : isEditing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Paste architecture notes, service descriptions, cloud setup, team ownership docs..."
            className="w-full h-40 text-sm rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-copilot-500"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
          <button onClick={() => { onSave(draft); setIsEditing(false); }}
            className="mt-2 w-full text-sm py-2 rounded-lg font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Save Context
          </button>
        </div>
      ) : (
        <div className="text-xs p-2 rounded-lg max-h-24 overflow-y-auto"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
          {context.substring(0, 300)}{context.length > 300 ? '...' : ''}
        </div>
      )}
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadSuggestions();
  }, [context]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSuggestions = async () => {
    try {
      const q = await chatApi.getSuggestedQuestions();
      setSuggestions(q);
    } catch {
      setSuggestions([
        "What is Kubernetes and why does it matter for PMs?",
        "Can we launch this stack in Germany?",
        "Compare India vs Saudi Arabia for launch readiness",
        "Generate an action plan for global launch",
      ]);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await chatApi.sendMessage(text, context);
      const assistantMsg = {
        role: 'assistant',
        content: res.response,
        agent: res.agent_used,
        model: res.model_used,
        totalTime: res.total_time_ms?.toFixed(0),
        retrievalSource: res.retrieval_source,
        ragConfidence: res.rag_confidence,
        stepLog: res.step_log,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Error:** ${err.response?.data?.detail || err.message || 'Failed to get response. Is the backend running?'}`,
        agent: 'supervisor',
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSaveContext = async (ctx) => {
    setContext(ctx);
    try { await contextApi.setContext(ctx); } catch {}
  };

  const handleClearContext = async () => {
    setContext('');
    try { await contextApi.clearContext(); } catch {}
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Sidebar ── */}
      <aside className="w-80 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-r"
        style={{ borderColor: 'var(--border-color)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 py-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <GlobeIcon />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">PM Copilot</h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Launch & Architecture</p>
          </div>
        </div>

        {/* Context panel */}
        <ContextPanel
          context={context}
          setContext={setContext}
          onSave={handleSaveContext}
          onClear={handleClearContext}
        />

        {/* Countries */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-2">Countries Covered</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { flag: '🇺🇸', name: 'US', reg: 'CCPA' },
              { flag: '🇩🇪', name: 'Germany', reg: 'GDPR' },
              { flag: '🇮🇳', name: 'India', reg: 'DPDP' },
              { flag: '🇸🇦', name: 'Saudi', reg: 'PDPL' },
              { flag: '🇧🇷', name: 'Brazil', reg: 'LGPD' },
              { flag: '🇸🇬', name: 'Singapore', reg: 'PDPA' },
            ].map(c => (
              <button key={c.name}
                onClick={() => sendMessage(`What are the launch requirements for ${c.name}?`)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity text-left"
                style={{ background: 'var(--bg-secondary)' }}>
                <span>{c.flag}</span>
                <span className="truncate">{c.name}</span>
                <span style={{ color: 'var(--text-secondary)' }} className="text-[10px]">{c.reg}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Agents */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-2">Agents</h3>
          <div className="flex flex-col gap-1.5">
            {Object.entries(AGENT_COLORS).filter(([k]) => k !== 'supervisor').map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs py-1">
                <div className="w-2 h-2 rounded-full" style={{ background: val.bg }} />
                <span>{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="flex-1 flex flex-col">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-soft)' }}>
                <GlobeIcon />
              </div>
              <h2 className="text-xl font-bold mb-1">Technical PM Copilot</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Ask about tech stacks, architecture, or global launch readiness
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {suggestions.slice(0, 6).map((q, i) => (
                  <button key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs text-left px-3 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-4">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3 py-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--accent-soft)' }}>
                    <SparkleIcon />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Routing through agents...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl p-2"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tech stacks, architecture, or launch readiness..."
                rows={1}
                className="flex-1 text-sm py-2 px-3 resize-none focus:outline-none bg-transparent"
                style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-xl transition-all disabled:opacity-30"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                <SendIcon />
              </button>
            </div>
            <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              PM Copilot uses multiple LLMs with intelligent routing. Verify compliance information with legal teams.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
