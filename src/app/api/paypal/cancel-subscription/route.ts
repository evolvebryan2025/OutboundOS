import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPayPalAccessToken, getPayPalBaseUrl } from '@/lib/paypal'
import { PLANS } from '@/lib/plans'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's PayPal subscription ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('paypal_subscription_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.paypal_subscription_id) {
      return NextResponse.json(
        { error: 'No active PayPal subscription found' },
        { status: 400 },
      )
    }

    const subscriptionId = profile.paypal_subscription_id
    const accessToken = await getPayPalAccessToken()
    const baseUrl = getPayPalBaseUrl()

    // Cancel the subscription on PayPal
    const cancelRes = await fetch(
      `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Customer requested cancellation' }),
      },
    )

    if (cancelRes.status !== 204) {
      const text = await cancelRes.text()
      console.error('PayPal cancel error:', cancelRes.status, text)
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 },
      )
    }

    // Update profile to starter plan
    const starter = PLANS.starter
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan: 'starter',
        credits_remaining: starter.credits,
        credits_monthly: starter.credits,
        paypal_subscription_id: null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile downgrade error:', updateError)
      return NextResponse.json(
        { error: 'Subscription cancelled but profile update failed' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('cancel-subscription error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
