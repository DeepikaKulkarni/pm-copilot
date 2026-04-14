"""
LLM Configuration and Routing Logic.
Defines which LLM to use for each agent and why.

Routing Rationale:
- Supervisor/Router: GPT-4o-mini → Fast classification, low latency for routing
- Tech Stack Explainer: GPT-4o-mini → Summarization task, doesn't need heavy reasoning
- Architecture Mapper: GPT-4 → Complex multi-service dependency reasoning
- Country Readiness: Claude Sonnet → Nuanced regulatory analysis, careful compliance reasoning
- Action Plan Agent: Claude Sonnet → Best at structured, stakeholder-ready output generation
"""
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from config.settings import OPENAI_API_KEY, GOOGLE_API_KEY
from config.settings import OPENAI_API_KEY, ANTHROPIC_API_KEY


def get_supervisor_llm():
    """Fast, cheap model for query classification and routing."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        api_key=OPENAI_API_KEY,
        max_tokens=500,
    )


def get_tech_stack_llm():
    """Cost-effective model for tech jargon → PM language translation."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=OPENAI_API_KEY,
        max_tokens=2000,
    )


def get_architecture_llm():
    """Powerful model for complex dependency reasoning."""
    return ChatOpenAI(
        model="gpt-4",
        temperature=0.2,
        api_key=OPENAI_API_KEY,
        max_tokens=3000,
    )


def get_country_readiness_llm():
    """Gemini for nuanced regulatory/compliance analysis."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.1,
        google_api_key=GOOGLE_API_KEY,
        max_output_tokens=3000,
    )


def get_action_plan_llm():
    """Gemini for structured, stakeholder-ready checklists."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.2,
        google_api_key=GOOGLE_API_KEY,
        max_output_tokens=3000,
    )

# --- LLM Registry for Metrics Tracking ---
LLM_REGISTRY = {
    "supervisor": {
        "model": "gpt-4o-mini",
        "provider": "OpenAI",
        "rationale": "Fast classification, low latency for routing decisions",
    },
    "tech_stack_explainer": {
        "model": "gpt-4o-mini",
        "provider": "OpenAI",
        "rationale": "Summarization doesn't require heavy reasoning; cost-effective",
    },
    "architecture_mapper": {
        "model": "gpt-4",
        "provider": "OpenAI",
        "rationale": "Complex multi-service dependency reasoning across tech stacks",
    },
    "country_readiness": {
    "model": "gemini-2.0-flash",
    "provider": "Google",
    "rationale": "Strong regulatory analysis; fast and cost-effective for compliance reasoning",
},
"action_plan": {
    "model": "gemini-2.0-flash",
    "provider": "Google",
    "rationale": "Good at producing structured, stakeholder-ready output",
},
}
