# worker/pipeline/instantly.py
import httpx
from typing import Dict, List, Optional

INSTANTLY_API = 'https://api.instantly.ai/api/v1'
LEADS_BATCH_SIZE = 100


async def push_to_instantly(
    api_key: str,
    campaign_name: str,
    leads: List[Dict],
    sequence: List[Dict],
    sending_accounts: Optional[List[str]] = None,
) -> str:
    """Push verified leads and email sequence to Instantly AI via REST API."""
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

    async with httpx.AsyncClient() as client:
        # 1. Create campaign
        campaign_payload = {'name': campaign_name, 'daily_limit': 50}
        campaign_res = await client.post(
            f'{INSTANTLY_API}/campaign/create',
            headers=headers,
            json=campaign_payload,
            timeout=30,
        )
        campaign_res.raise_for_status()
        campaign_id = campaign_res.json()['id']

        # 1b. Assign sending accounts if specified
        if sending_accounts:
            await client.post(
                f'{INSTANTLY_API}/campaign/accounts/add',
                headers=headers,
                json={'campaign_id': campaign_id, 'account_ids': sending_accounts},
                timeout=30,
            )

        # 2. Add email sequence steps
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

        # 3. Add leads in batches
        for i in range(0, len(leads), LEADS_BATCH_SIZE):
            batch = leads[i:i + LEADS_BATCH_SIZE]
            leads_payload = [
                {
                    'email': lead['email'],
                    'first_name': (lead.get('owner_name') or lead.get('business_name', '')).split()[0],
                    'company_name': lead.get('business_name', ''),
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
