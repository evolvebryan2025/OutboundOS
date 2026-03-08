import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CampaignProgress } from '@/components/campaigns/CampaignProgress'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-gray-400">{campaign.business_type} · {campaign.city}</p>
        </div>
      </div>

      <CampaignProgress campaignId={campaign.id} initialStatus={campaign.status} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Campaign Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Offer</span>
              <span className="text-white text-right max-w-xs">{campaign.offer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pain Point</span>
              <span className="text-white text-right max-w-xs">{campaign.pain_point}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Outcome</span>
              <span className="text-white text-right max-w-xs">{campaign.outcome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tone</span>
              <span className="text-white capitalize">{campaign.tone}</span>
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
            <div className="flex justify-between">
              <span className="text-gray-400">Per-Lead Personalization</span>
              <span className={campaign.personalize_enabled ? 'text-green-400' : 'text-gray-500'}>
                {campaign.personalize_enabled ? 'On' : 'Off'}
              </span>
            </div>
            {campaign.instantly_campaign_id && (
              <div className="flex justify-between">
                <span className="text-gray-400">Instantly Campaign ID</span>
                <span className="text-white font-mono text-xs">{campaign.instantly_campaign_id}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
