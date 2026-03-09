'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Upload, Plus, ClipboardPaste, Search, Loader2 } from 'lucide-react'

const schema = z.object({
  business_type: z.string().min(1, 'Business type required'),
  city: z.string().min(1, 'City required'),
  offer: z.string().min(1, 'Offer required'),
})

type FormData = z.infer<typeof schema>

interface SendingAccount {
  id: string
  email: string
  status: string
  tags: string[]
}

export function CampaignForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Lead source
  const [leadSource, setLeadSource] = useState<'scraper' | 'uploaded'>('scraper')

  // BYOL state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [pasteData, setPasteData] = useState('')
  const [manualLeads, setManualLeads] = useState([{ email: '', business_name: '', phone: '' }])

  // Sender accounts
  const [accounts, setAccounts] = useState<SendingAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Fetch sending accounts from Instantly
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/instantly/accounts')
      if (res.ok) {
        const data = await res.json() as { accounts: SendingAccount[] }
        setAccounts(data.accounts || [])
      }
    } catch {} finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  // All unique tags
  const allTags = [...new Set(accounts.flatMap(a => a.tags || []))]

  // Filtered accounts based on selected tags
  const filteredAccounts = selectedTags.length > 0
    ? accounts.filter(a => (a.tags || []).some(t => selectedTags.includes(t)))
    : accounts

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleAccount(id: string) {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  function selectAllVisible() {
    const activeIds = filteredAccounts.filter(a => a.status === 'active').map(a => a.id)
    setSelectedAccounts(activeIds)
  }

  function addManualLead() {
    setManualLeads(prev => [...prev, { email: '', business_name: '', phone: '' }])
  }

  function updateManualLead(index: number, field: string, value: string) {
    setManualLeads(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  async function onSubmit(data: FormData) {
    if (selectedAccounts.length === 0) {
      setError('Select at least one sending account')
      return
    }

    setLoading(true)
    setError('')

    // Auto-generate campaign name
    const now = new Date()
    const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const name = `${data.city} ${data.business_type} - ${monthYear}`

    const payload: Record<string, unknown> = {
      ...data,
      name,
      lead_source: leadSource,
      sending_accounts: selectedAccounts,
    }

    // If BYOL, attach leads data
    if (leadSource === 'uploaded') {
      if (csvFile) {
        const text = await csvFile.text()
        payload.uploaded_leads_csv = text
      } else if (pasteData.trim()) {
        payload.uploaded_leads_csv = pasteData.trim()
      } else {
        const validLeads = manualLeads.filter(l => l.email.trim())
        if (validLeads.length === 0) {
          setError('Add at least one lead with an email address')
          setLoading(false)
          return
        }
        payload.uploaded_leads_manual = validLeads
      }
    }

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create campaign'); setLoading(false); return }
    router.push(`/dashboard/campaigns/${json.campaign.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-3xl">
      {/* --- Core Fields --- */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Campaign Details</h2>
        {[
          { name: 'business_type' as const, label: 'Business Type', placeholder: 'e.g., Chiropractors, Dentists, Plumbers' },
          { name: 'city' as const, label: 'City / Region', placeholder: 'e.g., Miami, FL' },
          { name: 'offer' as const, label: 'Your Offer', placeholder: 'e.g., AI-powered appointment booking system' },
        ].map(({ name, label, placeholder }) => (
          <div key={name} className="space-y-2">
            <Label className="text-gray-300">{label}</Label>
            <Input {...register(name)} placeholder={placeholder}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
            {errors[name] && <p className="text-red-400 text-sm">{errors[name]?.message}</p>}
          </div>
        ))}
      </div>

      {/* --- Lead Source --- */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Where are your leads coming from?</h2>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setLeadSource('scraper')}
            className={`p-4 rounded-lg border text-left transition-colors ${
              leadSource === 'scraper' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'
            }`}>
            <Search size={20} className={leadSource === 'scraper' ? 'text-blue-400' : 'text-gray-400'} />
            <p className="text-white font-medium mt-2">Find leads for me</p>
            <p className="text-gray-400 text-sm mt-1">We scrape Google Maps for businesses in your niche</p>
          </button>
          <button type="button" onClick={() => setLeadSource('uploaded')}
            className={`p-4 rounded-lg border text-left transition-colors ${
              leadSource === 'uploaded' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'
            }`}>
            <Upload size={20} className={leadSource === 'uploaded' ? 'text-blue-400' : 'text-gray-400'} />
            <p className="text-white font-medium mt-2">I have my own leads</p>
            <p className="text-gray-400 text-sm mt-1">Upload CSV, paste from spreadsheet, or add manually</p>
          </button>
        </div>

        {/* BYOL Import Options */}
        {leadSource === 'uploaded' && (
          <Tabs defaultValue="csv" className="mt-4">
            <TabsList className="bg-gray-900 border border-gray-800">
              <TabsTrigger value="csv" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">
                <Upload size={14} className="mr-2" /> Upload CSV
              </TabsTrigger>
              <TabsTrigger value="paste" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">
                <ClipboardPaste size={14} className="mr-2" /> Paste
              </TabsTrigger>
              <TabsTrigger value="manual" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">
                <Plus size={14} className="mr-2" /> Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="mt-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="pt-6">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <p className="text-gray-400 text-sm">{csvFile ? csvFile.name : 'Click to upload CSV or drag and drop'}</p>
                    <p className="text-gray-500 text-xs mt-1">Must have an &quot;email&quot; column</p>
                    <input type="file" accept=".csv" className="hidden"
                      onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                  </label>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paste" className="mt-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="pt-6 space-y-2">
                  <Label className="text-gray-400 text-sm">Paste rows from Google Sheets or Excel</Label>
                  <textarea
                    value={pasteData}
                    onChange={e => setPasteData(e.target.value)}
                    placeholder={"email\tbusiness_name\tphone\njohn@acme.com\tAcme Corp\t555-1234"}
                    rows={6}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white text-sm p-3 placeholder:text-gray-500 font-mono"
                  />
                  <p className="text-gray-500 text-xs">Tab-separated or comma-separated. First row should be headers.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="pt-6 space-y-3">
                  {manualLeads.map((lead, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <Input value={lead.email} onChange={e => updateManualLead(i, 'email', e.target.value)}
                        placeholder="email@example.com" className="bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-500" />
                      <Input value={lead.business_name} onChange={e => updateManualLead(i, 'business_name', e.target.value)}
                        placeholder="Business name" className="bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-500" />
                      <Input value={lead.phone} onChange={e => updateManualLead(i, 'phone', e.target.value)}
                        placeholder="Phone (optional)" className="bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-500" />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addManualLead}
                    className="border-gray-700 text-gray-300 hover:text-white">
                    <Plus size={14} className="mr-1" /> Add another
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* --- Sender Selection --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Sending Accounts</h2>
          <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}
            className="border-gray-700 text-gray-300 hover:text-white text-xs">
            Select all visible
          </Button>
        </div>

        {loadingAccounts ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 size={16} className="animate-spin" /> Loading accounts from Instantly...
          </div>
        ) : accounts.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-6 text-center">
              <p className="text-gray-400">No sending accounts found. Connect your Instantly API key in Settings first.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tag filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      selectedTags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}>
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Account list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredAccounts.map(account => (
                <label key={account.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAccounts.includes(account.id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  } ${account.status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                    disabled={account.status !== 'active'}
                    className="rounded border-gray-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{account.email}</p>
                    {(account.tags || []).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {account.tags.map(t => (
                          <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    account.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    account.status === 'warmup' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>{account.status}</span>
                </label>
              ))}
            </div>
            <p className="text-gray-500 text-xs">{selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected</p>
          </>
        )}
      </div>

      {error && <p className="text-red-400">{error}</p>}
      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full" disabled={loading}>
        {loading ? <><Loader2 size={14} className="animate-spin mr-2" /> Creating campaign...</> : 'Launch Campaign'}
      </Button>
    </form>
  )
}
