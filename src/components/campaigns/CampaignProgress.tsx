'use client'
import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Ready',
  scraping: 'Scraping Google Maps...',
  generating: 'Writing email sequence...',
  humanizing: 'Humanizing with StealthGPT...',
  review: 'Emails ready — review below',
  pushing: 'Pushing to Instantly AI...',
  active: 'Campaign Live!',
  completed: 'Completed',
  paused: 'Paused',
  failed: 'Something went wrong',
}

const STATUS_PROGRESS: Record<string, number> = {
  draft: 0,
  scraping: 20,
  generating: 40,
  humanizing: 60,
  review: 70,
  pushing: 85,
  active: 100,
  completed: 100,
}

interface ProgressData {
  status: string
  leads_scraped: number
  leads_verified: number
  leads_pushed: number
  error_message?: string
}

export function CampaignProgress({ campaignId, initialStatus }: { campaignId: string; initialStatus?: string }) {
  const [data, setData] = useState<ProgressData>({
    status: initialStatus || 'draft',
    leads_scraped: 0,
    leads_verified: 0,
    leads_pushed: 0,
  })
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const terminal = ['active', 'completed', 'draft', 'paused', 'review', 'failed']
    if (terminal.includes(data.status) && data.status === initialStatus) return

    const es = new EventSource(`/api/campaigns/${campaignId}/progress`)
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data) as ProgressData
      setData(parsed)
      if (terminal.includes(parsed.status)) es.close()
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [campaignId, initialStatus, data.status])

  async function handleRetry() {
    setRetrying(true)
    await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' })
    window.location.reload()
  }

  const progress = STATUS_PROGRESS[data.status] ?? 0

  return (
    <div className="space-y-4 bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-white font-medium">{STATUS_LABELS[data.status] || data.status}</p>
        <Badge variant={data.status === 'active' ? 'default' : data.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
          {data.status}
        </Badge>
      </div>

      {data.status === 'failed' && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{data.error_message || 'An unexpected error occurred.'}</p>
          </div>
          <Button onClick={handleRetry} size="sm" disabled={retrying}
            className="bg-red-600 hover:bg-red-700 text-white shrink-0">
            {retrying ? <Loader2 size={14} className="animate-spin" /> : 'Retry'}
          </Button>
        </div>
      )}

      {data.status !== 'failed' && <Progress value={progress} className="h-2" />}

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{data.leads_scraped.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Scraped</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-400">{data.leads_verified.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Verified</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{data.leads_pushed.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Pushed</p>
        </div>
      </div>
    </div>
  )
}
