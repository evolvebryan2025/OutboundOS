# worker/pipeline/humanizer.py
import httpx
from typing import Dict, List

STEALTHGPT_API_URL = 'https://stealthgpt.ai/api/stealthify'


async def humanize_email(client: httpx.AsyncClient, text: str, api_key: str) -> str:
    """Humanize a single email body using StealthGPT API.

    Falls back gracefully to the original text if the API call fails,
    so the pipeline never blocks on humanization errors.
    """
    try:
        response = await client.post(
            STEALTHGPT_API_URL,
            headers={'api-token': api_key, 'Content-Type': 'application/json'},
            json={'content': text, 'mode': 'standard', 'business': True},
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
        return result.get('paraphrased', text)  # Fallback to original if key missing
    except Exception:
        return text  # Always fallback gracefully


async def humanize_sequence(sequence: List[Dict], stealth_gpt_api_key: str) -> List[Dict]:
    """Humanize all email bodies in a sequence.

    Processes emails sequentially to respect StealthGPT rate limits.
    Returns a new list with humanized bodies; subjects and metadata are untouched.
    """
    humanized = []
    async with httpx.AsyncClient() as client:
        for email in sequence:
            humanized_body = await humanize_email(client, email['body'], stealth_gpt_api_key)
            humanized.append({**email, 'body': humanized_body})
    return humanized
