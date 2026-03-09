# worker/pipeline/instantly.py
import httpx
from typing import Dict, List, Optional

INSTANTLY_API = 'https://api.instantly.ai/api/v2'


async def push_to_instantly(
    api_key: str,
    campaign_name: str,
    leads: List[Dict],
    sequence: List[Dict],
    sending_accounts: Optional[List[str]] = None,
) -> str:
    """Push verified leads and email sequence to Instantly AI via REST API v2."""
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

    async with httpx.AsyncClient() as client:
        # 1. Create campaign with email sequence included
        print(f'[INSTANTLY] Creating campaign: {campaign_name}', flush=True)

        # Build sequence steps from our email data
        steps = []
        for email in sequence:
            step = {
                'type': 'email',
                'delay': email.get('send_day', 1),
                'variants': [
                    {
                        'subject': email['subject_a'],
                        'body': email['body'],
                    },
                ],
            }
            # Add B variant if present
            if email.get('subject_b') and email['subject_b'] != email['subject_a']:
                step['variants'].append({
                    'subject': email['subject_b'],
                    'body': email['body'],
                })
            steps.append(step)

        campaign_payload = {
            'name': campaign_name,
            'campaign_schedule': {
                'schedules': [{
                    'name': 'Default Schedule',
                    'timing': {'from': '09:00', 'to': '17:00'},
                    'days': {'0': False, '1': True, '2': True, '3': True, '4': True, '5': True, '6': False},
                    'timezone': 'Etc/GMT+5',
                }],
            },
            'sequences': [{'steps': steps}],
            'daily_limit': 50,
            'stop_on_reply': True,
            'link_tracking': True,
            'open_tracking': True,
            'text_only': False,
        }

        # Assign sending accounts if specified
        if sending_accounts:
            campaign_payload['email_list'] = sending_accounts

        campaign_res = await client.post(
            f'{INSTANTLY_API}/campaigns',
            headers=headers,
            json=campaign_payload,
            timeout=30,
        )
        print(f'[INSTANTLY] Create response: {campaign_res.status_code} {campaign_res.text[:500]}', flush=True)
        campaign_res.raise_for_status()
        campaign_id = campaign_res.json()['id']
        print(f'[INSTANTLY] Campaign ID: {campaign_id}', flush=True)

        # 2. Add leads one by one (v2 API creates leads individually)
        print(f'[INSTANTLY] Adding {len(leads)} leads', flush=True)
        added = 0
        for lead in leads:
            first_name = (lead.get('owner_name') or lead.get('business_name', '')).split()[0] if (lead.get('owner_name') or lead.get('business_name')) else ''
            lead_payload = {
                'email': lead['email'],
                'first_name': first_name,
                'company_name': lead.get('business_name', ''),
                'campaign': campaign_id,
            }
            try:
                lead_res = await client.post(
                    f'{INSTANTLY_API}/leads',
                    headers=headers,
                    json=lead_payload,
                    timeout=30,
                )
                if lead_res.status_code < 400:
                    added += 1
                else:
                    print(f'[INSTANTLY] Lead add failed ({lead["email"]}): {lead_res.status_code} {lead_res.text[:200]}', flush=True)
            except Exception as e:
                print(f'[INSTANTLY] Lead add error ({lead["email"]}): {e}', flush=True)

        print(f'[INSTANTLY] Added {added}/{len(leads)} leads', flush=True)

        # 3. Activate campaign
        print(f'[INSTANTLY] Activating campaign {campaign_id}', flush=True)
        activate_res = await client.post(
            f'{INSTANTLY_API}/campaigns/{campaign_id}/activate',
            headers=headers,
            json={},
            timeout=30,
        )
        print(f'[INSTANTLY] Activate response: {activate_res.status_code} {activate_res.text[:200]}', flush=True)
        activate_res.raise_for_status()

    return campaign_id
