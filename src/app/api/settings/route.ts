import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const UpdateSettingsSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  instantly_api_key: z.string().nullable().optional(),
  stealth_gpt_api_key: z.string().nullable().optional(),
  apify_api_token: z.string().nullable().optional(),
  resend_api_key: z.string().nullable().optional(),
  onboarding_complete: z.boolean().optional(),
}).passthrough()

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Mask API keys — only send last 4 chars
  return NextResponse.json({
    profile: {
      ...profile,
      instantly_api_key: maskKey(profile.instantly_api_key ?? null),
      stealth_gpt_api_key: maskKey(profile.stealth_gpt_api_key ?? null),
      apify_api_token: maskKey(profile.apify_api_token ?? null),
      resend_api_key: maskKey(profile.resend_api_key ?? null),
    }
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Filter out undefined values (don't overwrite fields not in this request)
  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  )

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

function maskKey(key: string | null): string | null {
  if (!key || key.length < 8) return key
  return `••••••••${key.slice(-4)}`
}
