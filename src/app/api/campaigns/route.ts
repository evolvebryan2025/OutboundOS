import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  business_type: z.string().min(1),
  city: z.string().min(1),
  offer: z.string().min(1),
  pain_point: z.string().min(1),
  outcome: z.string().min(1),
  tone: z.enum(['professional', 'casual', 'direct']).default('professional'),
  humanize_enabled: z.boolean().default(true),
  personalize_enabled: z.boolean().default(true),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Check credit balance
  const { data: profile } = await supabase.from('profiles').select('credits_remaining, plan').eq('id', user.id).single()
  if (!profile || profile.credits_remaining < 500) {
    return NextResponse.json({ error: 'Insufficient credits. Please top up.' }, { status: 402 })
  }

  const { data: campaign, error } = await supabase.from('campaigns').insert({
    user_id: user.id,
    ...parsed.data,
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger worker to start pipeline (fire and forget)
  fetch(`${process.env.WORKER_URL}/pipeline/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': process.env.WORKER_SECRET!,
    },
    body: JSON.stringify({ campaign_id: campaign.id, user_id: user.id }),
  }).catch(() => {}) // Non-blocking

  return NextResponse.json({ campaign })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: campaigns } = await supabase.from('campaigns')
    .select('*, campaign_analytics(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaigns })
}
