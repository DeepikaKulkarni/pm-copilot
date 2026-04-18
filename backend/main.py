"""
FastAPI Backend for Technical PM Launch & Architecture Copilot.
Provides REST API endpoints for the React frontend.
"""
import io
import base64
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, SystemMessage

from graph import run_copilot
from config.settings import APP_TITLE, APP_VERSION, SUPPORTED_COUNTRIES
from config.llm_config import LLM_REGISTRY, get_supervisor_llm
from memory import ConversationSummaryMemory
from guardrails import check_hallucination, validate_output_structure


# --- FastAPI App ---
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="Multi-agent AI copilot for Technical PMs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request/Response Models ---

class ChatRequest(BaseModel):
    query: str
    architecture_context: Optional[str] = None
    conversation_history: Optional[list] = None


class ChatResponse(BaseModel):
    response: str
    agent_used: str
    model_used: str
    total_time_ms: float
    retrieval_source: Optional[str] = None
    rag_confidence: float = 0.0
    step_log: list = []
    routing_decision: Optional[dict] = None
    needs_clarification: bool = False
    follow_up_questions: list = []
    hallucination_check: Optional[dict] = None
    structure_check: Optional[dict] = None


class ArchitectureContextRequest(BaseModel):
    context: str


# --- In-memory state ---
architecture_store: dict = {}
conversation_store: dict = {}
conversation_memory = ConversationSummaryMemory()


# --- Follow-up question generator ---

def generate_follow_ups(query: str, response: str, agent: str) -> list:
    """Generate 2-3 contextual follow-up questions based on the response."""
    try:
        llm = get_supervisor_llm()
        messages = [
            SystemMessage(content="""Based on the user's question and the assistant's response, generate exactly 3 short follow-up questions that a Product Manager would naturally want to ask next.

Rules:
- Each question must be under 80 characters
- Questions should dig deeper into the topic, not repeat what was already answered
- Make them specific and actionable, not generic
- Return ONLY the 3 questions, one per line, no numbering, no bullets, no extra text"""),
            HumanMessage(content=f"User asked: {query}\n\nAssistant responded about: {response[:500]}")
        ]
        result = llm.invoke(messages)
        lines = [l.strip() for l in result.content.strip().split('\n') if l.strip()]
        return lines[:3]
    except Exception:
        return []


# --- Endpoints ---

@app.get("/")
async def root():
    return {
        "app": APP_TITLE,
        "version": APP_VERSION,
        "status": "running",
        "endpoints": {
            "chat": "/api/chat",
            "countries": "/api/countries",
            "models": "/api/models",
            "health": "/api/health",
            "export": "/api/export",
        },
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/api/countries")
async def get_countries():
    return {"countries": SUPPORTED_COUNTRIES}


@app.get("/api/models")
async def get_models():
    return {"models": LLM_REGISTRY}


@app.post("/api/context")
async def set_architecture_context(request: ArchitectureContextRequest):
    architecture_store["current"] = request.context
    return {
        "status": "context_updated",
        "context_length": len(request.context),
        "preview": request.context[:200] + "..." if len(request.context) > 200 else request.context,
    }


@app.get("/api/context")
async def get_architecture_context():
    context = architecture_store.get("current", "")
    return {
        "context": context,
        "has_context": bool(context),
        "context_length": len(context),
    }


@app.delete("/api/context")
async def clear_architecture_context():
    architecture_store.pop("current", None)
    return {"status": "context_cleared"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint. Routes queries through the LangGraph agent pipeline.
    Includes: memory context, follow-up generation, hallucination detection, guardrails.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        arch_context = request.architecture_context or architecture_store.get("current")

        # Get memory context
        memory_context = conversation_memory.get_context()

        # Run through the copilot pipeline
        result = run_copilot(
            query=request.query,
            architecture_context=arch_context,
            conversation_history=[memory_context] if memory_context else [],
        )

        # Update conversation memory
        conversation_memory.add_exchange(
            request.query,
            result.get("response", "")
        )

        # Generate follow-up questions
        follow_ups = generate_follow_ups(
            request.query,
            result.get("response", ""),
            result.get("agent_used", "")
        )
        result["follow_up_questions"] = follow_ups

        # Run hallucination detection
        extracted_countries = []
        if result.get("routing_decision") and result["routing_decision"].get("extracted_entities"):
            extracted_countries = result["routing_decision"]["extracted_entities"].get("countries", [])

        hallucination_check = check_hallucination(
            response=result.get("response", ""),
            agent=result.get("agent_used", ""),
            rag_confidence=result.get("rag_confidence", 0),
            countries=extracted_countries,
        )

        # Run output validation
        structure_check = validate_output_structure(
            response=result.get("response", ""),
            agent=result.get("agent_used", ""),
        )

        result["hallucination_check"] = hallucination_check
        result["structure_check"] = structure_check

        # Update basic conversation store
        if "history" not in conversation_store:
            conversation_store["history"] = []
        conversation_store["history"].append(request.query)
        conversation_store["history"].append(result.get("response", ""))
        if len(conversation_store["history"]) > 40:
            conversation_store["history"] = conversation_store["history"][-40:]

        return ChatResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.get("/api/conversation/history")
async def get_conversation_history():
    return {"history": conversation_store.get("history", [])}


@app.get("/api/conversation/summary")
async def get_conversation_summary():
    """Return the current conversation summary from memory."""
    return {
        "summary": conversation_memory.summary,
        "turn_count": conversation_memory.turn_count,
    }


@app.delete("/api/conversation/clear")
async def clear_conversation():
    """Clear conversation history and memory."""
    conversation_store.clear()
    conversation_memory.clear()
    return {"status": "conversation_cleared"}


@app.get("/api/suggested-questions")
async def get_suggested_questions():
    has_context = bool(architecture_store.get("current"))
    if has_context:
        return {
            "questions": [
                "Explain this architecture in simple PM language",
                "What dependencies exist between the services?",
                "Can we launch this stack in Germany?",
                "Compare launch readiness for India vs Saudi Arabia",
                "What are the top risks and blockers for a global launch?",
                "Generate an action plan for launching in all 6 countries",
            ]
        }
    else:
        return {
            "questions": [
                "What is Kubernetes and why does it matter for PMs?",
                "Explain microservices vs monolith for a PM",
                "What are the data residency requirements in Germany?",
                "Compare compliance requirements: US vs Brazil",
                "What cloud regions are available in Saudi Arabia?",
                "What does a PM need to know about GDPR?",
            ]
        }


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or ""
    content = await file.read()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        text = "\n\n".join(p.extract_text() or "" for p in reader.pages)
        return {"type": "pdf", "filename": filename, "text": text[:10000], "pages": len(reader.pages)}
    elif ext in ("png", "jpg", "jpeg", "webp"):
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}[ext]
        return {"type": "image", "filename": filename, "base64": base64.b64encode(content).decode(), "mime_type": mime}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")


@app.post("/api/export")
async def export_response(request: ChatRequest):
    """Export a response as downloadable markdown."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        arch_context = request.architecture_context or architecture_store.get("current")
        result = run_copilot(query=request.query, architecture_context=arch_context)

        markdown = f"""# PM Copilot Report
## Query
{request.query}

## Agent
{result.get('agent_used', 'unknown')} ({result.get('model_used', 'unknown')})

## Analysis
{result.get('response', '')}

---
*Generated by Technical PM Launch & Architecture Copilot*
*Retrieval: {result.get('retrieval_source', 'N/A')} | Confidence: {result.get('rag_confidence', 0):.0%}*
"""
        return {"markdown": markdown, "filename": f"pm-copilot-report-{int(time.time())}.md"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)