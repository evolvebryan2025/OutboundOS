# worker/pipeline/context.py
import os
import json
import anthropic


def _get_client():
    return anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])


async def generate_campaign_context(business_type: str, city: str, offer: str) -> dict:
    """Generate pain_point and outcome from business_type + city + offer using Claude."""
    client = _get_client()
    message = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=500,
        system="You are a B2B sales strategist. Given a business type, city, and offer, generate a specific pain point and outcome. Return ONLY valid JSON.",
        messages=[{
            'role': 'user',
            'content': f"""Business Type: {business_type}
City: {city}
Offer: {offer}

Return JSON:
{{
  "pain_point": "A specific, relatable pain point these businesses face (1 sentence)",
  "outcome": "A compelling, measurable outcome the offer delivers (1 sentence)"
}}"""
        }],
    )
    text = message.content[0].text.strip()
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text)
