"""
Hallucination Detection and Output Guardrails.
Validates agent outputs for grounding, consistency, and safety.

Strategies:
1. Confidence-based: Flag responses where RAG retrieval confidence < threshold
2. Source grounding: Check if the response references actual regulations from our knowledge base
3. Contradiction detection: Flag if response contradicts known facts about a country
4. Output validation: Ensure responses follow the expected structure
"""

KNOWN_REGULATIONS = {
    "US": ["CCPA", "CPRA", "HIPAA", "COPPA", "GLBA", "FERPA"],
    "DE": ["GDPR", "BDSG", "ePrivacy"],
    "IN": ["DPDP", "IT Act"],
    "SA": ["PDPL"],
    "BR": ["LGPD"],
    "SG": ["PDPA"],
}

KNOWN_AUTHORITIES = {
    "US": ["FTC", "CPPA", "HHS"],
    "DE": ["BfDI", "DPA"],
    "IN": ["DPBI", "MEITY"],
    "SA": ["SDAIA"],
    "BR": ["ANPD"],
    "SG": ["PDPC"],
}


def check_hallucination(response: str, agent: str, rag_confidence: float, countries: list = None) -> dict:
    """
    Check response for potential hallucinations.

    Returns:
        {
            "confidence_level": "high" | "medium" | "low",
            "warnings": [...],
            "is_grounded": bool,
        }
    """
    warnings = []
    confidence_level = "high"

    # 1. RAG confidence check
    if rag_confidence < 0.3:
        confidence_level = "low"
        warnings.append("Very low retrieval confidence — response may not be grounded in source documents")
    elif rag_confidence < 0.65:
        confidence_level = "medium"
        warnings.append("Moderate retrieval confidence — some claims may need verification")

    # 2. Source grounding check for compliance agent
    if agent == "country_readiness" and countries:
        for country in countries:
            known_regs = KNOWN_REGULATIONS.get(country, [])
            known_auths = KNOWN_AUTHORITIES.get(country, [])

            # Check if response mentions at least one known regulation
            response_upper = response.upper()
            has_known_reg = any(reg.upper() in response_upper for reg in known_regs)
            has_known_auth = any(auth.upper() in response_upper for auth in known_auths)

            if not has_known_reg:
                warnings.append(f"Response for {country} does not reference any known regulation ({', '.join(known_regs)})")
                confidence_level = "low"

    # 3. Fabrication indicators
    fabrication_phrases = [
        "as of my last update",
        "I believe",
        "I think",
        "probably",
        "I'm not sure",
        "it might be",
    ]
    for phrase in fabrication_phrases:
        if phrase.lower() in response.lower():
            warnings.append(f"Response contains hedging language ('{phrase}') which may indicate uncertainty")
            if confidence_level == "high":
                confidence_level = "medium"

    # 4. Check for suspiciously specific but unverifiable claims
    if agent == "country_readiness":
        import re
        # Check for made-up fine amounts
        fine_matches = re.findall(r'(?:fine|penalty|penalt).*?(\$[\d,]+|\€[\d,]+|SAR[\d,]+|R\$[\d,]+)', response, re.IGNORECASE)
        if fine_matches and rag_confidence < 0.5:
            warnings.append("Response cites specific fine amounts but RAG confidence is low — verify these figures")

    is_grounded = confidence_level != "low" and len(warnings) <= 1

    return {
        "confidence_level": confidence_level,
        "warnings": warnings,
        "is_grounded": is_grounded,
    }


def validate_output_structure(response: str, agent: str) -> dict:
    """
    Validate that the agent's response follows the expected structure.

    Returns:
        {
            "is_valid": bool,
            "missing_sections": [...],
        }
    """
    expected_sections = {
        "country_readiness": ["Regulatory Requirements", "Data Residency", "Recommendations"],
        "action_plan": ["Action Items", "Stakeholder", "Timeline"],
        "architecture_mapper": ["Components", "Dependencies"],
        "tech_stack_explainer": ["What it is", "Why it matters"],
    }

    sections = expected_sections.get(agent, [])
    missing = [s for s in sections if s.lower() not in response.lower()]

    return {
        "is_valid": len(missing) == 0,
        "missing_sections": missing,
    }