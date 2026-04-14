"""
Web Search using Serper.dev (Google Search Results).
Uses Serper API for search when:
1. RAG retrieval confidence is low (compliance queries)
2. Tech Stack Explainer needs current info on a technology
3. Architecture Mapper needs details on a service/tool/framework

Why Serper.dev:
- Returns actual Google search results (most comprehensive)
- 2,500 free API credits (more than enough for development + demo)
- Fast response times (~1-2 seconds)
- Commonly used in LangChain/LangGraph projects (industry standard)
- Simple REST API, no complex SDK needed

Supports different search modes: compliance, tech_stack, architecture
"""
import os
import time
import json
import httpx
from typing import Optional

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import SERPER_API_KEY


class WebSearchFallback:
    """Performs web search using Serper.dev for compliance, tech stack, and architecture queries."""

    def __init__(self):
        self.api_key = SERPER_API_KEY
        self.base_url = "https://google.serper.dev/search"

    @property
    def is_available(self) -> bool:
        return bool(self.api_key)

    def search(
        self,
        query: str,
        country: Optional[str] = None,
        search_mode: str = "compliance",
        max_results: int = 5,
    ) -> dict:
        """
        Search the web with mode-specific query enhancement.

        Args:
            query: User's question
            country: Country code (for compliance mode)
            search_mode: "compliance" | "tech_stack" | "architecture"
            max_results: Number of results to return

        Returns:
            {
                "results": [...],
                "search_time_ms": float,
                "source": "web_search",
                "query_used": str,
                "search_mode": str,
            }
        """
        start_time = time.time()

        # Enhance query based on search mode
        enhanced_query = self._enhance_query(query, country, search_mode)

        if not self.is_available:
            return {
                "results": [],
                "search_time_ms": 0.0,
                "source": "web_search",
                "query_used": enhanced_query,
                "search_mode": search_mode,
                "error": "Serper API key not configured. Add SERPER_API_KEY to .env",
            }

        try:
            headers = {
                "X-API-KEY": self.api_key,
                "Content-Type": "application/json",
            }

            payload = {
                "q": enhanced_query,
                "num": max_results,
            }

            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            results = []

            # Parse organic results
            for r in data.get("organic", [])[:max_results]:
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("link", ""),
                    "content": r.get("snippet", ""),
                    "score": r.get("position", 0),
                })

            # Get answer box / knowledge graph if available
            answer = ""
            if "answerBox" in data:
                answer = data["answerBox"].get("answer", "") or data["answerBox"].get("snippet", "")
            elif "knowledgeGraph" in data:
                answer = data["knowledgeGraph"].get("description", "")

            search_time = (time.time() - start_time) * 1000

            return {
                "results": results,
                "answer": answer,
                "search_time_ms": round(search_time, 2),
                "source": "web_search",
                "query_used": enhanced_query,
                "search_mode": search_mode,
            }

        except Exception as e:
            search_time = (time.time() - start_time) * 1000
            return {
                "results": [],
                "search_time_ms": round(search_time, 2),
                "source": "web_search",
                "query_used": enhanced_query,
                "search_mode": search_mode,
                "error": str(e),
            }

    def _enhance_query(self, query: str, country: Optional[str], search_mode: str) -> str:
        """Enhance query based on search mode for better Google results."""

        if search_mode == "compliance":
            if country:
                country_names = {
                    "US": "United States",
                    "DE": "Germany",
                    "IN": "India",
                    "SA": "Saudi Arabia",
                    "BR": "Brazil",
                    "SG": "Singapore",
                }
                country_name = country_names.get(country, country)
                return f"{query} {country_name} data protection regulation 2024 2025"
            return query

        elif search_mode == "tech_stack":
            return f"{query} technology explained for product managers what it does how it works"

        elif search_mode == "architecture":
            return f"{query} system architecture cloud infrastructure best practices"

        return query

    def format_context(self, search_result: dict) -> str:
        """Format web search results into context for the LLM."""
        if not search_result["results"]:
            return "No relevant web search results found."

        mode = search_result.get("search_mode", "compliance")

        if mode == "compliance":
            prefix = (
                "⚠️ The following information is from Google web search (not from the curated compliance knowledge base). "
                "Please verify with authoritative sources before making decisions.\n"
            )
        elif mode == "tech_stack":
            prefix = (
                "📡 The following information is from Google web search to supplement the explanation. "
                "This provides current details about the technology.\n"
            )
        elif mode == "architecture":
            prefix = (
                "📡 The following information is from Google web search to supplement the architecture analysis. "
                "This provides current best practices and documentation.\n"
            )
        else:
            prefix = "Web search results:\n"

        context_parts = [prefix]

        if search_result.get("answer"):
            context_parts.append(f"Quick Answer: {search_result['answer']}\n")

        for i, result in enumerate(search_result["results"]):
            context_parts.append(
                f"--- Source {i + 1}: {result['title']} ---\n"
                f"URL: {result['url']}\n"
                f"{result['content']}\n"
            )

        return "\n".join(context_parts)
