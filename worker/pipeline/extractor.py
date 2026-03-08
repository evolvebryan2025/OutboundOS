# worker/pipeline/extractor.py
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict

EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
CONTACT_PAGES = ['/contact', '/contact-us', '/about', '/about-us', '/reach-us', '/get-in-touch']
EXCLUDED_DOMAINS = {'example.com', 'sentry.io', 'wixpress.com', 'squarespace.com'}


async def extract_email_from_site(client: httpx.AsyncClient, website: str) -> str | None:
    """Try to find an email on the website homepage and contact pages."""
    urls_to_try = [website] + [website.rstrip('/') + page for page in CONTACT_PAGES]

    for url in urls_to_try:
        try:
            response = await client.get(url, timeout=10, follow_redirects=True)
            emails = EMAIL_PATTERN.findall(response.text)
            for email in emails:
                domain = email.split('@')[1].lower()
                if domain not in EXCLUDED_DOMAINS and not email.endswith(('.png', '.jpg', '.svg')):
                    return email.lower()
        except Exception:
            continue

    return None


async def extract_emails(businesses: List[Dict], concurrency: int = 20) -> List[Dict]:
    """Extract emails from a list of businesses with concurrent requests."""
    results = []
    semaphore = asyncio.Semaphore(concurrency)

    async def process(business: Dict) -> Dict | None:
        async with semaphore:
            async with httpx.AsyncClient(headers={'User-Agent': 'Mozilla/5.0'}) as client:
                email = await extract_email_from_site(client, business['website'])
                if email:
                    return {**business, 'email': email}
                return None

    tasks = [process(b) for b in businesses]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in raw_results:
        if isinstance(result, dict):
            results.append(result)

    # Deduplicate by email
    seen = set()
    unique = []
    for lead in results:
        if lead['email'] not in seen:
            seen.add(lead['email'])
            unique.append(lead)

    return unique
