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

type IntegrationKey = 'instantly'
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

type ReacherTestStatus = 'idle' | 'testing' | 'success' | 'error'

interface ReacherResult {
  is_reachable: string
  can_connect_smtp: boolean
  is_disposable: boolean
  is_role_account: boolean
  has_mx_records: boolean
}

function ResultRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
      <span className="text-gray-400">{label}</span>
      <span className={good ? 'text-green-400' : 'text-red-400'}>{value}</span>
    </div>
  )
}

function ReacherTestCard() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<ReacherTestStatus>('idle')
  const [result, setResult] = useState<ReacherResult | null>(null)
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)

  async function handleTest() {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      setStatus('error')
      return
    }

    setStatus('testing')
    setError('')
    setResult(null)
    setIsValid(null)

    try {
      const res = await fetch('/api/settings/test-reacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus('success')
        setResult(data.details)
        setIsValid(data.is_valid)
      } else {
        setStatus('error')
        setError(data.error || 'Verification failed')
      }
    } catch {
      setStatus('error')
      setError('Could not reach the verification service')
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-white text-base">Email Verification (Reacher)</CardTitle>
              <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">Infrastructure</Badge>
            </div>
            <CardDescription className="text-gray-400 mt-1 text-sm">
              Test SMTP-level email verification. Checks deliverability, disposable status, and MX records.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-400 text-xs">Email address to verify</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="test@example.com"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600"
              onKeyDown={e => e.key === 'Enter' && handleTest()}
            />
            <Button
              onClick={handleTest}
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:text-white shrink-0"
              disabled={status === 'testing' || !email.trim()}
            >
              {status === 'testing' ? <Loader2 size={14} className="animate-spin" /> : 'Test'}
            </Button>
          </div>
          <p className="text-gray-500 text-xs">
            Sends a live SMTP check via Reacher. Takes 5-15 seconds.
          </p>
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-500/10 text-red-400">
            <XCircle size={14} />
            {error}
          </div>
        )}

        {status === 'testing' && (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-blue-500/10 text-blue-400">
            <Loader2 size={14} className="animate-spin" />
            Verifying email via SMTP... this may take up to 30 seconds
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
              isValid ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              {isValid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {isValid
                ? 'This email would pass verification in a campaign'
                : 'This email would be filtered out during a campaign'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ResultRow label="Reachable" value={result.is_reachable} good={result.is_reachable === 'safe'} />
              <ResultRow label="SMTP Connect" value={result.can_connect_smtp ? 'Yes' : 'No'} good={result.can_connect_smtp} />
              <ResultRow label="Disposable" value={result.is_disposable ? 'Yes' : 'No'} good={!result.is_disposable} />
              <ResultRow label="MX Records" value={result.has_mx_records ? 'Yes' : 'No'} good={result.has_mx_records} />
              <ResultRow label="Role Account" value={result.is_role_account ? 'Yes' : 'No'} good={!result.is_role_account} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Record<string, string | null>>({})
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: { profile?: Record<string, string | null> }) => {
      if (d.profile) {
        setProfile(d.profile)
        setFullName((d.profile.full_name as string) || '')
      }
    }).catch(() => {}).finally(() => setLoading(false))
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
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

          <Separator className="bg-gray-800" />
          <div>
            <h3 className="text-white text-sm font-medium mb-1">Infrastructure Tests</h3>
            <p className="text-gray-500 text-xs mb-3">
              These services run on your backend — no API key needed.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ReacherTestCard />
            </div>
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
