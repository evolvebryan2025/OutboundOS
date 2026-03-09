# worker/pipeline/verifier.py
import asyncio
import os
import httpx
from typing import List, Dict

REACHER_URL = os.environ.get('REACHER_URL', 'http://localhost:8080') + '/v0/check_email'


async def _reacher_available() -> bool:
    """Check if Reacher service is reachable."""
    try:
        base = os.environ.get('REACHER_URL', 'http://localhost:8080')
        async with httpx.AsyncClient() as client:
            resp = await client.get(base, timeout=5)
            return resp.status_code < 500
    except Exception:
        return False


async def verify_single_email(client: httpx.AsyncClient, lead: Dict) -> Dict | None:
    """Verify a single email using Reacher SMTP check."""
    try:
        response = await client.post(
            REACHER_URL,
            json={'to_email': lead['email']},
            timeout=30,
        )
        result = response.json()

        is_valid = (
            result.get('is_reachable') == 'safe' and
            not result.get('misc', {}).get('is_disposable', False) and
            result.get('smtp', {}).get('can_connect_smtp', False)
        )

        if is_valid:
            return lead
        return None
    except Exception:
        return None


async def verify_emails(leads: List[Dict], concurrency: int = 10) -> List[Dict]:
    """Verify a batch of emails, return only valid ones.
    If Reacher is not available, skip verification and return all leads.
    """
    if not await _reacher_available():
        print('Reacher not available — skipping email verification, passing all leads through.')
        return leads

    semaphore = asyncio.Semaphore(concurrency)
    verified = []

    async def process(lead: Dict) -> Dict | None:
        async with semaphore:
            async with httpx.AsyncClient() as client:
                return await verify_single_email(client, lead)

    tasks = [process(lead) for lead in leads]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, dict):
            verified.append(result)

    return verified
