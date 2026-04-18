"""
Application settings and configuration.
Loads environment variables and defines app-wide constants.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# --- API Keys ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- ChromaDB ---
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")
CHROMA_COLLECTION_NAME = "compliance_docs"

# --- Embedding Model ---
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# --- RAG Configuration ---
RAG_TOP_K = 5
RAG_CONFIDENCE_THRESHOLD = 0.65  # Below this, trigger web search fallback

# --- Supported Countries ---
SUPPORTED_COUNTRIES = {
    "US": {
        "name": "United States",
        "regulations": ["CCPA", "CPRA", "HIPAA", "SOX"],
        "flag": "🇺🇸"
    },
    "DE": {
        "name": "Germany",
        "regulations": ["GDPR", "BDSG"],
        "flag": "🇩🇪"
    },
    "IN": {
        "name": "India",
        "regulations": ["DPDP Act 2023"],
        "flag": "🇮🇳"
    },
    "SA": {
        "name": "Saudi Arabia",
        "regulations": ["PDPL"],
        "flag": "🇸🇦"
    },
    "BR": {
        "name": "Brazil",
        "regulations": ["LGPD"],
        "flag": "🇧🇷"
    },
    "SG": {
        "name": "Singapore",
        "regulations": ["PDPA"],
        "flag": "🇸🇬"
    },
}

# --- App Settings ---
APP_TITLE = "Technical PM Launch & Architecture Copilot"
APP_VERSION = "1.0.0"
MAX_CONVERSATION_HISTORY = 20
