'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LaunchButton({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const router = useRouter()

  async function handleLaunch() {
    setLoading(true)
    setMessage(null)
    setIsError(false)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, { method: 'POST' })
      const text = await res.text()
      let data: Record<string, string> = {}
      try { data = JSON.parse(text) } catch { data = { error: text } }

      if (!res.ok) {
        setIsError(true)
        setMessage(data.error || `Error ${res.status}: ${text}`)
        return
      }
      setMessage('Campaign launched! Pipeline is running...')
      setTimeout(() => router.refresh(), 2000)
    } catch (err) {
      setIsError(true)
      setMessage(`Network error: ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {loading ? 'Launching...' : 'Launch Campaign'}
      </button>
      {message && (
        <p className={`text-sm ${isError ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
      )}
    </div>
  )
}
