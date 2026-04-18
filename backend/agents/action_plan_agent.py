"""
Action Plan Agent.
Generates stakeholder checklists, next steps, and release decision summaries.
Uses GPT-4 for structured, stakeholder-ready output.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Optional

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.prompts import ACTION_PLAN_PROMPT
from config.llm_config import get_action_plan_llm


def generate_action_plan(
    question: str,
    architecture_context: Optional[str] = None,
    previous_outputs: Optional[str] = None,
    extracted_entities: Optional[dict] = None,
) -> dict:
    """
    Generate an action plan based on previous agent outputs and the user's question.

    Returns:
        {
            "response": str,
            "agent": "action_plan",
            "model_used": "gpt-4",
        }
    """
    llm = get_action_plan_llm()

    prompt = ACTION_PLAN_PROMPT.format(
        previous_outputs=previous_outputs or "No previous agent outputs available.",
        architecture_context=architecture_context or "No architecture context provided.",
        question=question,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=question),
    ]

    response = llm.invoke(messages)

    return {
        "response": response.content,
        "agent": "action_plan",
        "model_used": "gpt-4",
        "sources": [],
    }
