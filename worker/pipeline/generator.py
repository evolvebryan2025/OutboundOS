# worker/pipeline/generator.py
import os
import json
import anthropic
from typing import Dict, List

client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

SYSTEM_PROMPT = """You are an expert cold email copywriter specializing in local service businesses.
You write concise, high-converting cold email sequences that book calls.

RULES:
- Emails must be under 125 words each
- Subject lines: 4-7 words, lowercase, no "quick question"
- Use the PAS framework (Problem-Agitate-Solve) for service businesses
- CTA escalates across emails (question → soft ask → two time slots → breakup)
- Never sound salesy. Sound like a smart peer, not a vendor.
- Include personalization tokens: {{first_name}}, {{business_name}}, {{city}}

FRAMEWORKS BY NICHE:
- Chiropractors/Dentists: PAS (Problem-Agitate-Solve)
- Gyms/Fitness: BAB (Before-After-Bridge)
- Real Estate: 3Ps (Praise-Picture-Push)
- General: One-Liner (3 sentences max)

SUBJECT LINE RULES:
- 4-7 words, all lowercase
- Personalized when possible ("hi {{first_name}}" style)
- Never use: "Quick question", FREE, GUARANTEED, !!!
- Best performing formula: conversational, curiosity-driven

CTA LADDER:
- Email 1: Ask a question (low friction)
- Email 2: Soft resurface ("worth a quick chat?")
- Email 3: Two time slots ("Tuesday 11am or Thursday 3pm?")
- Email 4: Breakup ("Should I close your file?")
- Email 5: Value-add + calendar link

Return ONLY valid JSON, no explanation."""


def get_sequence_prompt(campaign: Dict) -> str:
    return f"""Write a 5-email cold email sequence for this campaign:

Business Type: {campaign['business_type']}
City: {campaign['city']}
Our Offer: {campaign['offer']}
Their Pain Point: {campaign['pain_point']}
Promised Outcome: {campaign['outcome']}

Return a JSON array of 5 emails:
[{{
  "email_number": 1,
  "send_day": 0,
  "subject_a": "subject line variant A",
  "subject_b": "subject line variant B",
  "body": "email body with {{{{first_name}}}}, {{{{business_name}}}}, {{{{city}}}} tokens",
  "cta": "the specific call to action"
}}]

Email timing: Day 0, Day 3, Day 7, Day 12, Day 16
Email 4 must be a breakup email.
Email 1 CTA: ask a question
Email 2 CTA: soft resurface
Email 3 CTA: two time slots ("Tuesday 11am or Thursday 3pm?")
Email 4 CTA: breakup ("Should I close your file?")
Email 5 CTA: value-add, calendar link"""


async def generate_sequence(campaign: Dict) -> List[Dict]:
    """Generate a 5-email sequence using Claude Sonnet 4.6."""
    message = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{'role': 'user', 'content': get_sequence_prompt(campaign)}],
    )

    text = message.content[0].text.strip()
    # Strip markdown code blocks if present
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]

    return json.loads(text)
