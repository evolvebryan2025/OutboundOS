import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CampaignProgress } from '@/components/campaigns/CampaignProgress'
import { EmailPreview } from '@/components/campaigns/EmailPreview'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaign } = await supabase
    .from('campaigns').select('*').eq('id', id).eq('user_id', user.id).single()

  if (!campaign) notFound()

  // Fetch email sequence if in review status
  let emails: Array<Record<string, unknown>> = []
  if (campaign.status === 'review') {
    const { data: sequence } = await supabase
      .from('sequences').select('emails, humanized_emails')
      .eq('campaign_id', id).single()
    if (sequence) {
      emails = (sequence.humanized_emails || sequence.emails || []) as Array<Record<string, unknown>>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-gray-400">{campaign.business_type} · {campaign.city}</p>
        </div>
      </div>

      <CampaignProgress campaignId={campaign.id} initialStatus={campaign.status} />

      {/* Email Preview (shown when status is "review") */}
      <EmailPreview campaignId={campaign.id} emails={emails as never[]} status={campaign.status} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Campaign Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Offer</span>
              <span className="text-white text-right max-w-xs">{campaign.offer}</span>
            </div>
            {campaign.pain_point && (
              <div className="flex justify-between">
                <span className="text-gray-400">Pain Point</span>
                <span className="text-white text-right max-w-xs">{campaign.pain_point}</span>
              </div>
            )}
            {campaign.outcome && (
              <div className="flex justify-between">
                <span className="text-gray-400">Outcome</span>
                <span className="text-white text-right max-w-xs">{campaign.outcome}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Lead Source</span>
              <span className="text-white capitalize">{campaign.lead_source === 'uploaded' ? 'Your leads' : 'Auto-scraped'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">StealthGPT Humanization</span>
              <span className={campaign.humanize_enabled ? 'text-green-400' : 'text-gray-500'}>
                {campaign.humanize_enabled ? 'On' : 'Off'}
              </span>
            </div>
            {campaign.instantly_campaign_id && (
              <div className="flex justify-between">
                <span className="text-gray-400">Instantly Campaign ID</span>
                <span className="text-white font-mono text-xs">{campaign.instantly_campaign_id}</span>
              </div>
            )}
            {(campaign.sending_accounts || []).length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Sending Accounts</span>
                <span className="text-white">{campaign.sending_accounts.length} selected</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
