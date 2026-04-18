"""
Conversation Summary Memory.
Uses ConversationSummaryMemory pattern from LangChain to maintain
a running summary of the conversation instead of storing full history.

Why ConversationSummaryMemory over other memory types:
- BufferMemory: stores full history, gets expensive with long conversations
- BufferWindowMemory: loses old context entirely
- SummaryMemory: compresses conversation into a running summary,
  preserving key decisions and context while staying token-efficient

This was shown to outperform other memory types in dynamic scenarios
(Beer Game simulation) because it encourages pattern-based reasoning
rather than arithmetic averaging.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from config.llm_config import get_supervisor_llm


class ConversationSummaryMemory:
    """Maintains a running summary of the conversation."""

    def __init__(self):
        self.summary = ""
        self.turn_count = 0
        self.llm = get_supervisor_llm()

    def add_exchange(self, user_query: str, assistant_response: str):
        """Add a new exchange and update the running summary."""
        self.turn_count += 1

        # Update summary every 2 turns to balance cost and context
        if self.turn_count % 2 == 0 and self.turn_count > 0:
            self._update_summary(user_query, assistant_response)
        else:
            # Between summary updates, append a brief note
            brief = f"Turn {self.turn_count}: User asked about {user_query[:80]}..."
            self.summary += f"\n{brief}"

    def _update_summary(self, latest_query: str, latest_response: str):
        """Use LLM to compress conversation history into a summary."""
        try:
            messages = [
                SystemMessage(content="""You are a conversation summarizer. Given the existing conversation summary and the latest exchange, produce an updated summary that captures:
- Key topics discussed
- Important decisions or findings
- Countries/technologies/regulations mentioned
- Any unresolved questions

Keep the summary under 200 words. Be factual and concise. Return ONLY the summary text."""),
                HumanMessage(content=f"""Existing summary:
{self.summary if self.summary else '(No previous conversation)'}

Latest exchange:
User: {latest_query[:300]}
Assistant: {latest_response[:500]}

Updated summary:""")
            ]
            result = self.llm.invoke(messages)
            self.summary = result.content.strip()
        except Exception:
            # If summarization fails, keep the existing summary
            pass

    def get_context(self) -> str:
        """Return the current conversation summary for use in prompts."""
        if not self.summary:
            return ""
        return f"Conversation context so far:\n{self.summary}"

    def clear(self):
        """Reset the memory."""
        self.summary = ""
        self.turn_count = 0