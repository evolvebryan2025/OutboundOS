# worker/main.py
import os
from dotenv import load_dotenv
load_dotenv()  # Must run before any imports that read env vars

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel
import asyncio
import traceback
import httpx as httpx_client
from pipeline.scraper import scrape_google_maps
from pipeline.extractor import extract_emails
from pipeline.verifier import verify_emails
from pipeline.context import generate_campaign_context
from pipeline.generator import generate_sequence
from pipeline.humanizer import humanize_sequence
from pipeline.instantly import push_to_instantly
from analytics.sync import sync_campaign_for_user
from supabase import create_client

app = FastAPI()
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 10
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://outboundos.com')


async def send_notification(notification_type: str, user_email: str, data: dict):
    """Send email notification via the frontend API."""
    try:
        async with httpx_client.AsyncClient() as client:
            await client.post(
                f'{FRONTEND_URL}/api/notifications/send',
                headers={
                    'Content-Type': 'application/json',
                    'x-worker-secret': os.environ['WORKER_SECRET'],
                },
                json={'to': user_email, 'type': notification_type, 'data': data},
                timeout=10,
            )
    except Exception as e:
        print(f'Notification send failed ({notification_type}): {e}')

# Friendly error messages for each pipeline step
STEP_ERROR_MESSAGES = {
    'context': 'Failed to generate campaign context. Please try again.',
    'scraping': 'Google Maps scraping failed. This is usually temporary — try retrying.',
    'extracting': 'Email extraction from websites failed. Some websites may be unreachable.',
    'verifying': 'Email verification service is temporarily unavailable.',
    'generating': 'AI email sequence generation failed. Please retry.',
    'humanizing': 'Email humanization failed. Your campaign will use the original AI-generated emails.',
    'pushing': 'Could not connect to your Instantly account. Please check your API key in Settings.',
}


class PipelineRequest(BaseModel):
    campaign_id: str
    user_id: str


class TestReacherRequest(BaseModel):
    email: str


class ResumeRequest(BaseModel):
    campaign_id: str
    user_id: str


class ApproveRequest(BaseModel):
    campaign_id: str
    user_id: str


def verify_worker_secret(x_worker_secret: str = Header(None)):
    if x_worker_secret != os.environ['WORKER_SECRET']:
        raise HTTPException(status_code=401, detail='Unauthorized')


async def retry_step(step_name: str, func, *args, **kwargs):
    """Retry a pipeline step up to MAX_RETRIES times."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            if attempt == MAX_RETRIES:
                raise
            print(f'Step {step_name} failed (attempt {attempt}/{MAX_RETRIES}): {e}')
            await asyncio.sleep(RETRY_DELAY_SECONDS)


@app.post('/pipeline/start')
async def start_pipeline(
    request: PipelineRequest,
    background_tasks: BackgroundTasks,
    x_worker_secret: str = Header(None),
):
    verify_worker_secret(x_worker_secret)
    background_tasks.add_task(run_pipeline, request.campaign_id, request.user_id)
    return {'status': 'started', 'campaign_id': request.campaign_id}


@app.post('/pipeline/resume')
async def resume_pipeline(
    request: ResumeRequest,
    background_tasks: BackgroundTasks,
    x_worker_secret: str = Header(None),
):
    verify_worker_secret(x_worker_secret)
    result = supabase.table('campaigns').select('failed_at_step').eq('id', request.campaign_id).single().execute()
    failed_step = result.data.get('failed_at_step')
    if not failed_step:
        raise HTTPException(status_code=400, detail='Campaign has no failed step to resume from')
    # Clear error state before retrying
    supabase.table('campaigns').update({
        'status': 'draft',
        'error_message': None,
        'failed_at_step': None,
    }).eq('id', request.campaign_id).execute()
    # Route to the correct handler based on failed step
    if failed_step == 'pushing':
        background_tasks.add_task(run_push_step, request.campaign_id, request.user_id)
    else:
        background_tasks.add_task(run_pipeline, request.campaign_id, request.user_id, resume_from=failed_step)
    return {'status': 'resumed', 'campaign_id': request.campaign_id, 'from_step': failed_step}


@app.post('/pipeline/approve')
async def approve_campaign(
    request: ApproveRequest,
    background_tasks: BackgroundTasks,
    x_worker_secret: str = Header(None),
):
    verify_worker_secret(x_worker_secret)
    print(f'[APPROVE] Received approve for campaign={request.campaign_id} user={request.user_id}', flush=True)
    background_tasks.add_task(run_push_step, request.campaign_id, request.user_id)
    return {'status': 'approved', 'campaign_id': request.campaign_id}


@app.post('/pipeline/test-reacher')
async def test_reacher(
    request: TestReacherRequest,
    x_worker_secret: str = Header(None),
):
    verify_worker_secret(x_worker_secret)

    reacher_url = os.environ.get('REACHER_URL')
    if not reacher_url:
        return {'success': False, 'error': 'REACHER_URL not configured on worker'}

    try:
        async with httpx_client.AsyncClient() as client:
            resp = await client.post(
                f'{reacher_url}/v0/check_email',
                json={'to_email': request.email},
                timeout=30,
            )

            if resp.status_code >= 500:
                return {'success': False, 'error': f'Reacher returned status {resp.status_code}'}

            result = resp.json()

            is_reachable = result.get('is_reachable', 'unknown')
            smtp = result.get('smtp', {})
            misc = result.get('misc', {})
            mx = result.get('mx', {})

            is_valid = (
                is_reachable == 'safe'
                and not misc.get('is_disposable', False)
                and smtp.get('can_connect_smtp', False)
            )

            return {
                'success': True,
                'is_valid': is_valid,
                'details': {
                    'is_reachable': is_reachable,
                    'can_connect_smtp': smtp.get('can_connect_smtp', False),
                    'is_disposable': misc.get('is_disposable', False),
                    'is_role_account': misc.get('is_role_account', False),
                    'has_mx_records': mx.get('accepts_mail', False),
                },
            }
    except httpx_client.TimeoutException:
        return {'success': False, 'error': 'Reacher request timed out (30s)'}
    except Exception as e:
        return {'success': False, 'error': f'Reacher test failed: {str(e)}'}


async def fail_campaign(campaign_id: str, step: str, error: Exception):
    """Mark campaign as failed with a friendly error message."""
    friendly_msg = STEP_ERROR_MESSAGES.get(step, f'An unexpected error occurred during {step}.')
    supabase.table('campaigns').update({
        'status': 'failed',
        'error_message': friendly_msg,
        'failed_at_step': step,
    }).eq('id', campaign_id).execute()
    print(f'Pipeline FAILED at step "{step}" for campaign {campaign_id}: {error}', flush=True)
    print(traceback.format_exc())

    # Send failure notification
    try:
        campaign_result = supabase.table('campaigns').select('user_id, name').eq('id', campaign_id).single().execute()
        if campaign_result.data:
            profile_result = supabase.table('profiles').select('email').eq('id', campaign_result.data['user_id']).single().execute()
            if profile_result.data:
                await send_notification('failed', profile_result.data['email'], {
                    'campaignName': campaign_result.data['name'],
                    'campaignId': campaign_id,
                    'errorMessage': friendly_msg,
                })
    except Exception as notify_err:
        print(f'Failed to send failure notification: {notify_err}')


async def run_pipeline(campaign_id: str, user_id: str, resume_from: str = None):
    """Main pipeline: context → scrape → extract → verify → generate → humanize → PAUSE for review"""
    try:
        result = supabase.table('campaigns').select('*').eq('id', campaign_id).single().execute()
        campaign = result.data
        profile_result = supabase.table('profiles').select('*').eq('id', user_id).single().execute()
        profile = profile_result.data

        steps_order = ['context', 'scraping', 'extracting', 'verifying', 'generating', 'humanizing']
        start_index = 0
        if resume_from and resume_from in steps_order:
            start_index = steps_order.index(resume_from)

        # --- Step 0: Generate context (pain_point + outcome) if missing ---
        if start_index <= 0 and (not campaign.get('pain_point') or not campaign.get('outcome')):
            try:
                context = await retry_step('context', generate_campaign_context,
                    campaign['business_type'], campaign['city'], campaign['offer'])
                supabase.table('campaigns').update({
                    'pain_point': context['pain_point'],
                    'outcome': context['outcome'],
                }).eq('id', campaign_id).execute()
                campaign['pain_point'] = context['pain_point']
                campaign['outcome'] = context['outcome']
            except Exception as e:
                await fail_campaign(campaign_id, 'context', e)
                return

        # --- Steps 1-3: Scrape/Extract/Verify (skip if BYOL) ---
        is_byol = campaign.get('lead_source') == 'uploaded'

        if not is_byol and start_index <= 1:
            try:
                await update_status(campaign_id, 'scraping')
                businesses = await retry_step('scraping', scrape_google_maps,
                    business_type=campaign['business_type'],
                    city=campaign['city'],
                    target_count=1500)
                supabase.table('campaigns').update({'leads_scraped': len(businesses)}).eq('id', campaign_id).execute()
            except Exception as e:
                await fail_campaign(campaign_id, 'scraping', e)
                return

            try:
                leads_with_emails = await retry_step('extracting', extract_emails, businesses)
            except Exception as e:
                await fail_campaign(campaign_id, 'extracting', e)
                return

            try:
                verified_leads = await retry_step('verifying', verify_emails, leads_with_emails)
                verified_leads = verified_leads[:1000]
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
                if leads_to_insert:
                    supabase.table('leads').insert(leads_to_insert).execute()
                supabase.table('campaigns').update({'leads_verified': len(verified_leads)}).eq('id', campaign_id).execute()
            except Exception as e:
                await fail_campaign(campaign_id, 'verifying', e)
                return

        elif is_byol and start_index <= 2:
            # BYOL: verify uploaded leads only
            try:
                await update_status(campaign_id, 'scraping')
                leads_result = supabase.table('leads').select('*').eq('campaign_id', campaign_id).eq('verified', False).execute()
                unverified = [{'email': l['email'], 'name': l['business_name'], 'phone': l.get('phone'), 'website': l.get('website')} for l in leads_result.data]
                if unverified:
                    verified_leads = await retry_step('verifying', verify_emails, unverified)
                    verified_emails = {l['email'] for l in verified_leads}
                    for lead in leads_result.data:
                        is_verified = lead['email'] in verified_emails
                        supabase.table('leads').update({'verified': is_verified}).eq('id', lead['id']).execute()
                    supabase.table('campaigns').update({
                        'leads_scraped': len(leads_result.data),
                        'leads_verified': len(verified_leads),
                    }).eq('id', campaign_id).execute()
            except Exception as e:
                await fail_campaign(campaign_id, 'verifying', e)
                return

        # --- Step 4: Generate sequence ---
        if start_index <= 4:
            try:
                await update_status(campaign_id, 'generating')
                sequence = await retry_step('generating', generate_sequence, campaign)
                supabase.table('sequences').upsert({
                    'campaign_id': campaign_id,
                    'user_id': user_id,
                    'emails': sequence,
                }, on_conflict='campaign_id').execute()
            except Exception as e:
                await fail_campaign(campaign_id, 'generating', e)
                return

        # --- Step 5: Humanize (optional) ---
        if start_index <= 5:
            if campaign.get('humanize_enabled') and profile.get('stealth_gpt_api_key'):
                try:
                    await update_status(campaign_id, 'humanizing')
                    seq_result = supabase.table('sequences').select('emails').eq('campaign_id', campaign_id).single().execute()
                    current_sequence = seq_result.data['emails']
                    humanized = await retry_step('humanizing', humanize_sequence, current_sequence, profile['stealth_gpt_api_key'])
                    supabase.table('sequences').update({'humanized_emails': humanized}).eq('campaign_id', campaign_id).execute()
                except Exception as e:
                    # Humanization failure is non-blocking — log but continue
                    print(f'Humanization failed (non-blocking): {e}')

        # --- PAUSE: Set status to "review" so client can preview emails ---
        await update_status(campaign_id, 'review')

        # Send "ready for review" notification
        await send_notification('review', profile['email'], {
            'campaignName': campaign['name'],
            'campaignId': campaign_id,
        })

    except Exception as e:
        await fail_campaign(campaign_id, 'unknown', e)


async def run_push_step(campaign_id: str, user_id: str):
    """Step 6: Push approved emails to Instantly AI."""
    import sys
    try:
        print(f'[PUSH] === Starting push for campaign {campaign_id}, user {user_id} ===', flush=True)
        sys.stdout.flush()

        result = supabase.table('campaigns').select('*').eq('id', campaign_id).single().execute()
        campaign = result.data
        print(f'[PUSH] Campaign loaded: {campaign["name"]} (status={campaign["status"]})', flush=True)

        profile_result = supabase.table('profiles').select('*').eq('id', user_id).single().execute()
        profile = profile_result.data
        has_key = bool(profile.get('instantly_api_key'))
        print(f'[PUSH] Profile loaded: {profile["email"]}, has_instantly_key={has_key}', flush=True)

        if not has_key:
            print('[PUSH] ERROR: No Instantly API key found in profile!', flush=True)
            await fail_campaign(campaign_id, 'pushing', Exception('No Instantly API key configured. Please add it in Settings.'))
            return

        await update_status(campaign_id, 'pushing')
        print('[PUSH] Status set to pushing', flush=True)

        # Get the final sequence (humanized if available, otherwise original)
        seq_result = supabase.table('sequences').select('*').eq('campaign_id', campaign_id).single().execute()
        if not seq_result.data:
            print('[PUSH] ERROR: No sequence found for campaign!', flush=True)
            await fail_campaign(campaign_id, 'pushing', Exception('No email sequence found for this campaign'))
            return
        final_sequence = seq_result.data.get('humanized_emails') or seq_result.data['emails']
        print(f'[PUSH] Sequence has {len(final_sequence)} emails', flush=True)

        # Get verified leads
        leads_result = supabase.table('leads').select('*').eq('campaign_id', campaign_id).eq('verified', True).execute()
        verified_leads = leads_result.data
        print(f'[PUSH] Found {len(verified_leads)} verified leads', flush=True)

        if not verified_leads:
            print('[PUSH] WARNING: No verified leads found, cannot push to Instantly', flush=True)
            await fail_campaign(campaign_id, 'pushing', Exception('No verified leads found for this campaign'))
            return

        print(f'[PUSH] Calling Instantly API with key ending in ...{profile["instantly_api_key"][-4:]}', flush=True)
        instantly_campaign_id = await retry_step('pushing', push_to_instantly,
            api_key=profile['instantly_api_key'],
            campaign_name=campaign['name'],
            leads=verified_leads,
            sequence=final_sequence,
            sending_accounts=campaign.get('sending_accounts', []),
        )
        print(f'[PUSH] Instantly campaign created: {instantly_campaign_id}', flush=True)

        supabase.table('campaigns').update({
            'status': 'active',
            'instantly_campaign_id': instantly_campaign_id,
            'leads_pushed': len(verified_leads),
        }).eq('id', campaign_id).execute()

        # Decrement credits (non-blocking if function doesn't exist)
        try:
            supabase.rpc('decrement_credits', {'user_id': user_id, 'amount': len(verified_leads)}).execute()
        except Exception as credit_err:
            print(f'[PUSH] Credit decrement failed (non-blocking): {credit_err}')

        # Send "campaign live" notification
        await send_notification('live', profile['email'], {
            'campaignName': campaign['name'],
            'campaignId': campaign_id,
            'leadsCount': len(verified_leads),
        })

        # Check for low credits
        profile_after = supabase.table('profiles').select('credits_remaining, email').eq('id', user_id).single().execute()
        if profile_after.data['credits_remaining'] < 500:
            await send_notification('low_credits', profile_after.data['email'], {
                'creditsRemaining': profile_after.data['credits_remaining'],
            })

    except Exception as e:
        print(f'[PUSH] EXCEPTION in run_push_step: {type(e).__name__}: {e}', flush=True)
        import traceback
        traceback.print_exc()
        await fail_campaign(campaign_id, 'pushing', e)


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
