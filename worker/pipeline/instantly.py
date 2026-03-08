# worker/pipeline/instantly.py
# Stub — Instantly AI push (Task 13)
from typing import Dict, List


async def push_to_instantly(
    api_key: str,
    campaign_name: str,
    leads: List[Dict],
    sequence: List[Dict],
) -> str:
    """Push verified leads and email sequence to Instantly AI via REST API.

    Implementation in Task 13 (Instantly AI integration).
    Returns the Instantly campaign ID.
    """
    raise NotImplementedError("push_to_instantly() will be implemented in Task 13")
