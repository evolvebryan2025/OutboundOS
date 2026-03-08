# worker/agent/scheduler.py
"""
Scheduler that runs the Claude Opus optimization agent every 3 days
for each active campaign.

Execution modes
───────────────
  python agent/scheduler.py            # run the scheduler loop (default)
  python agent/scheduler.py --once     # run one pass then exit (useful for cron)
  python agent/scheduler.py --campaign <uuid>  # run agent for a single campaign

The scheduler is started automatically by the systemd service defined in
deploy/outbound-os-worker.service.  The FastAPI app (main.py) does NOT start
it — it runs as a completely separate process so a long-running agent task
never blocks the API.
"""

import argparse
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

from agent.optimizer import run_optimization_agent

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [scheduler] %(message)s",
)
logger = logging.getLogger(__name__)

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# How many days between optimization runs per campaign
OPTIMIZATION_INTERVAL_DAYS = int(os.environ.get("OPTIMIZATION_INTERVAL_DAYS", "3"))

# How often the scheduler wakes up to check (seconds)
SCHEDULER_POLL_SECONDS = int(os.environ.get("SCHEDULER_POLL_SECONDS", "3600"))


# ---------------------------------------------------------------------------
# Core scheduling logic
# ---------------------------------------------------------------------------

def _campaigns_due_for_optimization() -> list[dict]:
    """
    Return active campaigns whose last optimization run was more than
    OPTIMIZATION_INTERVAL_DAYS ago (or has never been run).
    """
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=OPTIMIZATION_INTERVAL_DAYS)
    ).isoformat()

    # We use updated_at as a proxy for last optimization timestamp.
    # The sequence table version is incremented on each rewrite, but
    # updated_at on the campaign row is simpler to query here.
    result = (
        _supabase.table("campaigns")
        .select("id, name, business_type, city, user_id, updated_at")
        .eq("status", "active")
        .lt("updated_at", cutoff)
        .execute()
    )
    return result.data or []


async def run_one_pass() -> None:
    """Find all campaigns due for optimization and run the agent on each."""
    campaigns = _campaigns_due_for_optimization()

    if not campaigns:
        logger.info("No campaigns due for optimization.")
        return

    logger.info("%d campaign(s) due for optimization.", len(campaigns))

    for campaign in campaigns:
        campaign_id = campaign["id"]
        logger.info(
            "Optimizing campaign %s — %s in %s",
            campaign_id,
            campaign.get("business_type"),
            campaign.get("city"),
        )
        try:
            rewrites = await run_optimization_agent(campaign_id)
            logger.info(
                "Campaign %s optimized: %d rewrite(s) applied.", campaign_id, len(rewrites)
            )
        except Exception as exc:
            logger.error("Failed to optimize campaign %s: %s", campaign_id, exc)


async def run_loop() -> None:
    """Continuously poll for campaigns due for optimization."""
    logger.info(
        "Optimization scheduler started — interval=%d days, poll=%ds",
        OPTIMIZATION_INTERVAL_DAYS,
        SCHEDULER_POLL_SECONDS,
    )
    while True:
        try:
            await run_one_pass()
        except Exception as exc:
            logger.error("Unexpected scheduler error: %s", exc)
        logger.info(
            "Next check in %d seconds.", SCHEDULER_POLL_SECONDS
        )
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

async def _main() -> None:
    parser = argparse.ArgumentParser(description="Outbound OS optimization scheduler")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--once",
        action="store_true",
        help="Run a single optimization pass then exit",
    )
    group.add_argument(
        "--campaign",
        metavar="UUID",
        help="Run the agent immediately for one specific campaign UUID then exit",
    )
    args = parser.parse_args()

    if args.campaign:
        logger.info("Running agent for campaign %s", args.campaign)
        rewrites = await run_optimization_agent(args.campaign)
        logger.info("Done — %d rewrite(s) applied.", len(rewrites))
    elif args.once:
        await run_one_pass()
    else:
        await run_loop()


if __name__ == "__main__":
    asyncio.run(_main())
