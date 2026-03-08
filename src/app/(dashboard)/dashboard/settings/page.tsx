'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react'

type IntegrationKey = 'instantly' | 'stealthgpt' | 'apify' | 'resend'
type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface Integration {
  id: IntegrationKey
  label: string
  description: string
  docsUrl: string
  field: string
  placeholder: string
  helpText: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'instantly',
    label: 'Instantly AI',
    description: 'Send cold email campaigns. Required — bring your own Instantly account (Hypergrowth $97/mo).',
    docsUrl: 'https://app.instantly.ai/app/settings/integrations',
    field: 'instantly_api_key',
    placeholder: 'inst_xxxxxxxxxxxxxxxx',
    helpText: 'Find it in Instantly AI → Settings → Integrations → API Key',
  },
  {
    id: 'stealthgpt',
    label: 'StealthGPT',
    description: 'Humanize AI-generated emails so they pass AI detectors and feel natural.',
    docsUrl: 'https://stealthgpt.ai/dashboard',
    field: 'stealth_gpt_api_key',
    placeholder: 'sgpt_xxxxxxxxxxxxxxxx',
    helpText: 'Find it in StealthGPT → Dashboard → API Keys',
  },
  {
    id: 'apify',
    label: 'Apify',
    description: 'Scrape Google Maps for local business leads. Leave blank to use the platform shared key.',
    docsUrl: 'https://console.apify.com/account/integrations',
    field: 'apify_api_token',
    placeholder: 'apify_api_xxxxxxxxxxxxxxxx',
    helpText: 'Optional. Find it in Apify Console → Settings → Integrations',
  },
  {
    id: 'resend',
    label: 'Resend',
    description: 'Transactional email for account notifications and alerts.',
    docsUrl: 'https://resend.com/api-keys',
    field: 'resend_api_key',
    placeholder: 're_xxxxxxxxxxxxxxxx',
    helpText: 'Optional. Find it in Resend → API Keys',
  },
]

function IntegrationCard({
  integration,
  savedValue,
  onSave,
}: {
  integration: Integration
  savedValue: string | null
  onSave: (field: string, value: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')

  const isConnected = !!savedValue

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    await onSave(integration.field, value.trim())
    setValue('')
    setSaving(false)
  }

  async function handleTest() {
    const keyToTest = value.trim() || savedValue
    if (!keyToTest || keyToTest.startsWith('••••')) {
      setTestMessage('Enter the full key first to test it')
      setTestStatus('error')
      return
    }
    setTestStatus('testing')
    setTestMessage('')
    const res = await fetch('/api/settings/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integration: integration.id, apiKey: value.trim() || keyToTest }),
    })
    const data = await res.json() as { success: boolean; message: string }
    setTestStatus(data.success ? 'success' : 'error')
    setTestMessage(data.message)
  }

  async function handleDisconnect() {
    setSaving(true)
    await onSave(integration.field, '')
    setValue('')
    setTestStatus('idle')
    setTestMessage('')
    setSaving(false)
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-white text-base">{integration.label}</CardTitle>
              {isConnected
                ? <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">Connected</Badge>
                : <Badge className="bg-gray-700 text-gray-400 border-0 text-xs">Not connected</Badge>
              }
            </div>
            <CardDescription className="text-gray-400 mt-1 text-sm">{integration.description}</CardDescription>
          </div>
          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 mt-1">
            <ExternalLink size={14} />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-gray-300 text-sm font-mono flex-1 truncate">{savedValue}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-gray-400 text-xs">{isConnected ? 'Replace API key' : 'API key'}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={integration.placeholder}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 pr-10"
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Button onClick={handleTest} variant="outline" size="sm"
              className="border-gray-700 text-gray-300 hover:text-white shrink-0"
              disabled={testStatus === 'testing' || (!value && !isConnected)}>
              {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : 'Test'}
            </Button>
          </div>
          <p className="text-gray-500 text-xs">{integration.helpText}</p>
        </div>

        {testStatus !== 'idle' && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            testStatus === 'success' ? 'bg-green-500/10 text-green-400' :
            testStatus === 'testing' ? 'bg-blue-500/10 text-blue-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            {testStatus === 'success' && <CheckCircle2 size={14} />}
            {testStatus === 'error' && <XCircle size={14} />}
            {testStatus === 'testing' && <Loader2 size={14} className="animate-spin" />}
            {testMessage || 'Testing connection...'}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!value.trim() || saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            {isConnected ? 'Update key' : 'Save key'}
          </Button>
          {isConnected && (
            <Button onClick={handleDisconnect} variant="outline" disabled={saving}
              className="border-gray-700 text-red-400 hover:text-red-300 hover:bg-red-500/10">
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Record<string, string | null>>({})
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: { profile: Record<string, string | null> }) => {
      setProfile(d.profile)
      setFullName((d.profile.full_name as string) || '')
    })
  }, [])

  async function saveField(field: string, value: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    // Refresh masked values
    const res = await fetch('/api/settings')
    const data = await res.json() as { profile: Record<string, string | null> }
    setProfile(data.profile)
  }

  async function saveProfile() {
    setSavingProfile(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName }),
    })
    setSavingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400">Manage your profile and API integrations</p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="integrations" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-300">
            <strong>How it works:</strong> Each key is encrypted and stored in your account. Keys are masked after saving — you&apos;ll only see the last 4 characters.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {INTEGRATIONS.map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                savedValue={profile[integration.field] ?? null}
                onSave={saveField}
              />
            ))}
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800 max-w-lg">
            <CardHeader>
              <CardTitle className="text-white text-base">Profile</CardTitle>
              <CardDescription className="text-gray-400">Your name and account info</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input value={profile.email || ''} disabled
                  className="bg-gray-800 border-gray-700 text-gray-500" />
                <p className="text-gray-500 text-xs">Email cannot be changed here</p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your name" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-400">Plan</p>
                  <p className="text-white capitalize font-medium">{profile.plan || 'Starter'}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400">Credits remaining</p>
                  <p className="text-white font-medium">{Number(profile.credits_remaining || 0).toLocaleString()}</p>
                </div>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile} className="w-full bg-blue-600 hover:bg-blue-700">
                {savingProfile ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                {profileSaved ? '✓ Saved' : 'Save changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
