import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { PLANS, TOPUP_PACKS } from '@/lib/plans'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planKey, topupIndex } = await request.json()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  let priceId: string
  let mode: 'subscription' | 'payment'

  if (planKey && PLANS[planKey as keyof typeof PLANS]) {
    priceId = PLANS[planKey as keyof typeof PLANS].stripePriceId
    mode = 'subscription'
  } else if (topupIndex !== undefined) {
    priceId = TOPUP_PACKS[topupIndex].stripePriceId
    mode = 'payment'
  } else {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: profile?.stripe_customer_id || undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=true`,
    cancel_url: `${appUrl}/dashboard/billing`,
    metadata: { userId: user.id, planKey: planKey || '', topupIndex: String(topupIndex ?? '') },
  })

  return NextResponse.json({ url: session.url })
}
