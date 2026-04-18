// Main application component for the Technical PM Launch & Architecture Copilot.
// All view-level state is lifted here so tab switches don't reset data.
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import {
  Send, Sun, Moon, Trash2, FileText, Clock, Cpu, Database, Search,
  Zap, BarChart3, GitCompare, MessageSquare, LayoutDashboard, Box,
  Download, AlertTriangle, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import { chatApi, contextApi, uploadApi } from './api/client';
import LandingPage from './LandingPage';

// Initialize mermaid once at module load; theme is re-synced on every dark/light toggle.
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

// ── Static config ─────────────────────────────────────────────────────────────

// Maps backend agent_used values → display label + accent colour
const AGENTS = {
  tech_stack_explainer: { color: 'var(--sky)',   label: 'Tech Stack' },
  architecture_mapper:  { color: 'var(--lilac)', label: 'Architecture' },
  country_readiness:    { color: 'var(--sand)',  label: 'Compliance' },
  action_plan:          { color: 'var(--coral)', label: 'Action Plan' },
  supervisor:           { color: 'var(--tx-3)',  label: 'Routing' },
};

// Six markets covered by the compliance RAG corpus
const COUNTRIES = [
  { code: 'US', name: 'United States', reg: 'CCPA/CPRA', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'DE', name: 'Germany',       reg: 'GDPR/BDSG', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'IN', name: 'India',         reg: 'DPDP 2023', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'SA', name: 'Saudi Arabia',  reg: 'PDPL',      flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'BR', name: 'Brazil',        reg: 'LGPD',      flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'SG', name: 'Singapore',     reg: 'PDPA',      flag: '\u{1F1F8}\u{1F1EC}' },
];

// Top-level navigation tabs rendered in the app shell header
const TABS = [
  { id: 'dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { id: 'compare',   label: 'Compare',      Icon: GitCompare },
  { id: 'arch',      label: 'Architecture', Icon: Box },
  { id: 'chat',      label: 'Chat',         Icon: MessageSquare },
  { id: 'metrics',   label: 'Metrics',      Icon: BarChart3 },
];

// Capability cards shown on the landing page features section
const CAPS = [
  { title: 'Tech Stack Explainer',  desc: 'Translate engineering jargon into language any PM can act on',            prompt: 'What is Kubernetes and why does it matter for product managers?', color: 'var(--sky)' },
  { title: 'Architecture Mapper',   desc: 'Surface service dependencies, data flows, and ownership across teams',    prompt: 'What are the key dependencies in a microservices architecture?',  color: 'var(--lilac)' },
  { title: 'Compliance Analysis',   desc: 'Assess data protection and launch readiness across 6 global markets',     prompt: 'Compare launch readiness for India vs Germany',                   color: 'var(--sand)' },
  { title: 'Action Plan Generator', desc: 'Build stakeholder checklists and prioritized release-readiness plans',    prompt: 'Generate an action plan for launching in Brazil',                 color: 'var(--coral)' },
];

// ── Shared UI primitives ───────────────────────────────────────────────────────

// Renders a mermaid diagram from LLM-generated chart text.
// Sanitizes common LLM syntax errors before calling mermaid.render(),
// and falls back to a plain text view if the diagram still fails to parse.
function Mmd({ chart }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !chart) return;

    const id = 'mmd-' + Math.random().toString(36).slice(2, 9);

    // --- Sanitize the chart ---
    let clean = chart.trim();

    // 1. Strip code fence wrappers the LLM sometimes leaves in
    clean = clean.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();

    // 2. Remove trailing semicolons on the graph declaration line (e.g. "graph TD;")
    clean = clean.replace(/^(graph\s+\w+)\s*;/gm, '$1');

    // 3. Remove pipe edge-labels entirely (-->|text| → -->) — labels with spaces or
    //    special chars are a common LLM-generated syntax error
    clean = clean.replace(/(--[->])\s*\|[^|]*\|/g, '$1');

    // 4. Remove parenthesised content inside square-bracket node labels
    //    e.g. [Auth Service (Firebase)] → [Auth Service]
    clean = clean.replace(/\[([^\]]*?)\s*\([^)]*\)\]/g, '[$1]');
    // Tidy any leftover interior whitespace
    clean = clean.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');

    // 5. Remove "style" lines — they often carry hex colours the parser rejects
    clean = clean.replace(/^\s*style\s+.*/gm, '');

    // 6. Drop blank lines produced by the above passes
    clean = clean.split('\n').filter(l => l.trim()).join('\n');

    // 7. Ensure valid diagram-type prefix
    if (!clean.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/)) {
      clean = 'graph TD\n' + clean;
    }

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(id, clean);
        if (ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (ref.current) {
          // Remove any partial error SVG mermaid may have injected before throwing
          ref.current.querySelectorAll('.error-icon, #d-mmd').forEach(el => el.remove());
          ref.current.innerHTML =
            '<div style="padding:12px;border-radius:6px;background:var(--bg-2);border:1px solid var(--border);overflow-x:auto">' +
            '<div style="font-size:10px;color:var(--tx-3);margin-bottom:8px;font-weight:500">Architecture Diagram (text view)</div>' +
            '<pre style="font-size:11px;color:var(--tx-2);white-space:pre-wrap;margin:0">' + chart.replace(/</g, '&lt;') + '</pre></div>';
        }
      }
    };

    renderDiagram();
  }, [chart]);

  return <div ref={ref} className="mermaid-box" />;
}

// Renders markdown with GitHub-Flavored Markdown tables and inline mermaid diagrams.
// Intercepts ```mermaid code blocks and hands them to <Mmd>.
function Md({ content }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        code({ children, className }) {
          if (className?.includes('mermaid')) return <Mmd chart={String(children)} />;
          return <code className={className}>{children}</code>;
        },
      }}>
        {content?.replace(/\n---\n\*.+\*$/, '') || ''}
      </ReactMarkdown>
    </div>
  );
}

// Coloured pill showing HIGH / MEDIUM / LOW launch readiness
function StatusBadge({ level }) {
  const map = {
    HIGH:   { color: 'var(--green)', bg: 'var(--green-dim)', label: 'Ready' },
    MEDIUM: { color: 'var(--sand)',  bg: 'var(--sand-dim)',  label: 'Gaps' },
    LOW:    { color: 'var(--coral)', bg: 'var(--coral-dim)', label: 'Blocked' },
  };
  const s = map[level] || map.MEDIUM;
  return (
    <span className="status-badge" style={{ background: s.bg, color: s.color, borderColor: `color-mix(in srgb, ${s.color} 25%, transparent)` }}>
      {level === 'HIGH' && <CheckCircle size={11} />}
      {level === 'MEDIUM' && <AlertTriangle size={11} />}
      {level === 'LOW' && <XCircle size={11} />}
      {s.label}
    </span>
  );
}

function LoadingCard() {
  return (
    <div className="loading-card">
      <Loader2 size={16} className="spin" style={{ color: 'var(--sage)' }} />
      <span>Analyzing...</span>
    </div>
  );
}

// Compact row of metadata pills (agent, model, latency, retrieval source, confidence)
// shown above every assistant response bubble.
function MetricChips({ data }) {
  const ag = AGENTS[data.agent] || AGENTS.supervisor;
  return (
    <div className="mstrip">
      {data.agent && (
        <span className="apill" style={{ background: `color-mix(in srgb, ${ag.color} 14%, transparent)`, color: ag.color, border: `1px solid color-mix(in srgb, ${ag.color} 22%, transparent)` }}>
          {ag.label}
        </span>
      )}
      {data.model && <span className="mpill"><Cpu size={9} />{data.model}</span>}
      {data.time && <span className="mpill"><Clock size={9} />{data.time}ms</span>}
      {data.src && <span className="mpill">{data.src === 'hybrid' ? <><Search size={9} />RAG+Web</> : <><Database size={9} />RAG</>}</span>}
      {data.conf > 0 && <span className="mpill">{(data.conf * 100).toFixed(0)}%</span>}
    </div>
  );
}

// ── View components ────────────────────────────────────────────────────────────

// Runs a per-country compliance analysis for all 6 markets and shows the results
// in a card grid.  State is lifted to App so it survives tab switches.
function DashboardView({ onNavigate, results, setResults, loading, setLoading }) {
  const analyzeCountry = async (country) => {
    setLoading(p => ({ ...p, [country.code]: true }));
    try {
      const ctxData = await contextApi.getContext();
      const r = await chatApi.sendMessage(
        `Assess the launch readiness for ${country.name}. Give a one-line summary, the readiness level (HIGH, MEDIUM, or LOW), and the top 3 blockers. Keep it very concise.`,
        ctxData.context || ''
      );
      setResults(p => ({
        ...p,
        [country.code]: {
          response: r.response,
          level: r.response.includes('HIGH') ? 'HIGH' : r.response.includes('LOW') ? 'LOW' : 'MEDIUM',
          agent: r.agent_used, model: r.model_used,
          time: r.total_time_ms?.toFixed(0),
          src: r.retrieval_source, conf: r.rag_confidence || 0,
        }
      }));
    } catch (e) {
      setResults(p => ({ ...p, [country.code]: { response: `Error: ${e.message}`, level: 'LOW' } }));
    }
    setLoading(p => ({ ...p, [country.code]: false }));
  };

  const analyzeAll = () => COUNTRIES.forEach(c => analyzeCountry(c));

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-primary" onClick={analyzeAll}>
          <Zap size={13} /> Analyze All Markets
        </button>
      </div>

      <div className="country-grid">
        {COUNTRIES.map(c => {
          const r = results[c.code];
          const isLoading = loading[c.code];
          return (
            <div key={c.code} className="country-card">
              <div className="country-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <div>
                    <div className="country-card-name">{c.name}</div>
                    <div className="country-card-reg">{c.reg}</div>
                  </div>
                </div>
                {r && <StatusBadge level={r.level} />}
              </div>
              {isLoading ? (
                <LoadingCard />
              ) : r ? (
                <div>
                  <MetricChips data={r} />
                  <div className="country-card-body"><Md content={r.response} /></div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => onNavigate('chat', `What are the detailed compliance requirements and launch blockers for ${c.name}? Go deeper on each blocker and suggest specific remediation steps.`)}>
                      <MessageSquare size={12} /> Discuss
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => onNavigate('chat', `Generate a detailed action plan for launching in ${c.name}. Include specific owners, priorities, and timelines.`)}>
                      <FileText size={12} /> Action Plan
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-ghost" onClick={() => analyzeCountry(c)}>Analyze {c.name}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Side-by-side regulatory comparison between any two of the 6 supported markets.
// countryA/countryB are kept local (fine to reset on tab switch); result/meta are lifted.
function CompareView({ result, setResult, meta, setMeta }) {
  const [countryA, setCountryA] = useState('DE');
  const [countryB, setCountryB] = useState('IN');
  const [loading, setLoading] = useState(false);

  const compare = async () => {
    const a = COUNTRIES.find(c => c.code === countryA);
    const b = COUNTRIES.find(c => c.code === countryB);
    if (!a || !b || a.code === b.code) return;
    setLoading(true); setResult(null);
    try {
      const ctx = await contextApi.getContext();
      const r = await chatApi.sendMessage(
        `Compare launch readiness between ${a.name} and ${b.name}. Create a detailed side-by-side comparison table covering: regulatory requirements, data residency, cloud infrastructure, breach notification, enforcement penalties, and overall readiness level.`,
        ctx.context || ''
      );
      setResult(r.response);
      setMeta({ agent: r.agent_used, model: r.model_used, time: r.total_time_ms?.toFixed(0), src: r.retrieval_source, conf: r.rag_confidence || 0 });
    } catch (e) { setResult(`**Error:** ${e.message}`); }
    setLoading(false);
  };

  return (
    <div className="view-container">
      <div className="compare-controls">
        <div className="select-wrap">
          <label className="select-label">Market A</label>
          <select className="select-input" value={countryA} onChange={e => setCountryA(e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.reg})</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          <GitCompare size={18} style={{ color: 'var(--tx-3)' }} />
        </div>
        <div className="select-wrap">
          <label className="select-label">Market B</label>
          <select className="select-input" value={countryB} onChange={e => setCountryB(e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.reg})</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn-primary" onClick={compare} disabled={loading || countryA === countryB}>
            {loading ? <Loader2 size={13} className="spin" /> : <GitCompare size={13} />} Compare
          </button>
        </div>
      </div>
      {loading && <LoadingCard />}
      {result && (
        <div className="result-card">
          {meta && <MetricChips data={meta} />}
          <Md content={result} />
        </div>
      )}
    </div>
  );
}

// Architecture context editor + analyser.
// Users paste (or upload) architecture docs; the agent returns a component map,
// dependency analysis, and an optional Mermaid diagram.
// All state is lifted so context/results persist across tab switches.
function ArchView({ ctx, setCtx, saved, setSaved, result, setResult, diagramResult, setDiagramResult, meta, setMeta, uploadedImages, setUploadedImages }) {
  const [loading, setLoading] = useState(false);
  const [loadingDiagram, setLoadingDiagram] = useState(false);

  useEffect(() => {
    if (!ctx) {
      contextApi.getContext().then(r => { if (r.context) { setCtx(r.context); setSaved(true); } }).catch(() => {});
    }
  }, []);

  const save = async () => { await contextApi.setContext(ctx); setSaved(true); };

  const handleUpload = async (file) => {
    try {
      const r = await uploadApi.upload(file);
      if (r.type === 'pdf') {
        setCtx(prev => prev ? `${prev}\n\n${r.text}` : r.text);
        setSaved(false);
      } else if (r.type === 'image') {
        setUploadedImages(prev => [...prev, { src: `data:${r.mime_type};base64,${r.base64}`, name: r.filename }]);
      }
    } catch (e) { console.error('Upload failed:', e); }
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const r = await chatApi.sendMessage('Analyze this architecture. Identify all components, dependencies, team ownership, data flows, and flag any risks or single points of failure.', ctx);
      setResult(r.response);
      setMeta({ agent: r.agent_used, model: r.model_used, time: r.total_time_ms?.toFixed(0), src: r.retrieval_source, conf: r.rag_confidence || 0 });
    } catch (e) { setResult(`**Error:** ${e.message}`); }
    setLoading(false);
  };

  const generateDiagram = async () => {
    setLoadingDiagram(true);
    try {
      const r = await chatApi.sendMessage('Generate a Mermaid architecture diagram based on the provided context. Show the key components and their connections. Output ONLY the mermaid code block, nothing else.', ctx);
      setDiagramResult(r.response);
    } catch (e) { setDiagramResult(`**Error:** ${e.message}`); }
    setLoadingDiagram(false);
  };

  return (
    <div className="view-container">
      <div className="arch-input-section">
        <textarea value={ctx} onChange={e => { setCtx(e.target.value); setSaved(false); }}
          placeholder="Paste your architecture notes, tech stack documentation, service descriptions, README, or cloud setup details here..."
          className="arch-textarea" />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={save} disabled={!ctx.trim()}>
            <FileText size={13} /> {saved ? 'Saved' : 'Save Context'}
          </button>
          <button className="btn-secondary" onClick={analyze} disabled={!ctx.trim() || loading}>
            {loading ? <Loader2 size={13} className="spin" /> : <Zap size={13} />} Analyze
          </button>
          <button className="btn-secondary" onClick={generateDiagram} disabled={!ctx.trim() || loadingDiagram}>
            {loadingDiagram ? <Loader2 size={13} className="spin" /> : <Box size={13} />} Diagram
          </button>
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            <FileText size={13} /> Upload File
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ''; } }} />
          </label>
        </div>
        {uploadedImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {uploadedImages.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img.src} alt={img.name}
                  style={{ height: 72, width: 'auto', borderRadius: 6, border: '1px solid var(--border)', objectFit: 'cover' }} />
                <button onClick={() => setUploadedImages(p => p.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 3,
                    background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-2)', fontSize: 11, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {(loading || loadingDiagram) && <LoadingCard />}
      <div style={{ display: 'grid', gridTemplateColumns: diagramResult && result ? '1fr 1fr' : '1fr', gap: 12 }}>
        {result && (
          <div className="result-card">
            <div className="result-card-title">Component Analysis</div>
            {meta && <MetricChips data={meta} />}
            <Md content={result} />
          </div>
        )}
        {diagramResult && (
          <div className="result-card">
            <div className="result-card-title">Architecture Diagram</div>
            <Md content={diagramResult} />
          </div>
        )}
      </div>
    </div>
  );
}

// Hidden file input + icon button for uploading PDFs and images into the chat.
// PDFs are extracted server-side (pypdf) and auto-sent as a text message.
// Images are base64-encoded and displayed inline in the user bubble.
function FileUploadBtn({ onFile }) {
  const ref = useRef(null);
  return (
    <>
      <button className="sbtn off" style={{ cursor: 'pointer', flexShrink: 0 }}
        onClick={() => ref.current?.click()} title="Upload PDF or image">
        <FileText size={13} />
      </button>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }} />
    </>
  );
}

// Free-form chat view with full message history, follow-up chips, and file upload.
// preloadQuery lets other views (e.g. Dashboard cards) inject a query and navigate here.
// msgs/busy are lifted to App so history survives tab switches.
function ChatView({ preloadQuery, onConsumePreload, msgs, setMsgs, busy, setBusy }) {
  const [inp, setInp] = useState('');
  const endRef = useRef(null);
  const inpRef = useRef(null);
  const preloadHandled = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (preloadQuery && !preloadHandled.current) {
      preloadHandled.current = true;
      send(preloadQuery);
      onConsumePreload();
    }
    return () => { preloadHandled.current = false; };
  }, [preloadQuery]);

  const handleFile = async (file) => {
    try {
      const r = await uploadApi.upload(file);
      if (r.type === 'pdf') {
        send(`Analyze this document:\n\n${r.text.slice(0, 3000)}`);
      } else if (r.type === 'image') {
        const imgSrc = `data:${r.mime_type};base64,${r.base64}`;
        setMsgs(p => [...p, { role: 'user', content: `Analyze this image: ${r.filename}`, imageData: imgSrc }]);
        setBusy(true);
        try {
          const res = await chatApi.sendMessage(`The user uploaded an image called "${r.filename}". Describe what kind of architecture or system diagram this might represent and provide relevant PM insights.`);
          setMsgs(p => [...p, {
            role: 'assistant', content: res.response,
            agent: res.agent_used, model: res.model_used,
            totalTime: res.total_time_ms?.toFixed(0),
            src: res.retrieval_source, conf: res.rag_confidence || 0,
            followUps: res.follow_up_questions || [],
          }]);
        } catch (e) {
          setMsgs(p => [...p, { role: 'assistant', content: `**Error:** ${e.message}`, agent: 'supervisor' }]);
        }
        setBusy(false);
      }
    } catch (e) {
      setMsgs(p => [...p, { role: 'assistant', content: `**Upload error:** ${e.message}`, agent: 'supervisor' }]);
    }
  };

  const send = async (txt) => {
    if (!txt.trim() || busy) return;
    setMsgs(p => [...p, { role: 'user', content: txt }]);
    setInp('');
    setBusy(true);
    try {
      const r = await chatApi.sendMessage(txt);
      setMsgs(p => [...p, {
        role: 'assistant', content: r.response,
        agent: r.agent_used, model: r.model_used,
        totalTime: r.total_time_ms?.toFixed(0),
        src: r.retrieval_source, conf: r.rag_confidence || 0,
        followUps: r.follow_up_questions || [],
      }]);
    } catch (e) {
      setMsgs(p => [...p, { role: 'assistant', content: `**Error:** ${e.message}`, agent: 'supervisor' }]);
    }
    setBusy(false);
    inpRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {msgs.length === 0 ? (
          <div className="chat-empty">
            <Zap size={20} style={{ color: 'var(--sage)', marginBottom: 12 }} />
            <h3>Ask anything</h3>
            <p>Tech stacks, architecture, compliance, or launch planning</p>
            <div className="chat-starters">
              {['What is Kubernetes and why does it matter?', 'What does GDPR require for data storage?', 'Generate a launch action plan for India', 'Explain microservices vs monolith'].map((q, i) => (
                <button key={i} className="starter-chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            {msgs.map((m, i) => (
              <div key={i} className={`row ${m.role === 'user' ? 'u' : ''}`}>
                <div className={`bub ${m.role === 'user' ? 'u' : 'a'}`}>
                  {m.role !== 'user' && (
                    <MetricChips data={{ agent: m.agent, model: m.model, time: m.totalTime, src: m.src, conf: m.conf }} />
                  )}
                  {m.role === 'user' ? (
                    <div>
                      {m.imageData && (
                        <img src={m.imageData} alt="uploaded"
                          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, display: 'block', marginBottom: m.content ? 6 : 0 }} />
                      )}
                      {m.content && <p style={{ margin: 0, lineHeight: 1.6 }}>{m.content}</p>}
                    </div>
                  ) : (
                    <>
                      <Md content={m.content} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="fuchip" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => {
                            const md = `# PM Copilot Report\n\n## Query\n${msgs[i-1]?.content || ''}\n\n## Analysis\n${m.content}\n\n---\n*Agent: ${m.agent} | Model: ${m.model} | Time: ${m.totalTime}ms*`;
                            const blob = new Blob([md], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `pm-report-${Date.now()}.md`;
                            a.click(); URL.revokeObjectURL(url);
                          }}>
                          <Download size={10} /> Export .md
                        </button>
                      </div>
                    </>
                  )}
                  {m.followUps?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                      {m.followUps.map((q, j) => <button key={j} className="fuchip" onClick={() => send(q)}>{q}</button>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="row">
                <div className="bub a" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
                  <div className="ldot" /><div className="ldot" /><div className="ldot" />
                  <span className="meta-text">routing...</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div className="ibar">
            <textarea ref={inpRef} value={inp} onChange={e => setInp(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp); } }}
              placeholder="Ask about tech stacks, architecture, or launch readiness..."
              rows={1} onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
            <FileUploadBtn onFile={handleFile} />
            <button onClick={() => send(inp)} className={`sbtn ${inp.trim() && !busy ? 'on' : 'off'}`} disabled={!inp.trim() || busy}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Static read-only view documenting the LLM routing decisions, RAG pipeline
// configuration, supported countries, and GenAI concepts used in the project.
function MetricsView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">System Metrics</h2>
          <p className="view-desc">Performance monitoring and model usage statistics</p>
        </div>
      </div>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-label">LLM Routing</div>
          <div className="metric-card-body">
            {[
              { agent: 'Supervisor', model: 'GPT-4o-mini', reason: 'Fast query classification' },
              { agent: 'Tech Stack', model: 'GPT-4o-mini', reason: 'Cost-effective summarization' },
              { agent: 'Architecture', model: 'GPT-4', reason: 'Complex dependency reasoning' },
              { agent: 'Compliance', model: 'GPT-4', reason: 'Regulatory analysis' },
              { agent: 'Action Plan', model: 'GPT-4', reason: 'Structured output generation' },
            ].map((r, i) => (
              <div key={i} className="metric-row">
                <span className="metric-row-agent">{r.agent}</span>
                <span className="metric-row-model">{r.model}</span>
                <span className="metric-row-reason">{r.reason}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">RAG Pipeline</div>
          <div className="metric-card-body">
            {[
              ['Vector DB', 'ChromaDB'], ['Embedding', 'all-MiniLM-L6-v2'],
              ['Documents', '7 PDFs, 6 countries'], ['Chunk size', '1000 tokens'],
              ['Overlap', '200 tokens'], ['Confidence threshold', '0.65'],
              ['Web fallback', 'Serper.dev (Google)'],
            ].map(([k, v], i) => (
              <div key={i} className="metric-row"><span>{k}</span><span className="metric-row-model">{v}</span></div>
            ))}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Countries Covered</div>
          <div className="metric-card-body">
            {COUNTRIES.map((c, i) => (
              <div key={i} className="metric-row">
                <span>{c.flag} {c.name}</span><span className="metric-row-model">{c.reg}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">GenAI Concepts</div>
          <div className="metric-card-body">
            {[
              ['Orchestration', 'LangGraph state graph'],
              ['Memory', 'ConversationSummaryMemory'],
              ['Prompting', 'Chain-of-thought + structured'],
              ['Retrieval', 'Hybrid RAG + web fallback'],
              ['Guardrails', 'Hallucination detection + validation'],
              ['Routing', 'Multi-LLM intelligent routing'],
            ].map(([k, v], i) => (
              <div key={i} className="metric-row"><span>{k}</span><span className="metric-row-model">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

// Owns all cross-tab state, dark/light theming, and the landing → app transition.
export default function App() {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [dark, setDark] = useState(true);
  const [preloadQuery, setPreloadQuery] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);

  // Dashboard state
  const [dashResults, setDashResults] = useState({});
  const [dashLoading, setDashLoading] = useState({});

  // Compare state
  const [compareResult, setCompareResult] = useState(null);
  const [compareMeta, setCompareMeta] = useState(null);

  // Architecture state
  const [archCtx, setArchCtx] = useState('');
  const [archSaved, setArchSaved] = useState(false);
  const [archResult, setArchResult] = useState(null);
  const [archDiagram, setArchDiagram] = useState(null);
  const [archMeta, setArchMeta] = useState(null);
  const [archImages, setArchImages] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'loose' });
  }, [dark]);

  const navigate = (view, query) => {
    setTab(view);
    if (query) setPreloadQuery(query);
  };

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} dark={dark} setDark={setDark} />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} style={{ color: 'var(--sage)' }} />
          <span className="app-title">PM Copilot</span>
          <span className="tag-multi">Multi-Agent</span>
        </div>
        <nav className="tab-nav">
          {TABS.map(t => {
            const Icon = t.Icon;
            return (
              <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <Icon size={14} />
                <span className="tab-label">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setDark(!dark)} className="icon-btn">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>
      <main className="main-view">
        {tab === 'dashboard' && <DashboardView onNavigate={navigate} results={dashResults} setResults={setDashResults} loading={dashLoading} setLoading={setDashLoading} />}
        {tab === 'compare' && <CompareView result={compareResult} setResult={setCompareResult} meta={compareMeta} setMeta={setCompareMeta} />}
        {tab === 'arch' && <ArchView ctx={archCtx} setCtx={setArchCtx} saved={archSaved} setSaved={setArchSaved} result={archResult} setResult={setArchResult} diagramResult={archDiagram} setDiagramResult={setArchDiagram} meta={archMeta} setMeta={setArchMeta} uploadedImages={archImages} setUploadedImages={setArchImages} />}
        {tab === 'chat' && <ChatView preloadQuery={preloadQuery} onConsumePreload={() => setPreloadQuery(null)} msgs={chatMsgs} setMsgs={setChatMsgs} busy={chatBusy} setBusy={setChatBusy} />}
        {tab === 'metrics' && <MetricsView />}
      </main>
    </div>
  );
}