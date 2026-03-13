import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPayPalAccessToken, getPayPalBaseUrl } from '@/lib/paypal'
import { PLANS, type PlanKey } from '@/lib/plans'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planKey } = (await req.json()) as { planKey: string }

    if (!planKey || !(planKey in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const plan = PLANS[planKey as PlanKey]
    const accessToken = await getPayPalAccessToken()
    const baseUrl = getPayPalBaseUrl()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const res = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: plan.paypalPlanId,
        custom_id: JSON.stringify({ userId: user.id, planKey }),
        application_context: {
          brand_name: 'Outbound OS',
          return_url: `${appUrl}/dashboard/billing?success=true`,
          cancel_url: `${appUrl}/dashboard/billing`,
          user_action: 'SUBSCRIBE_NOW',
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('PayPal create-subscription error:', text)
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 },
      )
    }

    const subscription = await res.json()
    const approvalLink = subscription.links?.find(
      (link: { rel: string; href: string }) => link.rel === 'approve',
    )

    if (!approvalLink) {
      return NextResponse.json(
        { error: 'No approval link returned' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: approvalLink.href })
  } catch (err) {
    console.error('create-subscription error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
