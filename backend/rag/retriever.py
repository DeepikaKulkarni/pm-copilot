"""
RAG Retriever with Confidence Scoring.
Retrieves relevant compliance documents from ChromaDB with metadata filtering.
Implements confidence threshold — if retrieval scores are low, signals for web search fallback.
"""
import time
from typing import Optional
from langchain_community.embeddings import HuggingFaceEmbeddings
import chromadb

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    EMBEDDING_MODEL,
    RAG_TOP_K,
    RAG_CONFIDENCE_THRESHOLD,
)


class ComplianceRetriever:
    """Retrieves compliance documents from ChromaDB with confidence scoring."""

    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        self.client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        try:
            self.collection = self.client.get_collection(CHROMA_COLLECTION_NAME)
        except Exception:
            self.collection = None
            print("⚠️  ChromaDB collection not found. Run ingest.py first.")

    def retrieve(
        self,
        query: str,
        country_filter: Optional[str] = None,
        regulation_filter: Optional[str] = None,
        top_k: int = RAG_TOP_K,
    ) -> dict:
        """
        Retrieve relevant documents with confidence scoring.

        Returns:
            {
                "documents": [...],
                "scores": [...],
                "metadatas": [...],
                "avg_confidence": float,
                "needs_web_fallback": bool,
                "retrieval_time_ms": float,
            }
        """
        if self.collection is None:
            return {
                "documents": [],
                "scores": [],
                "metadatas": [],
                "avg_confidence": 0.0,
                "needs_web_fallback": True,
                "retrieval_time_ms": 0.0,
            }

        start_time = time.time()

        # Embed the query
        query_embedding = self.embeddings.embed_query(query)

        # Build metadata filter
        where_filter = None
        if country_filter and regulation_filter:
            where_filter = {
                "$and": [
                    {"country": {"$eq": country_filter}},
                    {"regulation_name": {"$eq": regulation_filter}},
                ]
            }
        elif country_filter:
            where_filter = {"country": {"$eq": country_filter}}
        elif regulation_filter:
            where_filter = {"regulation_name": {"$eq": regulation_filter}}

        # Query ChromaDB
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            print(f"ChromaDB query error: {e}")
            # Retry without filter
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )

        retrieval_time = (time.time() - start_time) * 1000

        # Process results
        documents = results["documents"][0] if results["documents"] else []
        metadatas = results["metadatas"][0] if results["metadatas"] else []
        distances = results["distances"][0] if results["distances"] else []

        # Convert cosine distances to similarity scores (ChromaDB returns distances)
        # Cosine distance = 1 - cosine_similarity, so similarity = 1 - distance
        scores = [max(0, 1 - d) for d in distances]

        # Calculate average confidence
        avg_confidence = sum(scores) / len(scores) if scores else 0.0

        # Determine if web search fallback is needed
        needs_web_fallback = avg_confidence < RAG_CONFIDENCE_THRESHOLD

        return {
            "documents": documents,
            "scores": scores,
            "metadatas": metadatas,
            "avg_confidence": round(avg_confidence, 3),
            "needs_web_fallback": needs_web_fallback,
            "retrieval_time_ms": round(retrieval_time, 2),
        }

    def format_context(self, retrieval_result: dict) -> str:
        """Format retrieved documents into a context string for the LLM."""
        if not retrieval_result["documents"]:
            return "No compliance documents found in the knowledge base."

        context_parts = []
        for i, (doc, meta, score) in enumerate(
            zip(
                retrieval_result["documents"],
                retrieval_result["metadatas"],
                retrieval_result["scores"],
            )
        ):
            source_info = f"[{meta.get('country', '?')} | {meta.get('regulation_name', '?')} | confidence: {score:.2f}]"
            context_parts.append(f"--- Source {i + 1} {source_info} ---\n{doc}\n")

        context = "\n".join(context_parts)

        if retrieval_result["needs_web_fallback"]:
            context += "\n⚠️ LOW CONFIDENCE: Retrieved documents may not fully answer this query. Web search fallback recommended."

        return context
