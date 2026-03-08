import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user and is in draft status
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Campaign is already running or completed' }, { status: 400 })
  }

  // Trigger worker pipeline
  try {
    const res = await fetch(`${process.env.WORKER_URL}/pipeline/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': process.env.WORKER_SECRET!,
      },
      body: JSON.stringify({ campaign_id: campaign.id, user_id: user.id }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Worker error: ${text}` }, { status: 502 })
    }

    return NextResponse.json({ status: 'launched' })
  } catch {
    return NextResponse.json({ error: 'Could not reach worker server' }, { status: 502 })
  }
}
