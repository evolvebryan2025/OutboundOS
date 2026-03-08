# worker/pipeline/scraper.py
import os
from apify_client import ApifyClient
from typing import List, Dict


async def scrape_google_maps(business_type: str, city: str, target_count: int = 1500) -> List[Dict]:
    """Scrape Google Maps for local businesses using Apify."""
    client = ApifyClient(os.environ['APIFY_API_TOKEN'])

    run_input = {
        'searchStringsArray': [f'{business_type} in {city}'],
        'maxCrawledPlacesPerSearch': target_count,
        'language': 'en',
        'outputFields': ['title', 'website', 'phone', 'address', 'url'],
        'skipClosedPlaces': True,
    }

    run = client.actor('compass/crawler-google-places').call(run_input=run_input)

    businesses = []
    for item in client.dataset(run['defaultDatasetId']).iterate_items():
        if item.get('website'):  # Only keep businesses with websites
            businesses.append({
                'name': item.get('title', ''),
                'website': item.get('website', ''),
                'phone': item.get('phone', ''),
                'address': item.get('address', ''),
            })

    return businesses
