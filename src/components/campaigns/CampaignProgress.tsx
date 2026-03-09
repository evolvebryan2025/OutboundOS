'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Volume2, VolumeX } from 'lucide-react'

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

function playNotificationSound(type: 'step' | 'done' | 'error') {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = 0.3

    if (type === 'done') {
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
      // Second tone
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 1174
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
      osc2.start(ctx.currentTime + 0.15)
      osc2.stop(ctx.currentTime + 0.6)
    } else if (type === 'error') {
      osc.frequency.value = 300
      osc.type = 'sawtooth'
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } else {
      osc.frequency.value = 660
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.2)
    }
  } catch {
    // AudioContext not available
  }
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
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevStatusRef = useRef(initialStatus || 'draft')

  const handleStatusChange = useCallback((newStatus: string) => {
    if (!soundEnabled) return
    if (newStatus === prevStatusRef.current) return

    if (newStatus === 'review' || newStatus === 'active') {
      playNotificationSound('done')
    } else if (newStatus === 'failed') {
      playNotificationSound('error')
    } else if (newStatus !== 'draft') {
      playNotificationSound('step')
    }
    prevStatusRef.current = newStatus
  }, [soundEnabled])

  useEffect(() => {
    const terminal = ['active', 'completed', 'draft', 'paused', 'review', 'failed']
    if (terminal.includes(data.status) && data.status === initialStatus) return

    const es = new EventSource(`/api/campaigns/${campaignId}/progress`)
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data) as ProgressData
      handleStatusChange(parsed.status)
      setData(parsed)
      if (terminal.includes(parsed.status)) es.close()
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [campaignId, initialStatus, data.status, handleStatusChange])

  async function handleRetry() {
    setRetrying(true)
    await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' })
    window.location.reload()
  }

  const progress = STATUS_PROGRESS[data.status] ?? 0

  return (
    <div className="space-y-4 bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-white font-medium">{STATUS_LABELS[data.status] || data.status}</p>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
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
