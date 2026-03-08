import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import { Plus } from 'lucide-react'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400">{campaigns?.length || 0} campaigns total</p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus size={16} />
            New Campaign
          </Button>
        </Link>
      </div>

      {(!campaigns || campaigns.length === 0) ? (
        <div className="text-center py-20 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400 text-lg">No campaigns yet</p>
          <p className="text-gray-500 text-sm mt-2">Create your first campaign to start scraping leads</p>
          <Link href="/dashboard/campaigns/new">
            <Button className="mt-6 bg-blue-600 hover:bg-blue-700">Create First Campaign</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  )
}
