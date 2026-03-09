# worker/analytics/sync.py
"""
Analytics sync worker for Outbound OS.

Polls the Instantly AI /analytics/campaign/summary endpoint for every active
campaign that belongs to a user and upserts the results into the Supabase
campaign_analytics table.

Usage (standalone):
    python -m analytics.sync                # sync all active campaigns once
    python -m analytics.sync --watch 3600   # sync every hour (seconds)

The sync is also triggered via the FastAPI endpoint POST /analytics/sync
defined in worker/main.py so the Next.js frontend can request a refresh.
"""
import asyncio
import os
import logging
from datetime import datetime
from typing import Optional

import httpx
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

INSTANTLY_BASE_URL = "https://api.instantly.ai/api/v1"

_supabase = None

def get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


# ---------------------------------------------------------------------------
# Core sync helpers
# ---------------------------------------------------------------------------

async def fetch_campaign_summary(
    client: httpx.AsyncClient,
    instantly_api_key: str,
    instantly_campaign_id: str,
) -> Optional[dict]:
    """Call Instantly AI analytics/campaign/summary for one campaign."""
    url = f"{INSTANTLY_BASE_URL}/analytics/campaign/summary"
    try:
        resp = await client.get(
            url,
            params={"campaign_id": instantly_campaign_id},
            headers={"Authorization": f"Bearer {instantly_api_key}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Instantly AI returned %s for campaign %s: %s",
            exc.response.status_code,
            instantly_campaign_id,
            exc.response.text[:200],
        )
        return None
    except Exception as exc:
        logger.error("Error fetching analytics for %s: %s", instantly_campaign_id, exc)
        return None


def upsert_analytics(
    campaign_id: str,
    user_id: str,
    stats: dict,
) -> None:
    """Upsert one row into campaign_analytics (keyed on campaign_id)."""
    payload = {
        "campaign_id": campaign_id,
        "user_id": user_id,
        "open_rate": _safe_float(stats.get("open_rate")),
        "reply_rate": _safe_float(stats.get("reply_rate")),
        "bounce_rate": _safe_float(stats.get("bounce_rate")),
        "click_rate": _safe_float(stats.get("click_rate")),
        "positive_reply_rate": _safe_float(stats.get("positive_reply_rate")),
        "emails_sent": int(stats.get("emails_sent") or 0),
        "synced_at": datetime.utcnow().isoformat(),
    }
    get_supabase().table("campaign_analytics").upsert(
        payload, on_conflict="campaign_id"
    ).execute()
    logger.info("Upserted analytics for campaign %s", campaign_id)


def _safe_float(value) -> Optional[float]:
    """Convert a value to float, returning None if not possible."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Main sync routine
# ---------------------------------------------------------------------------

async def sync_all_active_campaigns() -> dict:
    """
    Fetch every active campaign that has an Instantly campaign ID and sync
    its analytics.  Returns a summary dict: {synced, skipped, errors}.
    """
    # Collect every active campaign (we need the Instantly campaign ID + owner)
    campaigns_res = (
        get_supabase().table("campaigns")
        .select("id, user_id, instantly_campaign_id")
        .eq("status", "active")
        .execute()
    )
    campaigns = campaigns_res.data or []

    if not campaigns:
        logger.info("No active campaigns to sync.")
        return {"synced": 0, "skipped": 0, "errors": 0}

    # Build a lookup: user_id → instantly_api_key  (one DB call per unique user)
    user_ids = list({c["user_id"] for c in campaigns})
    profiles_res = (
        get_supabase().table("profiles")
        .select("id, instantly_api_key")
        .in_("id", user_ids)
        .execute()
    )
    api_key_map: dict[str, Optional[str]] = {
        p["id"]: p.get("instantly_api_key") for p in (profiles_res.data or [])
    }

    synced = skipped = errors = 0

    async with httpx.AsyncClient() as http_client:
        for campaign in campaigns:
            instantly_campaign_id = campaign.get("instantly_campaign_id")
            if not instantly_campaign_id:
                skipped += 1
                continue

            api_key = api_key_map.get(campaign["user_id"])
            if not api_key:
                logger.warning(
                    "No Instantly API key for user %s, skipping campaign %s",
                    campaign["user_id"],
                    campaign["id"],
                )
                skipped += 1
                continue

            stats = await fetch_campaign_summary(
                http_client, api_key, instantly_campaign_id
            )
            if stats is None:
                errors += 1
                continue

            try:
                upsert_analytics(campaign["id"], campaign["user_id"], stats)
                synced += 1
            except Exception as exc:
                logger.error(
                    "Failed to upsert analytics for campaign %s: %s",
                    campaign["id"],
                    exc,
                )
                errors += 1

    logger.info("Sync complete — synced=%d skipped=%d errors=%d", synced, skipped, errors)
    return {"synced": synced, "skipped": skipped, "errors": errors}


async def sync_campaign_for_user(user_id: str) -> dict:
    """
    Sync analytics for all active campaigns belonging to a specific user.
    Called from the Next.js API route via the FastAPI endpoint.
    """
    # Get user's Instantly API key
    profile_res = (
        get_supabase().table("profiles")
        .select("instantly_api_key")
        .eq("id", user_id)
        .single()
        .execute()
    )
    profile = profile_res.data or {}
    api_key = profile.get("instantly_api_key")
    if not api_key:
        return {"error": "No Instantly API key configured", "synced": 0}

    # Get active campaigns for this user
    campaigns_res = (
        get_supabase().table("campaigns")
        .select("id, instantly_campaign_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    campaigns = campaigns_res.data or []

    synced = skipped = errors = 0

    async with httpx.AsyncClient() as http_client:
        for campaign in campaigns:
            instantly_campaign_id = campaign.get("instantly_campaign_id")
            if not instantly_campaign_id:
                skipped += 1
                continue

            stats = await fetch_campaign_summary(
                http_client, api_key, instantly_campaign_id
            )
            if stats is None:
                errors += 1
                continue

            try:
                upsert_analytics(campaign["id"], user_id, stats)
                synced += 1
            except Exception as exc:
                logger.error("Upsert failed for campaign %s: %s", campaign["id"], exc)
                errors += 1

    return {"synced": synced, "skipped": skipped, "errors": errors}


# ---------------------------------------------------------------------------
# Watch loop (for running as a background daemon)
# ---------------------------------------------------------------------------

async def watch(interval_seconds: int = 3600) -> None:
    """Poll Instantly AI analytics on a fixed interval."""
    logger.info("Analytics sync daemon started (interval=%ds)", interval_seconds)
    while True:
        try:
            result = await sync_all_active_campaigns()
            logger.info("Sync result: %s", result)
        except Exception as exc:
            logger.error("Unexpected sync error: %s", exc)
        await asyncio.sleep(interval_seconds)


# ---------------------------------------------------------------------------
# CLI entry-point  (python -m analytics.sync [--watch <seconds>])
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Instantly AI analytics sync")
    parser.add_argument(
        "--watch",
        type=int,
        metavar="SECONDS",
        help="Run continuously, syncing every SECONDS seconds (e.g. 3600)",
    )
    args = parser.parse_args()

    if args.watch:
        asyncio.run(watch(args.watch))
    else:
        asyncio.run(sync_all_active_campaigns())
