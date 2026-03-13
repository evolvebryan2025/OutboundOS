import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPayPalAccessToken, getPayPalBaseUrl } from '@/lib/paypal'
import { TOPUP_PACKS } from '@/lib/plans'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topupIndex } = (await req.json()) as { topupIndex: number }

    if (topupIndex == null || !TOPUP_PACKS[topupIndex]) {
      return NextResponse.json({ error: 'Invalid top-up pack' }, { status: 400 })
    }

    const pack = TOPUP_PACKS[topupIndex]
    const accessToken = await getPayPalAccessToken()
    const baseUrl = getPayPalBaseUrl()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: pack.price.toFixed(2),
            },
            description: `Outbound OS Top-Up: ${pack.leads.toLocaleString()} leads`,
            custom_id: JSON.stringify({ userId: user.id, topupIndex }),
          },
        ],
        application_context: {
          brand_name: 'Outbound OS',
          return_url: `${appUrl}/api/paypal/capture-order`,
          cancel_url: `${appUrl}/dashboard/billing`,
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('PayPal create-order error:', text)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 },
      )
    }

    const order = await res.json()
    const approvalLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === 'approve',
    )

    if (!approvalLink) {
      return NextResponse.json(
        { error: 'No approval link returned' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: approvalLink.href, orderId: order.id })
  } catch (err) {
    console.error('create-order error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
