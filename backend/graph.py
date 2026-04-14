"""
LangGraph Orchestration Graph.
This is the core of the Technical PM Copilot — it defines how queries flow
through the multi-agent system.

Graph Structure:
    START → supervisor → route_decision → [agent] → format_output → END
                                              ↓ (if secondary agents needed)
                                         [agent_2] → format_output → END

State tracks:
- User query and architecture context
- Routing decision from supervisor
- Agent outputs (primary + secondary)
- Retrieval metadata (confidence, source, latency)
- Conversation history
"""
import time
from typing import TypedDict, Optional, Annotated
from langgraph.graph import StateGraph, END

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from agents.supervisor import route_query
from agents.tech_stack_agent import explain_tech_stack
from agents.architecture_agent import map_architecture
from agents.country_agent import assess_country_readiness
from agents.action_plan_agent import generate_action_plan


# --- State Definition ---
class CopilotState(TypedDict):
    """State that flows through the LangGraph graph."""
    # Input
    query: str
    architecture_context: Optional[str]
    conversation_history: list

    # Routing
    routing_decision: Optional[dict]
    primary_agent: Optional[str]
    secondary_agents: list
    extracted_entities: Optional[dict]
    needs_clarification: bool
    clarification_question: Optional[str]

    # Agent Outputs
    primary_output: Optional[dict]
    secondary_outputs: list
    combined_response: Optional[str]

    # Metadata / Metrics
    start_time: float
    total_time_ms: float
    retrieval_source: Optional[str]
    rag_confidence: float
    step_log: list  # Track each step for metrics


# --- Node Functions ---

def supervisor_node(state: CopilotState) -> dict:
    """Route the query to the appropriate agent."""
    step_start = time.time()

    routing = route_query(
        query=state["query"],
        architecture_context=state.get("architecture_context"),
        conversation_history=state.get("conversation_history", []),
    )

    step_time = (time.time() - step_start) * 1000

    step_log = state.get("step_log", [])
    step_log.append({
        "step": "supervisor",
        "model": "gpt-4o-mini",
        "time_ms": round(step_time, 2),
        "result": routing.get("primary_agent"),
    })

    return {
        "routing_decision": routing,
        "primary_agent": routing.get("primary_agent", "tech_stack_explainer"),
        "secondary_agents": routing.get("secondary_agents", []),
        "extracted_entities": routing.get("extracted_entities"),
        "needs_clarification": routing.get("needs_clarification", False),
        "clarification_question": routing.get("clarification_question"),
        "step_log": step_log,
    }


def tech_stack_node(state: CopilotState) -> dict:
    """Run the Tech Stack Explainer agent with web search."""
    step_start = time.time()

    result = explain_tech_stack(
        question=state["query"],
        architecture_context=state.get("architecture_context"),
        extracted_entities=state.get("extracted_entities"),
    )

    step_time = (time.time() - step_start) * 1000

    step_log = state.get("step_log", [])
    step_log.append({
        "step": "tech_stack_explainer",
        "model": result["model_used"],
        "time_ms": round(step_time, 2),
        "retrieval_source": result.get("retrieval_source", "none"),
    })

    return {
        "primary_output": result,
        "retrieval_source": result.get("retrieval_source"),
        "step_log": step_log,
    }


def architecture_node(state: CopilotState) -> dict:
    """Run the Architecture Mapper agent with web search."""
    step_start = time.time()

    result = map_architecture(
        question=state["query"],
        architecture_context=state.get("architecture_context"),
        extracted_entities=state.get("extracted_entities"),
    )

    step_time = (time.time() - step_start) * 1000

    step_log = state.get("step_log", [])
    step_log.append({
        "step": "architecture_mapper",
        "model": result["model_used"],
        "time_ms": round(step_time, 2),
        "retrieval_source": result.get("retrieval_source", "none"),
    })

    return {
        "primary_output": result,
        "retrieval_source": result.get("retrieval_source"),
        "step_log": step_log,
    }


def country_readiness_node(state: CopilotState) -> dict:
    """Run the Country Readiness agent with hybrid RAG + web search."""
    step_start = time.time()

    result = assess_country_readiness(
        question=state["query"],
        architecture_context=state.get("architecture_context"),
        extracted_entities=state.get("extracted_entities"),
    )

    step_time = (time.time() - step_start) * 1000

    step_log = state.get("step_log", [])
    step_log.append({
        "step": "country_readiness",
        "model": result["model_used"],
        "time_ms": round(step_time, 2),
        "retrieval_source": result.get("retrieval_source"),
        "rag_confidence": result.get("rag_confidence"),
    })

    return {
        "primary_output": result,
        "retrieval_source": result.get("retrieval_source"),
        "rag_confidence": result.get("rag_confidence", 0.0),
        "step_log": step_log,
    }


def action_plan_node(state: CopilotState) -> dict:
    """Run the Action Plan agent, incorporating previous agent outputs."""
    step_start = time.time()

    # Gather previous outputs for context
    previous_outputs = ""
    if state.get("primary_output"):
        previous_outputs = state["primary_output"].get("response", "")
    for sec_output in state.get("secondary_outputs", []):
        previous_outputs += "\n\n" + sec_output.get("response", "")

    result = generate_action_plan(
        question=state["query"],
        architecture_context=state.get("architecture_context"),
        previous_outputs=previous_outputs if previous_outputs else None,
        extracted_entities=state.get("extracted_entities"),
    )

    step_time = (time.time() - step_start) * 1000

    step_log = state.get("step_log", [])
    step_log.append({
        "step": "action_plan",
        "model": result["model_used"],
        "time_ms": round(step_time, 2),
    })

    return {
        "primary_output": result,
        "step_log": step_log,
    }


def format_output_node(state: CopilotState) -> dict:
    """Format the final response with metadata."""
    total_time = (time.time() - state.get("start_time", time.time())) * 1000

    primary = state.get("primary_output", {})
    response = primary.get("response", "I wasn't able to generate a response. Please try rephrasing your question.")

    # Build combined response with metadata footer
    agent_name = primary.get("agent", "unknown")
    model_used = primary.get("model_used", "unknown")

    metadata_footer = (
        f"\n\n---\n"
        f"*Agent: {agent_name} | Model: {model_used} | "
        f"Total time: {total_time:.0f}ms"
    )

    if state.get("retrieval_source"):
        metadata_footer += f" | Retrieval: {state['retrieval_source']}"
    if state.get("rag_confidence"):
        metadata_footer += f" | RAG confidence: {state['rag_confidence']:.2f}"

    metadata_footer += "*"

    return {
        "combined_response": response + metadata_footer,
        "total_time_ms": round(total_time, 2),
    }


# --- Routing Logic ---

def route_to_agent(state: CopilotState) -> str:
    """Conditional edge: route to the correct agent based on supervisor decision."""
    if state.get("needs_clarification"):
        return "format_output"

    agent = state.get("primary_agent", "tech_stack_explainer")

    agent_map = {
        "tech_stack_explainer": "tech_stack",
        "architecture_mapper": "architecture",
        "country_readiness": "country_readiness",
        "action_plan": "action_plan",
    }

    return agent_map.get(agent, "tech_stack")


# --- Build the Graph ---

def build_copilot_graph() -> StateGraph:
    """Build and compile the LangGraph state graph."""
    graph = StateGraph(CopilotState)

    # Add nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("tech_stack", tech_stack_node)
    graph.add_node("architecture", architecture_node)
    graph.add_node("country_readiness", country_readiness_node)
    graph.add_node("action_plan", action_plan_node)
    graph.add_node("format_output", format_output_node)

    # Set entry point
    graph.set_entry_point("supervisor")

    # Add conditional routing from supervisor
    graph.add_conditional_edges(
        "supervisor",
        route_to_agent,
        {
            "tech_stack": "tech_stack",
            "architecture": "architecture",
            "country_readiness": "country_readiness",
            "action_plan": "action_plan",
            "format_output": "format_output",
        },
    )

    # All agents flow to format_output
    graph.add_edge("tech_stack", "format_output")
    graph.add_edge("architecture", "format_output")
    graph.add_edge("country_readiness", "format_output")
    graph.add_edge("action_plan", "format_output")

    # Format output ends the graph
    graph.add_edge("format_output", END)

    return graph.compile()


# --- Main Entry Point ---

def run_copilot(
    query: str,
    architecture_context: Optional[str] = None,
    conversation_history: Optional[list] = None,
) -> dict:
    """
    Run a query through the full copilot pipeline.

    Args:
        query: The user's question
        architecture_context: Pasted architecture notes/docs
        conversation_history: Previous conversation messages

    Returns:
        {
            "response": str,
            "agent_used": str,
            "model_used": str,
            "total_time_ms": float,
            "retrieval_source": str,
            "rag_confidence": float,
            "step_log": list,
            "routing_decision": dict,
        }
    """
    graph = build_copilot_graph()

    initial_state = {
        "query": query,
        "architecture_context": architecture_context,
        "conversation_history": conversation_history or [],
        "routing_decision": None,
        "primary_agent": None,
        "secondary_agents": [],
        "extracted_entities": None,
        "needs_clarification": False,
        "clarification_question": None,
        "primary_output": None,
        "secondary_outputs": [],
        "combined_response": None,
        "start_time": time.time(),
        "total_time_ms": 0.0,
        "retrieval_source": None,
        "rag_confidence": 0.0,
        "step_log": [],
    }

    # Run the graph
    result = graph.invoke(initial_state)

    # Handle clarification
    if result.get("needs_clarification"):
        return {
            "response": result.get("clarification_question", "Could you please clarify your question?"),
            "agent_used": "supervisor",
            "model_used": "gpt-4o-mini",
            "total_time_ms": result.get("total_time_ms", 0),
            "retrieval_source": None,
            "rag_confidence": 0.0,
            "step_log": result.get("step_log", []),
            "routing_decision": result.get("routing_decision"),
            "needs_clarification": True,
        }

    primary = result.get("primary_output", {})

    return {
        "response": result.get("combined_response", "No response generated."),
        "agent_used": primary.get("agent", "unknown"),
        "model_used": primary.get("model_used", "unknown"),
        "total_time_ms": result.get("total_time_ms", 0),
        "retrieval_source": result.get("retrieval_source"),
        "rag_confidence": result.get("rag_confidence", 0.0),
        "step_log": result.get("step_log", []),
        "routing_decision": result.get("routing_decision"),
        "needs_clarification": False,
    }
