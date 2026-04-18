"""
Architecture Mapper Agent (merged with Dependency Mapper).
Maps system components, dependencies, data flows, and team ownership.
Uses GPT-4 for complex multi-service dependency reasoning.

Web Search Integration:
- Searches for documentation on specific services, APIs, and cloud components mentioned in the query
- Helps map dependencies even when architecture docs are incomplete
- Provides current cloud service capabilities and limitations
"""
import time
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Optional

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.prompts import ARCHITECTURE_MAPPER_PROMPT
from config.llm_config import get_architecture_llm
from rag.web_search import WebSearchFallback


web_search = WebSearchFallback()


def map_architecture(
    question: str,
    architecture_context: Optional[str] = None,
    extracted_entities: Optional[dict] = None,
) -> dict:
    """
    Analyze and map system architecture, dependencies, and ownership.
    Enriches analysis with web search for service documentation and best practices.

    Returns:
        {
            "response": str,
            "agent": "architecture_mapper",
            "model_used": "gpt-4",
            "retrieval_source": "web_search" | "none",
            "search_time_ms": float,
        }
    """
    start_time = time.time()
    llm = get_architecture_llm()

    # --- Web search for architecture/service info ---
    web_context = ""
    search_time = 0.0
    retrieval_source = "none"
    sources = []

    # Extract technology names from entities or query for targeted search
    search_query = question
    if extracted_entities and extracted_entities.get("technologies"):
        techs = ", ".join(extracted_entities["technologies"][:3])
        search_query = f"{question} {techs}"

    try:
        search_result = web_search.search(
            query=search_query,
            search_mode="architecture",
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
        print(f"Architecture web search failed: {e}")
        web_context = ""

    # --- Combine contexts ---
    full_context = architecture_context or "No architecture context provided. Please paste or upload architecture notes."
    if web_context:
        full_context += f"\n\nWeb Search Results (current documentation & best practices):\n{web_context}"

    prompt = ARCHITECTURE_MAPPER_PROMPT.format(
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
        "agent": "architecture_mapper",
        "model_used": "gpt-4",
        "retrieval_source": retrieval_source,
        "search_time_ms": round(search_time, 2),
        "total_time_ms": round(total_time, 2),
        "sources": sources,
    }
