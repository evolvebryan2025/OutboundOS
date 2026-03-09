import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = 'Outbound OS <notifications@outboundos.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://outboundos.com'

export async function sendNotification(
  to: string,
  type: 'review' | 'live' | 'failed' | 'low_credits',
  data: { campaignName?: string; campaignId?: string; errorMessage?: string; leadsCount?: number; creditsRemaining?: number }
) {
  const templates: Record<string, { subject: string; html: string }> = {
    review: {
      subject: `Your emails are ready for review — ${data.campaignName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #fff;">Your emails are ready</h2>
          <p style="color: #9ca3af;">Campaign: <strong style="color: #fff;">${data.campaignName}</strong></p>
          <p style="color: #9ca3af;">We've generated your 5-email sequence. Review and approve them before they go out.</p>
          <a href="${APP_URL}/dashboard/campaigns/${data.campaignId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Review Emails</a>
        </div>
      `,
    },
    live: {
      subject: `Campaign live! ${data.leadsCount} leads pushed — ${data.campaignName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #fff;">Your campaign is live!</h2>
          <p style="color: #9ca3af;">Campaign: <strong style="color: #fff;">${data.campaignName}</strong></p>
          <p style="color: #9ca3af;"><strong style="color: #22c55e;">${data.leadsCount}</strong> leads have been pushed to Instantly AI.</p>
          <a href="${APP_URL}/dashboard/campaigns/${data.campaignId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">View Campaign</a>
        </div>
      `,
    },
    failed: {
      subject: `Action needed — ${data.campaignName} hit an issue`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #ef4444;">Something went wrong</h2>
          <p style="color: #9ca3af;">Campaign: <strong style="color: #fff;">${data.campaignName}</strong></p>
          <p style="color: #9ca3af;">${data.errorMessage}</p>
          <a href="${APP_URL}/dashboard/campaigns/${data.campaignId}" style="display: inline-block; background: #ef4444; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Retry Campaign</a>
        </div>
      `,
    },
    low_credits: {
      subject: 'Your Outbound OS credits are running low',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #eab308;">Credits running low</h2>
          <p style="color: #9ca3af;">You have <strong style="color: #fff;">${data.creditsRemaining}</strong> credits remaining.</p>
          <p style="color: #9ca3af;">Top up to keep your campaigns running.</p>
          <a href="${APP_URL}/dashboard/billing" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Top Up Credits</a>
        </div>
      `,
    },
  }

  const template = templates[type]
  if (!template) return

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: template.subject,
      html: template.html,
    })
  } catch (e) {
    console.error(`Failed to send ${type} notification to ${to}:`, e)
  }
}
