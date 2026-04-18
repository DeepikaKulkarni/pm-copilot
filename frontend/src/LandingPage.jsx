import React from 'react';
import {
  Zap, ArrowRight, Globe, Code2, GitCompare, ClipboardList,
  Database, Search, Brain, Shield, Cpu, Layers, Sun, Moon,
} from 'lucide-react';

const FEATURES = [
  {
    Icon: Code2,
    title: 'Tech Stack Explainer',
    desc: 'Paste any architecture doc and get plain-English explanations of every technology, dependency, and risk factor — no engineering background needed.',
    color: 'var(--sky)',
  },
  {
    Icon: Globe,
    title: 'Compliance Analysis',
    desc: 'Instantly assess launch readiness across 6 markets — US, Germany, India, Saudi Arabia, Brazil, and Singapore — with regulation-specific guidance.',
    color: 'var(--sand)',
  },
  {
    Icon: GitCompare,
    title: 'Country Comparison',
    desc: 'Side-by-side regulatory comparison between any two markets. Data residency, breach notification, enforcement penalties — all in one view.',
    color: 'var(--lilac)',
  },
  {
    Icon: ClipboardList,
    title: 'Action Plan Generator',
    desc: 'Generate stakeholder-ready launch checklists with specific owners, priorities, and timelines. Export as markdown for Jira or Confluence.',
    color: 'var(--coral)',
  },
];

const TECH = [
  { Icon: Layers,   label: 'LangGraph',     desc: 'Multi-agent orchestration' },
  { Icon: Database,  label: 'ChromaDB RAG',  desc: 'Grounded in real compliance docs' },
  { Icon: Search,    label: 'Web Search',    desc: 'Serper.dev fallback for recency' },
  { Icon: Cpu,       label: 'Multi-LLM',     desc: 'GPT-4, GPT-4o-mini routing' },
  { Icon: Brain,     label: 'Memory',        desc: 'ConversationSummaryMemory' },
  { Icon: Shield,    label: 'Guardrails',    desc: 'Hallucination detection' },
];

export default function LandingPage({ onEnter, dark, setDark }) {
  return (
    <div className="landing">
      {/* Topbar */}
      <div className="landing-topbar">
        <div className="landing-topbar-logo">
          <Zap size={15} style={{ color: 'var(--sage)' }} />
          <span>PM Copilot</span>
        </div>
        <button className="icon-btn" onClick={() => setDark(!dark)}>
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-badge">
            <Zap size={12} /> Multi-Agent AI Copilot
          </div>
          <h1 className="landing-h1">
            Technical PM<br />Launch Copilot
          </h1>
          <p className="landing-sub">
            Understand tech stacks, map architecture dependencies, check compliance
            across 6 global markets, and generate stakeholder-ready launch plans — all
            powered by intelligent multi-agent AI.
          </p>
          <div className="landing-ctas">
            <button className="landing-btn-primary" onClick={onEnter}>
              Launch Copilot <ArrowRight size={15} />
            </button>
          </div>

          {/* Quick stats */}
          <div className="landing-stats">
            {[
              { val: '6', label: 'Markets' },
              { val: '5', label: 'AI Agents' },
              { val: '7', label: 'Compliance PDFs' },
              { val: '3', label: 'LLM Providers' },
            ].map((s, i) => (
              <div key={i} className="landing-stat">
                <div className="landing-stat-val">{s.val}</div>
                <div className="landing-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <h2 className="landing-h2">Built for PMs who work across engineering teams</h2>
          <p className="landing-section-desc">
            Stop asking engineers to explain their stack. Get instant, actionable answers.
          </p>
          <div className="landing-features">
            {FEATURES.map((f, i) => {
              const FIcon = f.Icon;
              return (
                <div key={i} className="landing-fcard">
                  <div className="landing-fcard-icon" style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 12%, transparent)` }}>
                    <FIcon size={18} strokeWidth={1.5} />
                  </div>
                  <h3 className="landing-fcard-title">{f.title}</h3>
                  <p className="landing-fcard-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" style={{ background: 'var(--bg-1)' }}>
        <div className="landing-section-inner">
          <h2 className="landing-h2">How it works</h2>
          <div className="landing-steps">
            {[
              { step: '01', title: 'Ask a question', desc: 'Type any question about tech stacks, architecture, compliance, or launch planning in plain English.' },
              { step: '02', title: 'Smart routing', desc: 'The Supervisor agent analyzes your query and routes it to the best specialized agent with the optimal LLM.' },
              { step: '03', title: 'Grounded answers', desc: 'Agents retrieve from curated compliance documents (RAG) and fall back to web search when needed.' },
              { step: '04', title: 'Actionable output', desc: 'Get structured responses with risk scores, comparison tables, action items, and exportable reports.' },
            ].map((s, i) => (
              <div key={i} className="landing-step">
                <div className="landing-step-num">{s.step}</div>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <h2 className="landing-h2">Under the hood</h2>
          <p className="landing-section-desc">
            Built with production-grade AI infrastructure
          </p>
          <div className="landing-tech">
            {TECH.map((t, i) => {
              const TIcon = t.Icon;
              return (
                <div key={i} className="landing-tech-item">
                  <TIcon size={16} style={{ color: 'var(--sage)' }} />
                  <div>
                    <div className="landing-tech-label">{t.label}</div>
                    <div className="landing-tech-desc">{t.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section landing-cta-section">
        <div className="landing-section-inner" style={{ textAlign: 'center' }}>
          <h2 className="landing-h2">Ready to assess your launch readiness?</h2>
          <p className="landing-section-desc" style={{ marginBottom: 24 }}>
            Paste your architecture docs and get instant compliance analysis across 6 markets.
          </p>
          <button className="landing-btn-primary" onClick={onEnter}>
            Launch Copilot <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>Technical PM Launch & Architecture Copilot</span>
        <span>IE5374 Applied Generative AI — Northeastern University</span>
      </footer>
    </div>
  );
}