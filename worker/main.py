# worker/main.py
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import os
from dotenv import load_dotenv
from pipeline.scraper import scrape_google_maps
from pipeline.extractor import extract_emails
from pipeline.verifier import verify_emails
from pipeline.generator import generate_sequence
from pipeline.humanizer import humanize_sequence
from pipeline.instantly import push_to_instantly
from analytics.sync import sync_campaign_for_user
from supabase import create_client

load_dotenv()
app = FastAPI()
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])


class PipelineRequest(BaseModel):
    campaign_id: str
    user_id: str


def verify_worker_secret(x_worker_secret: str = Header(None)):
    if x_worker_secret != os.environ['WORKER_SECRET']:
        raise HTTPException(status_code=401, detail='Unauthorized')


@app.post('/pipeline/start')
async def start_pipeline(
    request: PipelineRequest,
    background_tasks: BackgroundTasks,
    x_worker_secret: str = Header(None)
):
    verify_worker_secret(x_worker_secret)
    background_tasks.add_task(run_pipeline, request.campaign_id, request.user_id)
    return {'status': 'started', 'campaign_id': request.campaign_id}


async def run_pipeline(campaign_id: str, user_id: str):
    """Main pipeline: scrape → extract → verify → generate → humanize → push"""
    try:
        # Fetch campaign details
        result = supabase.table('campaigns').select('*').eq('id', campaign_id).single().execute()
        campaign = result.data

        # Fetch user profile (for API keys)
        profile_result = supabase.table('profiles').select('*').eq('id', user_id).single().execute()
        profile = profile_result.data

        await update_status(campaign_id, 'scraping')

        # Step 1: Scrape Google Maps
        businesses = await scrape_google_maps(
            business_type=campaign['business_type'],
            city=campaign['city'],
            target_count=1500
        )
        supabase.table('campaigns').update({'leads_scraped': len(businesses)}).eq('id', campaign_id).execute()

        await update_status(campaign_id, 'scraping')

        # Step 2: Extract emails from websites
        leads_with_emails = await extract_emails(businesses)

        # Step 3: Verify emails
        await update_status(campaign_id, 'scraping')
        verified_leads = await verify_emails(leads_with_emails)
        verified_leads = verified_leads[:1000]  # Cap at 1,000

        # Save leads to Supabase
        leads_to_insert = [{
            'campaign_id': campaign_id,
            'user_id': user_id,
            'business_name': lead['name'],
            'email': lead['email'],
            'phone': lead.get('phone'),
            'website': lead.get('website'),
            'city': campaign['city'],
            'niche': campaign['business_type'],
            'verified': True,
        } for lead in verified_leads]
        supabase.table('leads').insert(leads_to_insert).execute()
        supabase.table('campaigns').update({'leads_verified': len(verified_leads)}).eq('id', campaign_id).execute()

        # Step 4: Generate sequence
        await update_status(campaign_id, 'generating')
        sequence = await generate_sequence(campaign)
        supabase.table('sequences').insert({
            'campaign_id': campaign_id,
            'user_id': user_id,
            'emails': sequence,
        }).execute()

        # Step 5: Humanize (if enabled and API key provided)
        if campaign.get('humanize_enabled') and profile.get('stealth_gpt_api_key'):
            await update_status(campaign_id, 'humanizing')
            humanized = await humanize_sequence(sequence, profile['stealth_gpt_api_key'])
            supabase.table('sequences').update({'humanized_emails': humanized}).eq('campaign_id', campaign_id).execute()
            final_sequence = humanized
        else:
            final_sequence = sequence

        # Step 6: Push to Instantly AI
        await update_status(campaign_id, 'pushing')
        instantly_campaign_id = await push_to_instantly(
            api_key=profile['instantly_api_key'],
            campaign_name=campaign['name'],
            leads=verified_leads,
            sequence=final_sequence,
        )

        supabase.table('campaigns').update({
            'status': 'active',
            'instantly_campaign_id': instantly_campaign_id,
            'leads_pushed': len(verified_leads),
        }).eq('id', campaign_id).execute()

        # Deduct credits from user
        supabase.rpc('decrement_credits', {'user_id': user_id, 'amount': len(verified_leads)}).execute()

    except Exception as e:
        supabase.table('campaigns').update({'status': 'draft'}).eq('id', campaign_id).execute()
        print(f'Pipeline error for campaign {campaign_id}: {e}')
        raise


async def update_status(campaign_id: str, status: str):
    supabase.table('campaigns').update({'status': status}).eq('id', campaign_id).execute()


# ---------------------------------------------------------------------------
# Analytics sync endpoint (called by Next.js frontend)
# ---------------------------------------------------------------------------

class AnalyticsSyncRequest(BaseModel):
    user_id: str


@app.post('/analytics/sync')
async def analytics_sync(
    request: AnalyticsSyncRequest,
    x_worker_secret: str = Header(None),
):
    verify_worker_secret(x_worker_secret)
    result = await sync_campaign_for_user(request.user_id)
    return result
