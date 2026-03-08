import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Integration = 'instantly' | 'stealthgpt' | 'apify' | 'resend'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { integration, apiKey } = await request.json() as { integration: Integration; apiKey: string }
  if (!apiKey || apiKey.startsWith('••••')) {
    return NextResponse.json({ error: 'Provide the full API key to test' }, { status: 400 })
  }

  try {
    switch (integration) {
      case 'instantly': {
        // Instantly v2 API uses Bearer token auth
        const res = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=1', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (res.ok) return NextResponse.json({ success: true, message: 'Instantly AI connected ✓' })
        // Also try v1 query param style as fallback
        const resV1 = await fetch(`https://api.instantly.ai/api/v1/campaign/list?api_key=${apiKey}&limit=1`)
        if (resV1.ok) return NextResponse.json({ success: true, message: 'Instantly AI connected ✓' })
        return NextResponse.json({ success: false, message: 'Invalid Instantly AI API key' })
      }

      case 'stealthgpt': {
        // StealthGPT: small test request with a short string
        const res = await fetch('https://stealthgpt.ai/api/stealthify', {
          method: 'POST',
          headers: { 'api-token': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', mode: 'standard', business: true }),
        })
        if (res.status === 200 || res.status === 201) return NextResponse.json({ success: true, message: 'StealthGPT connected ✓' })
        if (res.status === 401 || res.status === 403) return NextResponse.json({ success: false, message: 'Invalid StealthGPT API key' })
        return NextResponse.json({ success: true, message: 'StealthGPT reachable ✓' })
      }

      case 'apify': {
        const res = await fetch(`https://api.apify.com/v2/users/me?token=${apiKey}`)
        if (res.ok) {
          const data = await res.json() as { data?: { username?: string } }
          return NextResponse.json({ success: true, message: `Apify connected as @${data.data?.username ?? 'user'} ✓` })
        }
        return NextResponse.json({ success: false, message: 'Invalid Apify API token' })
      }

      case 'resend': {
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (res.ok) return NextResponse.json({ success: true, message: 'Resend connected ✓' })
        return NextResponse.json({ success: false, message: 'Invalid Resend API key' })
      }

      default:
        return NextResponse.json({ error: 'Unknown integration' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ success: false, message: 'Connection test failed — check the key and try again' })
  }
}
