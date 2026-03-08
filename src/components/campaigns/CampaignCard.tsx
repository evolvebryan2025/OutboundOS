import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Campaign } from '@/lib/supabase/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  scraping: 'bg-yellow-500/20 text-yellow-400',
  generating: 'bg-purple-500/20 text-purple-400',
  humanizing: 'bg-pink-500/20 text-pink-400',
  pushing: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-orange-500/20 text-orange-400',
  completed: 'bg-gray-500/20 text-gray-400',
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="bg-gray-900 border-gray-800 hover:border-gray-600 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{campaign.name}</p>
              <p className="text-gray-400 text-sm mt-1">{campaign.business_type} · {campaign.city}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${STATUS_COLORS[campaign.status] || 'bg-gray-500/20 text-gray-400'}`}>
              {campaign.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div>
              <p className="text-white font-semibold text-sm">{campaign.leads_scraped.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Scraped</p>
            </div>
            <div>
              <p className="text-blue-400 font-semibold text-sm">{campaign.leads_verified.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Verified</p>
            </div>
            <div>
              <p className="text-green-400 font-semibold text-sm">{campaign.leads_pushed.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Pushed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
