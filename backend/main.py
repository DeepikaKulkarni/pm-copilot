"""
FastAPI Backend for Technical PM Launch & Architecture Copilot.
Provides REST API endpoints for the React frontend.
"""
import time
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph import run_copilot
from config.settings import APP_TITLE, APP_VERSION, SUPPORTED_COUNTRIES
from config.llm_config import LLM_REGISTRY


# --- FastAPI App ---
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="Multi-agent AI copilot for Technical PMs",
)

# CORS for React frontend
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


class ArchitectureContextRequest(BaseModel):
    context: str


# --- In-memory state ---
# In production, use Redis or a database
architecture_store: dict = {}
conversation_store: dict = {}


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
        },
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/api/countries")
async def get_countries():
    """Return supported countries and their regulations."""
    return {"countries": SUPPORTED_COUNTRIES}


@app.get("/api/models")
async def get_models():
    """Return LLM registry with routing rationale."""
    return {"models": LLM_REGISTRY}


@app.post("/api/context")
async def set_architecture_context(request: ArchitectureContextRequest):
    """Set or update the architecture context for the session."""
    architecture_store["current"] = request.context
    return {
        "status": "context_updated",
        "context_length": len(request.context),
        "preview": request.context[:200] + "..." if len(request.context) > 200 else request.context,
    }


@app.get("/api/context")
async def get_architecture_context():
    """Get the current architecture context."""
    context = architecture_store.get("current", "")
    return {
        "context": context,
        "has_context": bool(context),
        "context_length": len(context),
    }


@app.delete("/api/context")
async def clear_architecture_context():
    """Clear the architecture context."""
    architecture_store.pop("current", None)
    return {"status": "context_cleared"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint. Routes queries through the LangGraph agent pipeline.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        # Get architecture context from store or request
        arch_context = request.architecture_context or architecture_store.get("current")

        # Get conversation history
        history = request.conversation_history or conversation_store.get("history", [])

        # Run through the copilot pipeline
        result = run_copilot(
            query=request.query,
            architecture_context=arch_context,
            conversation_history=history,
        )

        # Update conversation history
        if "history" not in conversation_store:
            conversation_store["history"] = []
        conversation_store["history"].append(request.query)
        conversation_store["history"].append(result.get("response", ""))

        # Keep history manageable
        if len(conversation_store["history"]) > 40:
            conversation_store["history"] = conversation_store["history"][-40:]

        return ChatResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.get("/api/conversation/history")
async def get_conversation_history():
    """Return conversation history."""
    return {"history": conversation_store.get("history", [])}


@app.delete("/api/conversation/clear")
async def clear_conversation():
    """Clear conversation history."""
    conversation_store.clear()
    return {"status": "conversation_cleared"}


@app.get("/api/suggested-questions")
async def get_suggested_questions():
    """Return suggested starter questions for the UI."""
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
