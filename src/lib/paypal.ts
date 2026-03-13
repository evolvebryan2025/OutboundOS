/**
 * PayPal helper library — plain fetch, no SDK needed.
 */

export function getPayPalBaseUrl(): string {
  // PAYPAL_MODE env var overrides NODE_ENV detection.
  // Set PAYPAL_MODE=live to use production API even in local dev.
  const mode = process.env.PAYPAL_MODE || (process.env.NODE_ENV === 'production' ? 'live' : 'sandbox')
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

export async function getPayPalAccessToken(): Promise<string> {
  const baseUrl = getPayPalBaseUrl()
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal token error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string,
): Promise<boolean> {
  const baseUrl = getPayPalBaseUrl()
  const accessToken = await getPayPalAccessToken()

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID!,
      webhook_event: JSON.parse(body),
    }),
  })

  if (!res.ok) {
    console.error('PayPal webhook verification failed:', await res.text())
    return false
  }

  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}
