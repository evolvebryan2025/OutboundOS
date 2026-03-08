import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { PLANS, TOPUP_PACKS } from '@/lib/plans'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = (await headers()).get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const userId = session.metadata?.userId
  if (!userId) return NextResponse.json({ received: true })

  if (event.type === 'checkout.session.completed') {
    const planKey = session.metadata?.planKey
    const topupIndex = session.metadata?.topupIndex

    if (planKey && PLANS[planKey as keyof typeof PLANS]) {
      const plan = PLANS[planKey as keyof typeof PLANS]
      await supabase.from('profiles').update({
        plan: planKey,
        credits_remaining: plan.credits,
        credits_monthly: plan.credits,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, amount: plan.credits, reason: 'subscription'
      })
    }

    if (topupIndex !== undefined && topupIndex !== '') {
      const pack = TOPUP_PACKS[Number(topupIndex)]
      await supabase.rpc('increment_credits', { user_id: userId, amount: pack.leads })
      await supabase.from('credit_transactions').insert({
        user_id: userId, amount: pack.leads, reason: 'topup',
        stripe_payment_intent_id: session.payment_intent as string
      })
    }
  }

  return NextResponse.json({ received: true })
}
