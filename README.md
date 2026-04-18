# Technical PM Launch & Architecture Copilot

A multi-agent AI copilot that helps Product Managers and Technical PMs understand complex tech stacks, system dependencies, and assess global launch readiness across 6 countries.

## Architecture

```
User Query (React Frontend)
        │
        ▼
   FastAPI Backend
        │
        ▼
  Supervisor/Router Agent (LangGraph)
        │
        ├──► Tech Stack Explainer Agent
        │         (GPT-4o-mini / Mistral - fast, cost-effective)
        │
        ├──► Architecture Mapper Agent
        │         (GPT-4 - complex dependency reasoning)
        │
        ├──► Country Readiness Agent
        │         │
        │         ├──► ChromaDB RAG (primary - curated compliance docs)
        │         └──► Web Search (fallback - low confidence / recency)
        │         (Claude - nuanced regulatory analysis + risk severity)
        │
        └──► Action Plan Agent
                  (Claude - structured stakeholder checklists)
```

## Countries Covered
- 🇺🇸 United States (CCPA/CPRA, HIPAA, sectoral)
- 🇩🇪 Germany (GDPR + BDSG)
- 🇮🇳 India (DPDP Act 2023)
- 🇸🇦 Saudi Arabia (PDPL)
- 🇧🇷 Brazil (LGPD)
- 🇸🇬 Singapore (PDPA)

## Tech Stack
- **Orchestration**: LangGraph
- **Vector DB**: ChromaDB
- **Backend**: FastAPI (Python)
- **Frontend**: React
- **LLMs**: OpenAI GPT-4/GPT-4o-mini, Anthropic Claude, Llama/Mistral
- **Retrieval**: Hybrid RAG + Web Search fallback

## Setup

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
# Set environment variables
cp .env.example .env
# Edit .env with your API keys
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm start
```

### 3. Load Compliance Documents
```bash
cd backend
python rag/ingest.py
```

## Project Structure
```
pm-copilot/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   ├── supervisor.py          # Supervisor/Router agent
│   │   ├── tech_stack_agent.py    # Tech Stack Explainer
│   │   ├── architecture_agent.py  # Architecture Mapper + Dependencies
│   │   ├── country_agent.py       # Country Readiness + Risk Scoring
│   │   └── action_plan_agent.py   # Action Plan Generator
│   ├── rag/
│   │   ├── ingest.py              # Document ingestion pipeline
│   │   ├── retriever.py           # ChromaDB retrieval + confidence scoring
│   │   └── web_search.py          # Web search fallback
│   ├── config/
│   │   ├── settings.py            # App configuration
│   │   ├── llm_config.py          # LLM routing configuration
│   │   └── prompts.py             # All agent system prompts
│   ├── routes/
│   │   └── chat.py                # Chat API endpoints
│   └── data/
│       └── compliance_docs/       # Curated regulatory documents
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── components/
│       └── api/
└── docs/
    └── architecture_diagram.md
```

## LLM Routing Rationale

| Agent | Primary LLM | Reasoning |
|-------|-------------|-----------|
| Supervisor/Router | GPT-4o-mini | Fast classification, low cost for routing decisions |
| Tech Stack Explainer | GPT-4o-mini | Summarization doesn't need heavy reasoning |
| Architecture Mapper | GPT-4 | Complex dependency reasoning across services |
| Country Readiness | Claude | Nuanced regulatory analysis, careful with compliance |
| Action Plan Agent | Claude | Best at structured, stakeholder-ready outputs |
