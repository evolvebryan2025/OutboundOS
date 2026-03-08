# worker/agent/optimizer.py
"""
Claude Opus 4.6 self-improving optimization agent for Outbound OS.

The agent runs an agentic tool-use loop with adaptive thinking to analyze
cold-email campaign performance and rewrite underperforming emails.  Every
insight it discovers is stored in Supabase's agent_learnings table so the
agent becomes progressively smarter across campaigns and clients.

Self-improvement loop
─────────────────────
Week 1 : Zero data → agent draws on built-in cold-email expertise
Week 2 : First analytics arrive → agent adjusts angles based on open/reply data
Week 4 : Patterns emerge (e.g. pain-led hooks outperform)
Week 8 : Agent knows "Miami chiropractors respond to the missed-calls angle"
Month 3: Acts as a senior copywriter trained on YOUR specific audience

Tools available to the agent
─────────────────────────────
  get_campaign_analytics  — pull open/reply/bounce/call data from Supabase
  get_learnings           — load past insights from the knowledge base
  rewrite_email           — produce improved subject line + body copy
  store_learning          — save a new insight to Supabase (the memory layer)
"""

import json
import logging
import os
from typing import Any

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# ---------------------------------------------------------------------------
# Agent system prompt
# ---------------------------------------------------------------------------

AGENT_SYSTEM = """\
You are an expert cold email optimization agent for Outbound OS.
Your ONLY goal is to increase booked sales calls from cold email campaigns.

You have access to campaign analytics and a growing knowledge base of what
has worked (or failed) in the past.  You analyse performance, identify
underperforming emails, and rewrite them with better angles and copy.

REWRITING RULES
───────────────
• Keep every email under 125 words
• Subject lines: 4–7 words, all lowercase, no punctuation spam
• Best subject formula: "Hi {{first_name}}" or city/pain-point hook
• NEVER use: "Quick question", FREE, GUARANTEED, !!!, or ALL-CAPS words
• Use pain-point angles that match the niche (see frameworks below)
• Escalate the CTA friction across the 5-email sequence:
    Email 1 → "Want me to send it over?"
    Email 2 → "Worth a quick chat?"
    Email 3-4 → "Tuesday 11am or Thursday 3pm?"
    Email 5 → calendar link only
• Always include personalisation tokens: {{first_name}}, {{business_name}}, {{city}}

NICHE FRAMEWORKS
────────────────
Chiropractors / Dentists : PAS  (Problem → Agitate → Solve)
Gyms / Fitness           : BAB  (Before → After → Bridge)
Real Estate              : 3Ps  (Praise → Picture → Push)
General                  : One-Liner (3 sentences max)

PRIMARY METRIC: booked calls — not open rate, not reply rate.

You must call the available tools to complete your analysis and optimisation.
Do NOT produce final text until you have:
  1. Retrieved analytics
  2. Retrieved learnings
  3. Decided which emails need rewriting
  4. Stored any new insights you discovered
"""

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

TOOLS: list[dict] = [
    {
        "name": "get_campaign_analytics",
        "description": (
            "Retrieve the latest performance metrics for a campaign from the "
            "Supabase campaign_analytics table.  Returns open_rate, reply_rate, "
            "bounce_rate, click_rate, positive_reply_rate, emails_sent, "
            "calls_booked and synced_at."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {
                    "type": "string",
                    "description": "UUID of the campaign to inspect",
                }
            },
            "required": ["campaign_id"],
        },
    },
    {
        "name": "get_learnings",
        "description": (
            "Load past insights from the agent_learnings knowledge base, "
            "filtered by niche and optionally by city.  Returns up to 10 "
            "learnings ordered by impact_score (highest first).  Call this "
            "before rewriting to benefit from accumulated knowledge."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "niche": {
                    "type": "string",
                    "description": "Business type / niche (e.g. 'chiropractor')",
                },
                "city": {
                    "type": "string",
                    "description": "Optional city to narrow the search",
                },
            },
            "required": ["niche"],
        },
    },
    {
        "name": "rewrite_email",
        "description": (
            "Queue a rewrite for one email in the sequence.  Provide the "
            "improved subject lines and body copy.  The rewrite is applied to "
            "Supabase after the agent's turn ends."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "email_number": {
                    "type": "integer",
                    "description": "Position in sequence (1-based)",
                },
                "reason": {
                    "type": "string",
                    "description": "Brief explanation of why this email is underperforming",
                },
                "new_subject_a": {
                    "type": "string",
                    "description": "Primary A/B subject line variant",
                },
                "new_subject_b": {
                    "type": "string",
                    "description": "Secondary A/B subject line variant (optional)",
                },
                "new_body": {
                    "type": "string",
                    "description": "Full improved email body (under 125 words)",
                },
            },
            "required": ["email_number", "reason", "new_subject_a", "new_body"],
        },
    },
    {
        "name": "store_learning",
        "description": (
            "Persist a new insight to the agent_learnings knowledge base so "
            "future optimization runs can benefit from it.  Include a numeric "
            "impact_score (0.0–1.0) estimating how significant the insight is."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "insight": {
                    "type": "string",
                    "description": "Clear, actionable insight about what worked or failed",
                },
                "impact_score": {
                    "type": "number",
                    "description": "Estimated impact 0.0 (low) to 1.0 (high), default 0.5",
                },
            },
            "required": ["insight"],
        },
    },
]

# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def _execute_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    campaign: dict,
    rewrites: list[dict],
) -> str:
    """Dispatch a tool call and return a JSON string result."""

    if tool_name == "get_campaign_analytics":
        result = (
            _supabase.table("campaign_analytics")
            .select("*")
            .eq("campaign_id", campaign["id"])
            .execute()
        )
        row = result.data[0] if result.data else {}
        return json.dumps(row)

    if tool_name == "get_learnings":
        query = (
            _supabase.table("agent_learnings")
            .select("*")
            .eq("user_id", campaign["user_id"])
            .eq("niche", tool_input.get("niche", campaign.get("business_type", "")))
            .order("impact_score", desc=True)
            .limit(10)
        )
        city = tool_input.get("city")
        if city:
            query = query.eq("city", city)
        result = query.execute()
        return json.dumps(result.data or [])

    if tool_name == "rewrite_email":
        # Queue the rewrite — applied after the loop completes
        rewrites.append(tool_input)
        logger.info(
            "Rewrite queued for email %d: %s",
            tool_input.get("email_number"),
            tool_input.get("reason", ""),
        )
        return json.dumps(
            {"status": "queued", "email_number": tool_input.get("email_number")}
        )

    if tool_name == "store_learning":
        _supabase.table("agent_learnings").insert(
            {
                "user_id": campaign["user_id"],
                "niche": campaign.get("business_type"),
                "city": campaign.get("city"),
                "insight": tool_input["insight"],
                "impact_score": tool_input.get("impact_score", 0.5),
                "source_campaign_id": campaign["id"],
            }
        ).execute()
        logger.info("Stored learning: %.120s", tool_input["insight"])
        return json.dumps({"status": "stored"})

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


# ---------------------------------------------------------------------------
# Agentic loop
# ---------------------------------------------------------------------------

async def run_optimization_agent(campaign_id: str) -> list[dict]:
    """
    Run the Claude Opus 4.6 optimization agent for one campaign.

    The agent uses adaptive thinking so it can reason carefully about complex
    performance patterns before deciding which emails to rewrite.

    Returns a list of rewrite dicts that were applied to the sequence.
    """
    # ── Fetch campaign and sequence ─────────────────────────────────────────
    campaign_res = (
        _supabase.table("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single()
        .execute()
    )
    campaign: dict = campaign_res.data

    sequence_res = (
        _supabase.table("sequences")
        .select("*")
        .eq("campaign_id", campaign_id)
        .single()
        .execute()
    )
    sequence: dict = sequence_res.data

    current_emails = sequence.get("humanized_emails") or sequence.get("emails") or []

    rewrites: list[dict] = []

    # ── Build initial user message ───────────────────────────────────────────
    messages = [
        {
            "role": "user",
            "content": (
                f"Analyse this campaign and optimise it to book more calls.\n\n"
                f"Campaign  : {campaign['name']}\n"
                f"Niche     : {campaign['business_type']} in {campaign['city']}\n"
                f"Offer     : {campaign['offer']}\n"
                f"Pain point: {campaign['pain_point']}\n\n"
                f"Current sequence:\n"
                f"{json.dumps(current_emails, indent=2)}\n\n"
                f"Your tasks:\n"
                f"1. Call get_campaign_analytics to review performance\n"
                f"2. Call get_learnings to load relevant past insights\n"
                f"3. Identify emails with open_rate < 25% OR reply_rate < 3%\n"
                f"4. Call rewrite_email for each underperforming email\n"
                f"5. Call store_learning for every new pattern you observe\n\n"
                f"Focus entirely on increasing booked calls."
            ),
        }
    ]

    logger.info(
        "Starting optimization agent for campaign %s (%s in %s)",
        campaign_id,
        campaign.get("business_type"),
        campaign.get("city"),
    )

    # ── Agentic loop ─────────────────────────────────────────────────────────
    iteration = 0
    max_iterations = 20  # safety cap

    while iteration < max_iterations:
        iteration += 1
        logger.debug("Agent iteration %d", iteration)

        response = _anthropic.messages.create(
            model="claude-opus-4-6",
            max_tokens=8000,
            thinking={"type": "adaptive"},
            system=AGENT_SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        # Add assistant turn to message history
        messages.append({"role": "assistant", "content": response.content})

        # ── Check stop condition ──────────────────────────────────────────────
        if response.stop_reason == "end_turn":
            logger.info("Agent finished after %d iterations", iteration)
            break

        # ── Handle tool calls ─────────────────────────────────────────────────
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            result_str = _execute_tool(block.name, block.input, campaign, rewrites)

            # Log each tool call to agent_runs
            try:
                _supabase.table("agent_runs").insert(
                    {
                        "campaign_id": campaign_id,
                        "user_id": campaign["user_id"],
                        "action": block.name,
                        "details": block.input,
                    }
                ).execute()
            except Exception as exc:
                logger.warning("Failed to log agent_run: %s", exc)

            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_str,
                }
            )

        if not tool_results:
            # No tool calls but stop_reason wasn't end_turn — break to be safe
            logger.warning("No tool calls in iteration %d, stopping loop", iteration)
            break

        messages.append({"role": "user", "content": tool_results})

    # ── Apply queued rewrites to the sequence ─────────────────────────────────
    if rewrites:
        emails = list(current_emails)
        for rewrite in rewrites:
            idx = rewrite["email_number"] - 1
            if 0 <= idx < len(emails):
                emails[idx] = {
                    **emails[idx],
                    "subject_a": rewrite["new_subject_a"],
                    "subject_b": rewrite.get(
                        "new_subject_b", emails[idx].get("subject_b", "")
                    ),
                    "body": rewrite["new_body"],
                }

        _supabase.table("sequences").update(
            {
                "humanized_emails": emails,
                "version": (sequence.get("version") or 1) + 1,
            }
        ).eq("campaign_id", campaign_id).execute()

        logger.info(
            "Applied %d rewrite(s) to campaign %s (sequence now v%d)",
            len(rewrites),
            campaign_id,
            (sequence.get("version") or 1) + 1,
        )

    return rewrites
