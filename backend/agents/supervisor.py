"""
Supervisor/Router Agent.
Classifies incoming queries and routes them to the appropriate specialized agent.
Uses GPT-4o-mini for fast, cost-effective routing decisions.
"""
import json
from typing import Optional
from langchain_core.messages import HumanMessage, SystemMessage

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.prompts import SUPERVISOR_PROMPT
from config.llm_config import get_supervisor_llm


VALID_AGENTS = [
    "tech_stack_explainer",
    "architecture_mapper",
    "country_readiness",
    "action_plan",
]


def parse_supervisor_response(response_text: str) -> dict:
    """Parse the supervisor's JSON routing response."""
    try:
        # Try to extract JSON from the response
        text = response_text.strip()
        # Handle markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)

        # Validate primary_agent
        if result.get("primary_agent") not in VALID_AGENTS:
            result["primary_agent"] = "tech_stack_explainer"  # Safe default

        # Validate secondary_agents
        result["secondary_agents"] = [
            a for a in result.get("secondary_agents", []) if a in VALID_AGENTS
        ]

        return result

    except (json.JSONDecodeError, KeyError, IndexError):
        # Fallback: try to infer from keywords
        return {
            "primary_agent": "tech_stack_explainer",
            "secondary_agents": [],
            "reasoning": "Could not parse routing response, defaulting to tech_stack_explainer",
            "extracted_entities": {
                "technologies": [],
                "countries": [],
                "teams": [],
                "concerns": [],
            },
            "needs_clarification": False,
            "clarification_question": None,
        }


def route_query(
    query: str,
    architecture_context: Optional[str] = None,
    conversation_history: Optional[list] = None,
) -> dict:
    """
    Route a user query to the appropriate agent(s).

    Returns routing decision with extracted entities and reasoning.
    """
    llm = get_supervisor_llm()

    # Build the context message
    context_msg = ""
    if architecture_context:
        context_msg = f"\n\nArchitecture Context provided by user:\n{architecture_context}"

    if conversation_history:
        recent = conversation_history[-5:]  # Last 5 exchanges
        history_text = "\n".join(
            [f"{'User' if i % 2 == 0 else 'Assistant'}: {msg}" for i, msg in enumerate(recent)]
        )
        context_msg += f"\n\nRecent conversation:\n{history_text}"

    messages = [
        SystemMessage(content=SUPERVISOR_PROMPT),
        HumanMessage(content=f"User Question: {query}{context_msg}"),
    ]

    response = llm.invoke(messages)
    routing = parse_supervisor_response(response.content)

    return routing
