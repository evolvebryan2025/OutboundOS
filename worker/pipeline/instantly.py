# worker/pipeline/instantly.py
import httpx
from typing import Dict, List

INSTANTLY_API = 'https://api.instantly.ai/api/v1'
LEADS_BATCH_SIZE = 100


async def push_to_instantly(
    api_key: str,
    campaign_name: str,
    leads: List[Dict],
    sequence: List[Dict],
) -> str:
    """Push verified leads and email sequence to Instantly AI via REST API.

    Steps:
      1. Create a new campaign
      2. Add 5-email sequence steps (one POST per email)
      3. Batch-add leads in chunks of 100
      4. Launch the campaign

    Returns the Instantly campaign ID.
    """
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

    async with httpx.AsyncClient() as client:
        # 1. Create campaign
        campaign_res = await client.post(
            f'{INSTANTLY_API}/campaign/create',
            headers=headers,
            json={'name': campaign_name, 'daily_limit': 50},
            timeout=30,
        )
        campaign_res.raise_for_status()
        campaign_id = campaign_res.json()['id']

        # 2. Add email sequence steps (one per email in the sequence)
        for email in sequence:
            await client.post(
                f'{INSTANTLY_API}/campaign/subsequence',
                headers=headers,
                json={
                    'campaign_id': campaign_id,
                    'subsequence': {
                        'delay': email['send_day'],
                        'type': 'email',
                        'subject': email['subject_a'],
                        'body': email['body'],
                    },
                },
                timeout=30,
            )

        # 3. Add leads in batches of 100
        for i in range(0, len(leads), LEADS_BATCH_SIZE):
            batch = leads[i:i + LEADS_BATCH_SIZE]
            leads_payload = [
                {
                    'email': lead['email'],
                    'first_name': (lead.get('owner_name') or '').split()[0],
                    'company_name': lead['business_name'],
                    'city': lead.get('city', ''),
                }
                for lead in batch
            ]
            await client.post(
                f'{INSTANTLY_API}/lead/add',
                headers=headers,
                json={
                    'campaign_id': campaign_id,
                    'leads': leads_payload,
                    'skip_if_in_workspace': True,
                },
                timeout=60,
            )

        # 4. Launch campaign
        await client.post(
            f'{INSTANTLY_API}/campaign/launch',
            headers=headers,
            json={'campaign_id': campaign_id},
            timeout=30,
        )

    return campaign_id
