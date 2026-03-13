import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPayPalAccessToken, getPayPalBaseUrl } from '@/lib/paypal'
import { TOPUP_PACKS } from '@/lib/plans'

// Service-role client (no cookies in PayPal redirect)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('token') // PayPal passes order ID as 'token'

    if (!orderId) {
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=missing_order`)
    }

    const accessToken = await getPayPalAccessToken()
    const baseUrl = getPayPalBaseUrl()

    // Capture the order
    const captureRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!captureRes.ok) {
      const text = await captureRes.text()
      console.error('PayPal capture error:', text)
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=capture_failed`)
    }

    const capture = await captureRes.json()

    if (capture.status !== 'COMPLETED') {
      console.error('PayPal capture not completed:', capture.status)
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=not_completed`)
    }

    // Extract custom_id from the capture
    const captureData =
      capture.purchase_units?.[0]?.payments?.captures?.[0]
    const customId = captureData?.custom_id || capture.purchase_units?.[0]?.custom_id

    if (!customId) {
      console.error('No custom_id found in capture')
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=no_custom_id`)
    }

    const { userId, topupIndex } = JSON.parse(customId) as {
      userId: string
      topupIndex: number
    }

    const pack = TOPUP_PACKS[topupIndex]
    if (!pack) {
      console.error('Invalid topupIndex:', topupIndex)
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=invalid_pack`)
    }

    const supabase = getServiceSupabase()

    // Increment credits
    const { error: rpcError } = await supabase.rpc('increment_credits', {
      user_id: userId,
      amount: pack.leads,
    })

    if (rpcError) {
      console.error('increment_credits error:', rpcError)
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=credit_update_failed`)
    }

    // Record the transaction
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: pack.leads,
        reason: 'topup',
        paypal_order_id: orderId,
      })

    if (txError) {
      console.error('credit_transaction insert error:', txError)
    }

    return NextResponse.redirect(`${appUrl}/dashboard/billing?success=true`)
  } catch (err) {
    console.error('capture-order error:', err)
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=internal`)
  }
}
