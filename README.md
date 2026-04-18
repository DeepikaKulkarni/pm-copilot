# Technical PM Launch & Architecture Copilot

A multi-agent AI copilot for Product Managers. Paste your architecture docs, ask compliance questions, and get stakeholder-ready launch plans — powered by LangGraph, hybrid RAG, and multi-LLM routing.

---

## System Architecture

```
React Frontend (Vite)
        │  REST  (axios, /api/*)
        ▼
FastAPI Backend  ──  ConversationSummaryMemory
        │                   │
        ▼                   ▼
 Supervisor Agent      Guardrails
 (LangGraph)       (hallucination check
        │           + structure validation)
        ├──► Tech Stack Explainer Agent  (GPT-4o-mini)
        │
        ├──► Architecture Mapper Agent   (GPT-4)
        │         └── Mermaid diagram generation
        │
        ├──► Country Readiness Agent     (GPT-4)
        │         ├── ChromaDB RAG  ← compliance PDFs
        │         └── Serper.dev web search (low-confidence fallback)
        │
        └──► Action Plan Agent           (GPT-4)
                  └── Stakeholder checklist + priority matrix
```

---

## Features

| Feature | Description |
|---|---|
| **Tech Stack Explainer** | Translate engineering jargon into PM-friendly language |
| **Architecture Mapper** | Component map, dependency graph, Mermaid diagram |
| **Compliance Analysis** | Launch readiness across 6 markets with risk scores |
| **Country Comparison** | Side-by-side regulatory diff between any two markets |
| **Action Plan Generator** | Prioritised checklist with owners and timelines |
| **File Upload** | PDF extraction (pypdf) + image upload; auto-sent to chat |
| **Follow-up Chips** | LLM-generated contextual follow-up questions after each answer |
| **Conversation Memory** | `ConversationSummaryMemory` maintains context across turns |
| **Guardrails** | Hallucination detection + output structure validation on every response |
| **Dark / Light mode** | Theme toggle on both landing page and app shell |

---

## Markets Covered

| Country | Regulation |
|---|---|
| United States | CCPA / CPRA, HIPAA (sectoral) |
| Germany | GDPR + BDSG |
| India | DPDP Act 2023 |
| Saudi Arabia | PDPL |
| Brazil | LGPD |
| Singapore | PDPA |

---

## LLM Routing

| Agent | Model | Reason |
|---|---|---|
| Supervisor / Router | GPT-4o-mini | Fast classification, low cost |
| Tech Stack Explainer | GPT-4o-mini | Summarisation, no heavy reasoning needed |
| Architecture Mapper | GPT-4 | Complex multi-service dependency reasoning |
| Country Readiness | GPT-4 | Regulatory nuance, cross-reference with RAG corpus |
| Action Plan | GPT-4 | Structured stakeholder-ready output |

---

## Tech Stack

**Backend**
- Python 3.12, FastAPI, Pydantic v2
- LangGraph (multi-agent orchestration)
- ChromaDB (vector store), `all-MiniLM-L6-v2` embeddings
- Serper.dev (web search fallback)
- pypdf (PDF text extraction for file uploads)

**Frontend**
- React 18, Vite
- `react-markdown` + `remark-gfm` (markdown + table rendering)
- `mermaid` v10 (inline architecture diagrams)
- `lucide-react` (icons)
- CSS custom properties (Rubik / DM Mono, olive/sage palette, dark + light themes)

---

## Project Structure

```
pm-copilot/
├── backend/
│   ├── main.py              # FastAPI app, all REST endpoints
│   ├── graph.py             # LangGraph agent graph definition
│   ├── memory.py            # ConversationSummaryMemory
│   ├── guardrails.py        # Hallucination detection + output validation
│   ├── requirements.txt
│   ├── start.sh             # Launches uvicorn from the project venv
│   ├── agents/
│   │   ├── supervisor.py         # Router — classifies query, picks agent
│   │   ├── tech_stack_agent.py   # Tech Stack Explainer
│   │   ├── architecture_agent.py # Architecture Mapper + Mermaid
│   │   ├── country_agent.py      # Country Readiness + risk scoring
│   │   └── action_plan_agent.py  # Action Plan Generator
│   ├── rag/
│   │   ├── ingest.py        # Ingests compliance PDFs into ChromaDB
│   │   ├── retriever.py     # Hybrid retrieval + confidence scoring
│   │   └── web_search.py    # Serper.dev fallback
│   ├── config/
│   │   ├── settings.py      # App config, supported countries
│   │   ├── llm_config.py    # LLM registry + per-agent model selection
│   │   └── prompts.py       # All agent system prompts (chain-of-thought)
│   └── data/
│       └── compliance_docs/ # Curated regulatory PDFs (source for RAG)
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx          # All views + lifted state + app shell
        ├── LandingPage.jsx  # Marketing landing page with dark/light toggle
        ├── api/
        │   └── client.js    # Axios wrappers: chatApi, contextApi, uploadApi
        └── styles/
            └── index.css    # Full design system (tokens, components, landing)
```

---

## Setup

### Prerequisites
- Python 3.12 (a `venv` inside `backend/` is expected)
- Node.js 18+
- API keys: `OPENAI_API_KEY`, `SERPER_API_KEY` (optional)

### 1. Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your API keys
```

Start the server (uses the project venv automatically):

```bash
bash start.sh
# or: venv/bin/uvicorn main:app --reload --port 8000
```

### 2. Load Compliance Documents

Run once to ingest the regulatory PDFs into ChromaDB:

```bash
cd backend
python rag/ingest.py
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Vite dev server on http://localhost:5173
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Main query endpoint — runs the full agent pipeline |
| `POST` | `/api/upload` | Upload a PDF or image; returns extracted text / base64 |
| `GET/POST/DELETE` | `/api/context` | Get, set, or clear the saved architecture context |
| `GET` | `/api/countries` | List of supported markets |
| `GET` | `/api/suggested-questions` | Context-aware starter questions |
| `GET/DELETE` | `/api/conversation/*` | Conversation history and memory summary |
| `GET` | `/api/health` | Health check |
