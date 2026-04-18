"""
Country Readiness Agent (merged with Risk Scoring).
Assesses launch readiness for specific countries.
Uses Claude for nuanced regulatory analysis and compliance reasoning.
Integrates RAG retrieval + web search fallback.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Optional
import time

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.prompts import COUNTRY_READINESS_PROMPT
from config.llm_config import get_country_readiness_llm
from rag.retriever import ComplianceRetriever
from rag.web_search import WebSearchFallback


# Initialize retriever and web search
retriever = ComplianceRetriever()
web_search = WebSearchFallback()


def _extract_countries_from_query(question: str, extracted_entities: Optional[dict] = None) -> list:
    """Extract country codes from the query or entities."""
    countries = []

    if extracted_entities and extracted_entities.get("countries"):
        countries = extracted_entities["countries"]
    else:
        # Simple keyword matching as fallback
        country_keywords = {
            "US": ["us", "united states", "america", "california", "ccpa"],
            "DE": ["germany", "german", "gdpr", "eu", "europe", "frankfurt"],
            "IN": ["india", "indian", "dpdp", "mumbai", "delhi"],
            "SA": ["saudi", "saudi arabia", "ksa", "pdpl", "riyadh", "jeddah"],
            "BR": ["brazil", "brazilian", "lgpd", "são paulo", "sao paulo"],
            "SG": ["singapore", "singaporean", "pdpa"],
        }
        question_lower = question.lower()
        for code, keywords in country_keywords.items():
            if any(kw in question_lower for kw in keywords):
                countries.append(code)

    return countries if countries else ["US"]  # Default to US if no country detected


def assess_country_readiness(
    question: str,
    architecture_context: Optional[str] = None,
    extracted_entities: Optional[dict] = None,
) -> dict:
    """
    Assess launch readiness for one or more countries.
    Uses hybrid retrieval: RAG first, web search fallback if low confidence.

    Returns:
        {
            "response": str,
            "agent": "country_readiness",
            "model_used": "claude-sonnet-4-20250514",
            "retrieval_source": "rag" | "web_search" | "hybrid",
            "rag_confidence": float,
            "retrieval_time_ms": float,
            "countries_analyzed": list,
        }
    """
    start_time = time.time()

    countries = _extract_countries_from_query(question, extracted_entities)

    # --- Hybrid Retrieval ---
    all_contexts = []
    retrieval_source = "rag"
    rag_confidence = 0.0
    total_retrieval_time = 0.0

    for country in countries:
        # Step 1: Try RAG retrieval
        rag_result = retriever.retrieve(query=question, country_filter=country)
        total_retrieval_time += rag_result["retrieval_time_ms"]
        rag_confidence = max(rag_confidence, rag_result["avg_confidence"])

        rag_context = retriever.format_context(rag_result)
        all_contexts.append(f"--- RAG Results for {country} ---\n{rag_context}")

        # Step 2: Web search fallback if confidence is low
        if rag_result["needs_web_fallback"]:
            retrieval_source = "hybrid"
            web_result = web_search.search(query=question, country=country)
            total_retrieval_time += web_result.get("search_time_ms", 0)
            web_context = web_search.format_context(web_result)
            all_contexts.append(f"--- Web Search Results for {country} ---\n{web_context}")

    compliance_context = "\n\n".join(all_contexts)

    # --- LLM Generation ---
    llm = get_country_readiness_llm()

    prompt = COUNTRY_READINESS_PROMPT.format(
        compliance_context=compliance_context,
        architecture_context=architecture_context or "No architecture context provided.",
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
        "agent": "country_readiness",
        "model_used": "claude-sonnet-4-20250514",
        "retrieval_source": retrieval_source,
        "rag_confidence": rag_confidence,
        "retrieval_time_ms": round(total_retrieval_time, 2),
        "total_time_ms": round(total_time, 2),
        "countries_analyzed": countries,
    }
