import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await request.json() as { email: string }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 })
  }

  try {
    const res = await fetch(`${process.env.WORKER_URL}/pipeline/test-reacher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': process.env.WORKER_SECRET!,
      },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Worker error: ${text}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Could not reach worker server' },
      { status: 502 }
    )
  }
}
