// DISABLED: Stripe replaced by PayPal — kept for future re-enablement
// See /api/paypal/create-subscription and /api/paypal/create-order instead

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Stripe is disabled. Use PayPal endpoints.' }, { status: 410 })
}
