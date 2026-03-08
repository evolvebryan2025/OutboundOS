import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const send = (data: object) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // Poll Supabase every 2 seconds and stream updates
  const interval = setInterval(async () => {
    const { data: campaign } = await supabase.from('campaigns')
      .select('status, leads_scraped, leads_verified, leads_pushed')
      .eq('id', id).eq('user_id', user.id).single()

    if (!campaign) { clearInterval(interval); writer.close(); return }
    await send(campaign)

    if (['active', 'completed', 'draft'].includes(campaign.status)) {
      clearInterval(interval)
      writer.close()
    }
  }, 2000)

  request.signal.addEventListener('abort', () => {
    clearInterval(interval)
    writer.close()
  })

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
