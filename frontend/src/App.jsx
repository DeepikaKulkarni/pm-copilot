import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatApi, contextApi } from './api/client';

/* ─── Icons ─── */
const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const SparkleIcon = ({ size=14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
const MoonIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const SunIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const ChevronLeft  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const ChevronRight = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const LayersIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
const TrashIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const XIcon        = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

/* ─── Sidebar nav — add new tabs here, the icon rail handles them automatically ─── */
const TABS = [
  { id:'context',   label:'Context',   icon:'📄' },
  { id:'countries', label:'Countries', icon:'🌍' },
  { id:'agents',    label:'Agents',    icon:'🤖' },
];

/* ─── Config ─── */
const AGENTS = {
  tech_stack_explainer: { color:'#10b981', label:'Tech Stack',       emoji:'⚙️' },
  architecture_mapper:  { color:'#8b5cf6', label:'Architecture',     emoji:'🏗️' },
  country_readiness:    { color:'#f59e0b', label:'Country Readiness', emoji:'🌍' },
  action_plan:          { color:'#ef4444', label:'Action Plan',       emoji:'📋' },
  supervisor:           { color:'#6366f1', label:'Supervisor',        emoji:'🤖' },
};

const FEATURES = [
  { icon:'⚙️', title:'Tech Stack Explainer', desc:'Translate engineering jargon into PM language instantly', color:'#10b981', prompt:'What is Kubernetes and why does it matter for PMs?' },
  { icon:'🏗️', title:'Architecture Mapper',  desc:'Visualise service dependencies and design trade-offs',  color:'#8b5cf6', prompt:'What are the key dependencies in a microservices architecture?' },
  { icon:'🌍', title:'Country Readiness',    desc:'Check compliance requirements for 6 global markets',    color:'#f59e0b', prompt:'Compare launch readiness for India vs Germany' },
  { icon:'📋', title:'Action Plan Generator',desc:'Create stakeholder-ready launch checklists in seconds',  color:'#ef4444', prompt:'Generate an action plan for launching in all 6 countries' },
];

const COUNTRIES = [
  { flag:'🇺🇸', name:'United States', code:'US', reg:'CCPA',  color:'#3b82f6' },
  { flag:'🇩🇪', name:'Germany',       code:'DE', reg:'GDPR',  color:'#f59e0b' },
  { flag:'🇮🇳', name:'India',         code:'IN', reg:'DPDP',  color:'#f97316' },
  { flag:'🇸🇦', name:'Saudi Arabia',  code:'SA', reg:'PDPL',  color:'#10b981' },
  { flag:'🇧🇷', name:'Brazil',        code:'BR', reg:'LGPD',  color:'#22c55e' },
  { flag:'🇸🇬', name:'Singapore',     code:'SG', reg:'PDPA',  color:'#ec4899' },
];

/* ─── ChatMessage ─── */
function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const agent  = AGENTS[message.agent] || AGENTS.supervisor;
  return (
    <div className={`flex gap-3 py-2.5 msg-enter ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 btn-glow text-white">
          <SparkleIcon />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'order-first' : ''}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background:agent.color+'22', color:agent.color, border:`1px solid ${agent.color}44` }}>
              {agent.emoji} {agent.label}
            </span>
            {message.model && (
              <span className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background:'var(--bg-secondary)', color:'var(--text-secondary)', border:'1px solid var(--border-color)' }}>
                {message.model}
              </span>
            )}
            {message.totalTime && (
              <span className="text-[11px]" style={{ color:'var(--text-secondary)' }}>⚡ {message.totalTime}ms</span>
            )}
            {message.retrievalSource && (
              <span className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: message.retrievalSource==='hybrid' ? '#f59e0b18' : '#10b98118',
                  color:      message.retrievalSource==='hybrid' ? '#f59e0b'   : '#10b981',
                  border:`1px solid ${message.retrievalSource==='hybrid' ? '#f59e0b44' : '#10b98144'}`,
                }}>
                {message.retrievalSource==='hybrid' ? '🔀 RAG + Web' : '📚 RAG'}
              </span>
            )}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 ${isUser ? 'rounded-br-sm text-white' : 'rounded-bl-sm'}`}
          style={isUser
            ? { background:'var(--user-bubble)', boxShadow:'0 4px 24px var(--accent-glow)' }
            : { background:'var(--bg-card)', border:'1px solid var(--border-color)' }}>
          {isUser
            ? <p className="text-sm leading-relaxed">{message.content}</p>
            : <div className="markdown-content text-sm"><ReactMarkdown>{message.content?.replace(/\n---\n\*.+\*$/, '')}</ReactMarkdown></div>
          }
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 btn-glow text-white">
          <span className="text-[11px] font-bold">PM</span>
        </div>
      )}
    </div>
  );
}

/* ─── Spinner ─── */
function SpinLoader() {
  return (
    <div className="flex gap-3 py-2.5 msg-enter">
      <div className="spin-ring"><div className="spin-ring-inner"><SparkleIcon /></div></div>
      <div className="rounded-2xl rounded-bl-sm px-4 py-3 flex items-center"
        style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)' }}>
        <div className="flex gap-2 items-center">
          {['#6366f1','#8b5cf6','#ec4899'].map((c,i) => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background:c, animationDelay:`${i*160}ms` }} />
          ))}
          <span className="text-xs ml-1" style={{ color:'var(--text-secondary)' }}>Routing through agents…</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Context Panel (sidebar tab) ─── */
function ContextTab({ context, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(context || '');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed" style={{ color:'var(--text-secondary)' }}>
        Paste your architecture notes, tech stack doc, or README. The copilot will use this as context for all responses.
      </p>
      {!context && !editing ? (
        <button onClick={() => setEditing(true)}
          className="w-full text-xs py-3 rounded-xl border-2 border-dashed transition-all hover:border-indigo-500 hover:text-indigo-400"
          style={{ borderColor:'var(--border-color)', color:'var(--text-secondary)' }}>
          + Paste Architecture Context
        </button>
      ) : editing ? (
        <>
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Paste architecture notes, service descriptions, cloud setup..."
            className="w-full h-40 text-xs rounded-xl p-3 resize-none focus:outline-none"
            style={{ background:'var(--bg-secondary)', border:'1.5px solid var(--accent)', color:'var(--text-primary)', boxShadow:'0 0 0 3px var(--accent-soft)' }}
          />
          <div className="flex gap-2">
            <button onClick={() => { onSave(draft); setEditing(false); }}
              className="flex-1 text-xs py-2 rounded-xl font-semibold btn-glow text-white">
              Save Context
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs px-3 rounded-xl" style={{ background:'var(--bg-secondary)', color:'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs p-3 rounded-xl max-h-32 overflow-y-auto leading-relaxed"
            style={{ background:'var(--bg-secondary)', color:'var(--text-secondary)', border:'1px solid var(--border-color)' }}>
            {context.substring(0,300)}{context.length>300?'…':''}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(true); setDraft(context); }}
              className="flex-1 text-xs py-1.5 rounded-lg" style={{ background:'var(--accent-soft)', color:'var(--accent)' }}>
              Edit
            </button>
            <button onClick={onClear}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ background:'#ef444418', color:'#ef4444' }}>
              <TrashIcon /> Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Countries Tab ─── */
function CountriesTab({ onSend }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
        Click any country to check its launch requirements instantly.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {COUNTRIES.map((c, i) => (
          <button key={c.code}
            onClick={() => onSend(`What are the launch requirements and compliance needs for ${c.name}?`)}
            className={`card-fade-in card-hover flex items-center gap-3 px-3 py-2.5 rounded-xl text-left delay-${i}`}
            style={{ background:'var(--bg-secondary)', border:`1px solid ${c.color}30` }}>
            <span className="text-2xl leading-none flex-shrink-0">{c.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color:c.color }}>{c.name}</div>
              <div className="text-[11px]" style={{ color:'var(--text-secondary)' }}>{c.reg}</div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background:c.color+'20', color:c.color }}>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Agents Tab ─── */
function AgentsTab() {
  const info = {
    tech_stack_explainer: 'GPT-4o-mini · Fast summarisation of technical concepts',
    architecture_mapper:  'GPT-4 · Complex multi-service dependency reasoning',
    country_readiness:    'Gemini 2.0 Flash · Nuanced regulatory analysis with RAG',
    action_plan:          'Gemini 2.0 Flash · Structured stakeholder-ready checklists',
  };
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
        Queries are automatically routed to the best agent. Each agent uses a different LLM optimised for its task.
      </p>
      {Object.entries(AGENTS).filter(([k]) => k !== 'supervisor').map(([key, val], i) => (
        <div key={key} className={`card-fade-in rounded-xl p-3 delay-${i}`}
          style={{ background:'var(--bg-secondary)', border:`1px solid ${val.color}30` }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background:val.color+'22', border:`1px solid ${val.color}44` }}>
              {val.emoji}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold" style={{ color:val.color }}>{val.label}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full agent-dot" style={{ background:val.color, animationDelay:`${i*400}ms`, display:'inline-block' }} />
                <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>Online</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color:'var(--text-secondary)' }}>{info[key]}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({ onSend, suggestions }) {
  const emojis = ['⚙️','🌍','🔐','📊','🏗️','📋'];
  return (
    <div className="min-h-full flex flex-col items-center justify-center dot-grid px-4 py-12">
      {/* Hero */}
      <div className="float-anim mb-5">
        <div className="w-24 h-24 rounded-3xl btn-glow pulse-ring-hero text-5xl flex items-center justify-center">🌐</div>
      </div>
      <h2 className="text-3xl font-bold mb-2 text-center gradient-text w-full max-w-lg" style={{ lineHeight: 1.35 }}>Technical PM Copilot</h2>
      <p className="text-sm text-center max-w-md mb-8 leading-relaxed" style={{ color:'var(--text-secondary)' }}>
        Your AI-powered assistant for tech stack explainers, architecture analysis, global compliance checks, and launch planning.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl mb-8">
        {FEATURES.map((f, i) => (
          <button key={i}
            onClick={() => onSend(f.prompt)}
            className={`feature-card card-fade-in delay-${i} text-left`}
            style={{ background:'var(--bg-card)', border:`1px solid ${f.color}30`, '--feature-color': f.color }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 12px 40px ${f.color}30, 0 0 0 1px ${f.color}44`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}>
            {/* Color top bar */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:`linear-gradient(90deg, ${f.color}, ${f.color}88)`, borderRadius:'20px 20px 0 0' }} />
            <div className="text-3xl mb-3">{f.icon}</div>
            <div className="text-sm font-bold mb-1.5" style={{ color:'var(--text-primary)' }}>{f.title}</div>
            <div className="text-xs leading-relaxed mb-3" style={{ color:'var(--text-secondary)' }}>{f.desc}</div>
            <div className="text-xs font-semibold" style={{ color:f.color }}>Try it →</div>
          </button>
        ))}
      </div>

      {/* Suggestion chips */}
      <div className="w-full max-w-2xl">
        <p className="text-[11px] text-center mb-3 font-medium uppercase tracking-wider" style={{ color:'var(--text-secondary)' }}>
          Or start with a question
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.slice(0, 6).map((q, i) => (
            <button key={i}
              onClick={() => onSend(q)}
              className={`card-fade-in card-hover text-xs px-3 py-2 rounded-xl delay-${i}`}
              style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', color:'var(--text-secondary)' }}>
              {emojis[i]} {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [context,      setContext]      = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [darkMode,     setDarkMode]     = useState(true);
  const [sidebarTab,   setSidebarTab]   = useState('context');
  const [collapsed,    setCollapsed]    = useState(false);
  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => { loadSuggestions(); }, [context]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const loadSuggestions = async () => {
    try { setSuggestions(await chatApi.getSuggestedQuestions()); }
    catch { setSuggestions([
      "What is Kubernetes and why does it matter for PMs?",
      "Can we launch this stack in Germany?",
      "Compare India vs Saudi Arabia for launch readiness",
      "Generate an action plan for global launch",
      "What does GDPR require for data storage?",
      "Explain microservices vs monolith for a PM",
    ]); }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    setMessages(prev => [...prev, { role:'user', content:text }]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await chatApi.sendMessage(text, context);
      setMessages(prev => [...prev, {
        role:'assistant', content:res.response,
        agent:res.agent_used, model:res.model_used,
        totalTime:res.total_time_ms?.toFixed(0),
        retrievalSource:res.retrieval_source,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role:'assistant',
        content:`**Error:** ${err.response?.data?.detail || err.message || 'Failed to connect. Is the backend running?'}`,
        agent:'supervisor',
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown    = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };
  const handleSaveCtx    = async (ctx) => { setContext(ctx); try { await contextApi.setContext(ctx); } catch {} };
  const handleClearCtx   = async ()    => { setContext('');  try { await contextApi.clearContext();  } catch {} };

  const lastAgent = messages.length > 0
    ? [...messages].reverse().find(m => m.role==='assistant')?.agent
    : null;
  const lastAgentInfo = lastAgent ? (AGENTS[lastAgent] || AGENTS.supervisor) : null;

  // TABS is defined at module level — add new entries there to extend the sidebar

  return (
    <div className="flex flex-col h-screen overflow-hidden relative" style={{ background:'var(--bg-primary)', color:'var(--text-primary)' }}>
      {/* Aurora */}
      <div className="aurora-blob aurora-1"/><div className="aurora-blob aurora-2"/>
      <div className="aurora-blob aurora-3"/><div className="aurora-blob aurora-4"/>

      {/* ═══════════ UNIFIED TOP HEADER (full width) ═══════════ */}
      <header className="flex-shrink-0 relative z-20 border-b" style={{ borderColor:'var(--border-color)' }}>
        <div className="rainbow-stripe" />
        <div className="flex items-center gap-3 px-4 py-2.5"
          style={{ background:'var(--frosted-bg)', backdropFilter:'blur(16px)' }}>

          {/* Collapse/expand toggle */}
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', color:'var(--text-secondary)' }}>
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>

          {/* Logo + title */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center btn-glow text-white text-base flex-shrink-0">🌐</div>
          <div className="flex-shrink-0">
            <span className="text-sm font-bold" style={{
              background:'var(--gradient-accent)',
              WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent',
              backgroundClip:'text',
              backgroundSize:'200% 100%',
            }}>PM Copilot</span>
          </div>

          {/* Badges */}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{ background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid var(--accent)44' }}>
            ✦ Multi-Agent
          </span>
          {lastAgentInfo && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ background:lastAgentInfo.color+'18', color:lastAgentInfo.color, border:`1px solid ${lastAgentInfo.color}44` }}>
              {lastAgentInfo.emoji} {lastAgentInfo.label}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Country quick-chips */}
          {messages.length > 0 && (
            <div className="hidden md:flex gap-2 flex-shrink-0">
              {COUNTRIES.slice(0,4).map(c => (
                <button key={c.code}
                  onClick={() => sendMessage(`What are the launch requirements for ${c.name}?`)}
                  title={c.name}
                  className="text-lg hover:scale-125 transition-transform leading-none">
                  {c.flag}
                </button>
              ))}
            </div>
          )}

          {/* Message count */}
          {messages.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background:'var(--bg-card)', color:'var(--text-secondary)', border:'1px solid var(--border-color)' }}>
              {messages.length} msg{messages.length!==1?'s':''}
            </span>
          )}

        </div>
      </header>

      {/* ═══════════ BODY (sidebar + main side by side) ═══════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar: icon rail (always) + content panel (when expanded) ── */}
        <aside className="sidebar flex-shrink-0 flex border-r relative z-10"
          style={{ width: collapsed ? 52 : 300, background:'var(--bg-sidebar)', borderColor:'var(--border-color)' }}>

          {/* ── Icon Rail — never collapses, scales with any number of tabs ── */}
          <div className="flex flex-col items-center gap-1 py-2 flex-shrink-0"
            style={{ width:52, borderRight: collapsed ? 'none' : '1px solid var(--border-color)' }}>

            {TABS.map(t => (
              <button key={t.id}
                onClick={() => { setSidebarTab(t.id); if (collapsed) setCollapsed(false); }}
                className="nav-icon-btn tooltip-wrap"
                style={{
                  background: sidebarTab===t.id ? 'var(--accent-soft)' : 'transparent',
                  color:      sidebarTab===t.id ? 'var(--accent)'      : 'var(--text-secondary)',
                  borderColor: sidebarTab===t.id ? 'var(--accent)33'   : 'transparent',
                }}>
                {t.icon}
                <span className="tooltip">{t.label}</span>
              </button>
            ))}

            {/* Push utils to bottom */}
            <div className="flex-1" />

            {/* Clear chat */}
            {messages.length > 0 && (
              <button onClick={() => setMessages([])}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all tooltip-wrap"
                style={{ color:'var(--text-secondary)', border:'1px solid transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background='#ef444415'; e.currentTarget.style.color='#ef4444'; e.currentTarget.style.border='1px solid #ef444430'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.border='1px solid transparent'; }}>
                <TrashIcon />
                <span className="tooltip">Clear chat</span>
              </button>
            )}

            <div style={{ height:1, width:28, background:'var(--border-color)', margin:'4px 0' }} />

            {/* Theme toggle */}
            <button onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 mb-2 rounded-xl flex items-center justify-center transition-all tooltip-wrap"
              style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', color:'var(--text-secondary)' }}>
              {darkMode ? <SunIcon /> : <MoonIcon />}
              <span className="tooltip">{darkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>

          {/* ── Content Panel — hidden when collapsed ── */}
          {!collapsed && (
            <div className="flex flex-col flex-1 overflow-hidden panel-enter">
              {/* Panel header */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0">
                <span className="text-base leading-none">{TABS.find(t => t.id===sidebarTab)?.icon}</span>
                <span className="text-xs font-semibold" style={{ color:'var(--text-primary)' }}>
                  {TABS.find(t => t.id===sidebarTab)?.label}
                </span>
              </div>
              <div style={{ height:1, background:'var(--border-color)', marginLeft:0, marginRight:12 }} />
              {/* Tab content — add new cases here when TABS grows */}
              <div className="flex-1 overflow-y-auto p-3">
                {sidebarTab==='context'   && <ContextTab context={context} onSave={handleSaveCtx} onClear={handleClearCtx} />}
                {sidebarTab==='countries' && <CountriesTab onSend={sendMessage} />}
                {sidebarTab==='agents'    && <AgentsTab />}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col overflow-hidden relative z-10">

          {/* Messages / Empty state */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0
              ? <EmptyState onSend={sendMessage} suggestions={suggestions} />
              : (
                <div className="max-w-3xl mx-auto px-5 py-4">
                  {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
                  {isLoading && <SpinLoader />}
                  <div ref={chatEndRef} />
                </div>
              )
            }
          </div>

          {/* Input bar */}
          <div className="px-5 py-3 border-t flex-shrink-0"
            style={{ background:'var(--frosted-bg)', backdropFilter:'blur(14px)', borderColor:'var(--border-color)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl p-2"
              style={{ background:'var(--bg-card)', border:'1.5px solid var(--border-color)', transition:'border-color 0.2s, box-shadow 0.2s' }}
              onFocusCapture={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 0 0 3px var(--accent-soft)'; }}
              onBlurCapture={e  => { e.currentTarget.style.borderColor='var(--border-color)'; e.currentTarget.style.boxShadow='none'; }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tech stacks, architecture, compliance, or launch readiness…"
                rows={1}
                className="flex-1 text-sm py-2 px-3 resize-none focus:outline-none bg-transparent"
                style={{ color:'var(--text-primary)', maxHeight:'120px' }}
                onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim()||isLoading}
                className="p-2.5 rounded-xl btn-glow text-white flex-shrink-0">
                <SendIcon />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>
                Enter to send · Shift+Enter for new line
              </span>
              <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>
                Always verify compliance with legal teams
              </span>
            </div>
          </div>
        </div>
      </main>

      </div>
    </div>
  );
}
