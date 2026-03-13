// DISABLED: Stripe replaced by PayPal — kept for future re-enablement
// See /api/paypal/webhook instead

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Stripe webhook is disabled. Use PayPal webhook.' }, { status: 410 })
}
