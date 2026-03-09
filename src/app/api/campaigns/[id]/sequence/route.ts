import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user and is in review status
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'review') {
    return NextResponse.json({ error: 'Can only edit emails during review' }, { status: 400 })
  }

  const { emails } = await request.json()
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'Invalid emails data' }, { status: 400 })
  }

  // Update the sequence — save edits to humanized_emails (takes priority) or emails
  const { data: sequence } = await supabase
    .from('sequences')
    .select('humanized_emails')
    .eq('campaign_id', id)
    .single()

  const updateField = sequence?.humanized_emails ? 'humanized_emails' : 'emails'

  const { error } = await supabase
    .from('sequences')
    .update({ [updateField]: emails })
    .eq('campaign_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'saved' })
}
