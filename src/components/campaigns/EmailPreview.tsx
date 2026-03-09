'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, CheckCircle2, Mail, Pencil, Save, X } from 'lucide-react'

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

export function EmailPreview({ campaignId, emails: initialEmails, status }: EmailPreviewProps) {
  const [emails, setEmails] = useState<Email[]>(initialEmails)
  const [loading, setLoading] = useState<'approve' | 'regenerate' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Email | null>(null)
  const [hasEdits, setHasEdits] = useState(false)

  function startEditing(index: number) {
    setEditingIndex(index)
    setEditDraft({ ...emails[index] })
  }

  function cancelEditing() {
    setEditingIndex(null)
    setEditDraft(null)
  }

  function saveEdit() {
    if (editDraft === null || editingIndex === null) return
    const updated = [...emails]
    updated[editingIndex] = editDraft
    setEmails(updated)
    setEditingIndex(null)
    setEditDraft(null)
    setHasEdits(true)
  }

  async function saveEditsToServer() {
    setLoading('save')
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sequence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save edits')
      } else {
        setHasEdits(false)
      }
    } catch {
      setError('Failed to save edits')
    }
    setLoading(null)
  }

  async function handleApprove() {
    if (hasEdits) {
      await saveEditsToServer()
    }
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
        <div className="flex items-center gap-2">
          {hasEdits && (
            <Badge className="bg-blue-500/20 text-blue-400 border-0">Unsaved edits</Badge>
          )}
          <Badge className="bg-yellow-500/20 text-yellow-400 border-0">Awaiting Approval</Badge>
        </div>
      </div>

      <div className="space-y-3">
        {emails.map((email, index) => (
          <Card key={email.email_number} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm">
                  Email {email.email_number} — Day {email.send_day}
                </CardTitle>
                {editingIndex === index ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={saveEdit}
                      className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10">
                      <Save size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}
                      className="h-7 px-2 text-gray-400 hover:text-gray-300">
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => startEditing(index)}
                    className="h-7 px-2 text-gray-500 hover:text-white hover:bg-gray-800">
                    <Pencil size={14} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingIndex === index && editDraft ? (
                <>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-xs">Subject A</p>
                    <input
                      value={editDraft.subject_a}
                      onChange={(e) => setEditDraft({ ...editDraft, subject_a: e.target.value })}
                      className="w-full text-white text-sm bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-xs">Subject B</p>
                    <input
                      value={editDraft.subject_b}
                      onChange={(e) => setEditDraft({ ...editDraft, subject_b: e.target.value })}
                      className="w-full text-white text-sm bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-xs">Body</p>
                    <textarea
                      value={editDraft.body}
                      onChange={(e) => setEditDraft({ ...editDraft, body: e.target.value })}
                      rows={6}
                      className="w-full text-gray-300 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-xs">CTA</p>
                    <input
                      value={editDraft.cta}
                      onChange={(e) => setEditDraft({ ...editDraft, cta: e.target.value })}
                      className="w-full text-blue-400 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        {hasEdits && (
          <Button onClick={saveEditsToServer} disabled={loading !== null}
            className="bg-blue-600 hover:bg-blue-700">
            {loading === 'save' ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
            Save Edits
          </Button>
        )}
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
