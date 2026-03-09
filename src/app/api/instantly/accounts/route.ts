import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('instantly_api_key').eq('id', user.id).single()

  if (!profile?.instantly_api_key) {
    return NextResponse.json({ accounts: [], error: 'No Instantly API key configured' })
  }

  try {
    const res = await fetch('https://api.instantly.ai/api/v1/account/list', {
      headers: {
        'Authorization': `Bearer ${profile.instantly_api_key}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ accounts: [], error: 'Failed to fetch accounts from Instantly' })
    }

    const data = await res.json()
    const accounts = (data.accounts || data || []).map((a: Record<string, unknown>) => ({
      id: a.id || a.email,
      email: a.email,
      status: a.status || 'active',
      tags: a.tags || [],
    }))

    return NextResponse.json({ accounts })
  } catch {
    return NextResponse.json({ accounts: [], error: 'Could not connect to Instantly' })
  }
}
