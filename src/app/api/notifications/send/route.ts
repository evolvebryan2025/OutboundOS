import { NextResponse } from 'next/server'
import { sendNotification } from '@/lib/email'

export async function POST(request: Request) {
  const secret = request.headers.get('x-worker-secret')
  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { to, type, data } = body

  if (!to || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await sendNotification(to, type, data || {})
  return NextResponse.json({ sent: true })
}
