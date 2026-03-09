'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, CheckCircle2, Mail } from 'lucide-react'

interface Email {
  email_number: number
  send_day: number
  subject_a: string
  subject_b: string
  body: string
  cta: string
}

interface EmailPreviewProps {
  campaignId: string
  emails: Email[]
  status: string
}

export function EmailPreview({ campaignId, emails, status }: EmailPreviewProps) {
  const [loading, setLoading] = useState<'approve' | 'regenerate' | null>(null)
  const [error, setError] = useState('')

  async function handleApprove() {
    setLoading('approve')
    setError('')
    const res = await fetch(`/api/campaigns/${campaignId}/approve`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to approve')
      setLoading(null)
      return
    }
    window.location.reload()
  }

  async function handleRegenerate() {
    setLoading('regenerate')
    setError('')
    const res = await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to regenerate')
    }
    setLoading(null)
    window.location.reload()
  }

  if (status !== 'review' || !emails || emails.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Email Sequence Preview</h2>
        </div>
        <Badge className="bg-yellow-500/20 text-yellow-400 border-0">Awaiting Approval</Badge>
      </div>

      <div className="space-y-3">
        {emails.map((email) => (
          <Card key={email.email_number} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm">
                  Email {email.email_number} — Day {email.send_day}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-gray-400 text-xs">Subject A</p>
                <p className="text-white text-sm bg-gray-800 rounded px-3 py-2">{email.subject_a}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-xs">Subject B</p>
                <p className="text-white text-sm bg-gray-800 rounded px-3 py-2">{email.subject_b}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-xs">Body</p>
                <div className="text-gray-300 text-sm bg-gray-800 rounded px-3 py-2 whitespace-pre-wrap">
                  {email.body}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-xs">CTA</p>
                <p className="text-blue-400 text-sm">{email.cta}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleApprove} disabled={loading !== null}
          className="flex-1 bg-green-600 hover:bg-green-700">
          {loading === 'approve' ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle2 size={14} className="mr-2" />}
          Approve & Launch
        </Button>
        <Button onClick={handleRegenerate} variant="outline" disabled={loading !== null}
          className="border-gray-700 text-gray-300 hover:text-white">
          {loading === 'regenerate' ? <Loader2 size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
          Regenerate
        </Button>
      </div>
    </div>
  )
}
