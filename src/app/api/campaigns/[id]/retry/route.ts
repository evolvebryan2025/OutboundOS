import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user and is in failed status
  const { data: campaign } = await supabase
    .from('campaigns').select('status, failed_at_step').eq('id', id).eq('user_id', user.id).single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'failed') {
    return NextResponse.json({ error: 'Campaign is not in failed status' }, { status: 400 })
  }

  // Trigger worker to resume from failed step
  const res = await fetch(`${process.env.WORKER_URL}/pipeline/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': process.env.WORKER_SECRET!,
    },
    body: JSON.stringify({ campaign_id: id, user_id: user.id }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to retry campaign' }, { status: 500 })

  return NextResponse.json({ status: 'retrying' })
}
