"""
Tech Stack Explainer Agent.
Translates technical jargon into PM-friendly language.
Uses GPT-4o-mini for cost-effective summarization.

Web Search Integration:
- Always searches the web for current information about the technology
- Combines web search context with architecture context for grounded explanations
- Ensures the PM gets up-to-date info (e.g., latest versions, deprecations, ecosystem changes)
"""
import time
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Optional

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.prompts import TECH_STACK_EXPLAINER_PROMPT
from config.llm_config import get_tech_stack_llm
from rag.web_search import WebSearchFallback


web_search = WebSearchFallback()


def explain_tech_stack(
    question: str,
    architecture_context: Optional[str] = None,
    extracted_entities: Optional[dict] = None,
) -> dict:
    """
    Explain a technology or tech stack in PM language.
    Enriches explanation with web search for current information.

    Returns:
        {
            "response": str,
            "agent": "tech_stack_explainer",
            "model_used": "gpt-4o-mini",
            "retrieval_source": "web_search" | "none",
            "search_time_ms": float,
        }
    """
    start_time = time.time()
    llm = get_tech_stack_llm()

    # --- Web search for current tech info ---
    web_context = ""
    search_time = 0.0
    retrieval_source = "none"
    sources = []

    try:
        search_result = web_search.search(
            query=question,
            search_mode="tech_stack",
            max_results=3,
        )
        search_time = search_result.get("search_time_ms", 0.0)

        if search_result.get("results"):
            web_context = web_search.format_context(search_result)
            retrieval_source = "web_search"
            sources = [
                {"type": "web", "title": r.get("title", r["url"]), "url": r["url"]}
                for r in search_result["results"] if r.get("url")
            ]
    except Exception as e:
        print(f"Tech stack web search failed: {e}")
        web_context = ""

    # --- Combine contexts ---
    full_context = architecture_context or "No architecture context provided."
    if web_context:
        full_context += f"\n\nWeb Search Results (current information):\n{web_context}"

    prompt = TECH_STACK_EXPLAINER_PROMPT.format(
        architecture_context=full_context,
        question=question,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=question),
    ]

    response = llm.invoke(messages)

    total_time = (time.time() - start_time) * 1000

    return {
        "response": response.content,
        "agent": "tech_stack_explainer",
        "model_used": "gpt-4o-mini",
        "retrieval_source": retrieval_source,
        "search_time_ms": round(search_time, 2),
        "total_time_ms": round(total_time, 2),
        "sources": sources,
    }
