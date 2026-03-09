import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  business_type: z.string().min(1),
  city: z.string().min(1),
  offer: z.string().min(1),
  pain_point: z.string().optional(),
  outcome: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'direct']).default('professional'),
  humanize_enabled: z.boolean().default(true),
  personalize_enabled: z.boolean().default(true),
  lead_source: z.enum(['scraper', 'uploaded']).default('scraper'),
  sending_accounts: z.array(z.string()).default([]),
  uploaded_leads_csv: z.string().optional(),
  uploaded_leads_manual: z.array(z.object({
    email: z.string().email(),
    business_name: z.string().optional(),
    phone: z.string().optional(),
  })).optional(),
})

function parseCsvLeads(csv: string): Array<{ email: string; business_name: string; phone: string }> {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  // Detect separator (tab or comma)
  const separator = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const emailCol = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email_address')
  const nameCol = headers.findIndex(h => h === 'business_name' || h === 'company' || h === 'company_name' || h === 'name' || h === 'business')
  const phoneCol = headers.findIndex(h => h === 'phone' || h === 'phone_number' || h === 'tel')

  if (emailCol === -1) return []

  const leads: Array<{ email: string; business_name: string; phone: string }> = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/^['"]|['"]$/g, ''))
    const email = cols[emailCol]
    if (!email || !email.includes('@')) continue
    leads.push({
      email,
      business_name: nameCol >= 0 ? cols[nameCol] || '' : '',
      phone: phoneCol >= 0 ? cols[phoneCol] || '' : '',
    })
  }
  return leads
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Check credit balance
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('credits_remaining, plan').eq('id', user.id).single()
  if (profileError) return NextResponse.json({ error: 'Could not verify account.' }, { status: 500 })
  if (!profile || profile.credits_remaining < 500) {
    return NextResponse.json({ error: 'Insufficient credits. Please top up.' }, { status: 402 })
  }

  const { uploaded_leads_csv, uploaded_leads_manual, ...campaignData } = parsed.data

  const { data: campaign, error } = await supabase.from('campaigns').insert({
    user_id: user.id,
    ...campaignData,
    pain_point: campaignData.pain_point || null,
    outcome: campaignData.outcome || null,
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If BYOL, insert leads before triggering pipeline
  if (parsed.data.lead_source === 'uploaded') {
    let leads: Array<{ email: string; business_name: string; phone: string }> = []

    if (uploaded_leads_csv) {
      leads = parseCsvLeads(uploaded_leads_csv)
    } else if (uploaded_leads_manual) {
      leads = uploaded_leads_manual.map(l => ({
        email: l.email,
        business_name: l.business_name || '',
        phone: l.phone || '',
      }))
    }

    if (leads.length > 0) {
      const leadsToInsert = leads.map(l => ({
        campaign_id: campaign.id,
        user_id: user.id,
        business_name: l.business_name || 'Unknown',
        email: l.email,
        phone: l.phone || null,
        city: campaignData.city,
        niche: campaignData.business_type,
        verified: false,
      }))
      await supabase.from('leads').insert(leadsToInsert)
    }
  }

  // Trigger worker pipeline
  fetch(`${process.env.WORKER_URL}/pipeline/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': process.env.WORKER_SECRET!,
    },
    body: JSON.stringify({ campaign_id: campaign.id, user_id: user.id }),
  }).catch(() => {})

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
