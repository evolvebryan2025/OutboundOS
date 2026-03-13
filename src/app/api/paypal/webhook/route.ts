import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPayPalWebhook } from '@/lib/paypal'
import { PLANS, type PlanKey } from '@/lib/plans'

// Service-role client (webhooks have no user session)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()

    // Collect PayPal webhook headers
    const headers: Record<string, string> = {}
    for (const key of [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ]) {
      const value = req.headers.get(key)
      if (value) headers[key] = value
    }

    // Verify webhook signature
    const isValid = await verifyPayPalWebhook(headers, bodyText)
    if (!isValid) {
      console.error('PayPal webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(bodyText)
    const eventType = event.event_type as string
    const supabase = getServiceSupabase()

    switch (eventType) {
      // ──────────────────────────────────────────────
      // Subscription activated — provision the plan
      // ──────────────────────────────────────────────
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const customIdRaw = event.resource?.custom_id
        if (!customIdRaw) {
          console.error('ACTIVATED: missing custom_id')
          break
        }

        const { userId, planKey } = JSON.parse(customIdRaw) as {
          userId: string
          planKey: string
        }

        const plan = PLANS[planKey as PlanKey]
        if (!plan) {
          console.error('ACTIVATED: invalid planKey', planKey)
          break
        }

        const subscriptionId = event.resource.id as string
        const payerId = event.resource.subscriber?.payer_id as string | undefined

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            plan: planKey,
            credits_remaining: plan.credits,
            credits_monthly: plan.credits,
            paypal_subscription_id: subscriptionId,
            paypal_payer_id: payerId ?? null,
          })
          .eq('id', userId)

        if (updateError) {
          console.error('ACTIVATED: profile update error', updateError)
        }

        // Record the transaction
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          amount: plan.credits,
          reason: 'subscription',
        })

        break
      }

      // ──────────────────────────────────────────────
      // Recurring payment completed — reset monthly credits
      // ──────────────────────────────────────────────
      case 'PAYMENT.SALE.COMPLETED': {
        const billingAgreementId = event.resource?.billing_agreement_id as
          | string
          | undefined

        if (!billingAgreementId) {
          console.error('SALE.COMPLETED: no billing_agreement_id')
          break
        }

        // Look up the profile by subscription ID
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id, plan')
          .eq('paypal_subscription_id', billingAgreementId)
          .single()

        if (lookupError || !profile) {
          console.error('SALE.COMPLETED: profile lookup failed', lookupError)
          break
        }

        const plan = PLANS[profile.plan as PlanKey]
        if (!plan) {
          console.error('SALE.COMPLETED: unknown plan', profile.plan)
          break
        }

        const { error: resetError } = await supabase
          .from('profiles')
          .update({ credits_remaining: plan.credits })
          .eq('id', profile.id)

        if (resetError) {
          console.error('SALE.COMPLETED: credit reset error', resetError)
        }

        // Record the transaction
        await supabase.from('credit_transactions').insert({
          user_id: profile.id,
          amount: plan.credits,
          reason: 'subscription',
        })

        break
      }

      // ──────────────────────────────────────────────
      // Subscription cancelled or suspended — downgrade to starter
      // ──────────────────────────────────────────────
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subscriptionId = event.resource?.id as string | undefined

        if (!subscriptionId) {
          console.error(`${eventType}: no subscription id`)
          break
        }

        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('paypal_subscription_id', subscriptionId)
          .single()

        if (lookupError || !profile) {
          console.error(`${eventType}: profile lookup failed`, lookupError)
          break
        }

        const starter = PLANS.starter

        const { error: downgradeError } = await supabase
          .from('profiles')
          .update({
            plan: 'starter',
            credits_remaining: starter.credits,
            credits_monthly: starter.credits,
            paypal_subscription_id: null,
          })
          .eq('id', profile.id)

        if (downgradeError) {
          console.error(`${eventType}: downgrade error`, downgradeError)
        }

        break
      }

      default:
        console.log('Unhandled PayPal event type:', eventType)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('PayPal webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
