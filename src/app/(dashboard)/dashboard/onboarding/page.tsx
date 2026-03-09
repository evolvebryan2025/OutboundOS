'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS } from '@/lib/plans'
import { Check, CheckCircle2, XCircle, Loader2, ArrowRight, Zap } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1: Plan selection
  const [planLoading, setPlanLoading] = useState<string | null>(null)

  // Step 2: Instantly key
  const [instantlyKey, setInstantlyKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  // Step 3: First campaign
  const [businessType, setBusinessType] = useState('')
  const [city, setCity] = useState('')
  const [offer, setOffer] = useState('')
  const [creating, setCreating] = useState(false)
  const [campaignError, setCampaignError] = useState('')

  // Check if user already has a plan (returning from Stripe checkout)
  const checkPlanStatus = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    if (data.profile?.plan && data.profile.plan !== 'starter') {
      setStep(2)
    }
    if (data.profile?.instantly_api_key) {
      setStep(3)
    }
    if (data.profile?.onboarding_complete) {
      router.push('/dashboard')
    }
  }, [router])

  useEffect(() => { checkPlanStatus() }, [checkPlanStatus])

  async function handlePlanSelect(planKey: string) {
    setPlanLoading(planKey)
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setPlanLoading(null)
  }

  async function handleTestKey() {
    if (!instantlyKey.trim()) return
    setTestStatus('testing')
    setTestMessage('')
    const res = await fetch('/api/settings/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integration: 'instantly', apiKey: instantlyKey.trim() }),
    })
    const data = await res.json()
    setTestStatus(data.success ? 'success' : 'error')
    setTestMessage(data.message)
  }

  async function handleSaveKey() {
    if (!instantlyKey.trim() || testStatus !== 'success') return
    setSavingKey(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instantly_api_key: instantlyKey.trim() }),
    })
    setSavingKey(false)
    setStep(3)
  }

  async function handleCreateCampaign() {
    if (!businessType.trim() || !city.trim() || !offer.trim()) {
      setCampaignError('All fields are required')
      return
    }
    setCreating(true)
    setCampaignError('')

    const now = new Date()
    const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const name = `${city} ${businessType} - ${monthYear}`

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        business_type: businessType,
        city,
        offer,
        lead_source: 'scraper',
        sending_accounts: [],
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setCampaignError(json.error || 'Failed to create campaign')
      setCreating(false)
      return
    }

    // Mark onboarding complete
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_complete: true }),
    })

    router.push(`/dashboard/campaigns/${json.campaign.id}`)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step ? 'bg-green-600 text-white' :
                s === step ? 'bg-blue-600 text-white' :
                'bg-gray-800 text-gray-500'
              }`}>
                {s < step ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-0.5 ${s < step ? 'bg-green-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Pick Plan */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Choose your plan</h1>
              <p className="text-gray-400 mt-1">Step 1 of 3</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(PLANS).map(([key, plan]) => (
                <Card key={key} className={`bg-gray-900 border-gray-800 cursor-pointer transition-colors hover:border-gray-600 ${
                  key === 'growth' ? 'border-blue-500' : ''
                }`}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold">{plan.name}</h3>
                      {key === 'growth' && <Badge className="bg-blue-600 text-white text-xs">Popular</Badge>}
                    </div>
                    <p className="text-3xl font-bold text-white">${plan.price}<span className="text-sm text-gray-400">/mo</span></p>
                    <ul className="space-y-2">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                          <Check size={14} className="text-green-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handlePlanSelect(key)}
                      disabled={planLoading === key}>
                      {planLoading === key ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                      Get {plan.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Connect Instantly */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Connect Instantly AI</h1>
              <p className="text-gray-400 mt-1">Step 2 of 3 — This is the only integration you need</p>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Instantly API Key</Label>
                  <Input value={instantlyKey} onChange={e => setInstantlyKey(e.target.value)}
                    placeholder="inst_xxxxxxxxxxxxxxxx" type="password"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                  <p className="text-gray-500 text-xs">
                    Find it in Instantly &rarr; Settings &rarr; Integrations &rarr; API Key
                  </p>
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
                  <Button variant="outline" onClick={handleTestKey} disabled={!instantlyKey.trim() || testStatus === 'testing'}
                    className="border-gray-700 text-gray-300 hover:text-white">
                    {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                    Test Connection
                  </Button>
                  <Button onClick={handleSaveKey} disabled={testStatus !== 'success' || savingKey}
                    className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {savingKey ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                    Save & Continue <ArrowRight size={14} className="ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Create First Campaign */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Create your first campaign</h1>
              <p className="text-gray-400 mt-1">Step 3 of 3 — Just 3 fields, AI handles the rest</p>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Business Type</Label>
                  <Input value={businessType} onChange={e => setBusinessType(e.target.value)}
                    placeholder="e.g., Chiropractors, Dentists, Plumbers"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">City / Region</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)}
                    placeholder="e.g., Miami, FL"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Your Offer</Label>
                  <Input value={offer} onChange={e => setOffer(e.target.value)}
                    placeholder="e.g., AI-powered appointment booking system"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-300">
                  <Zap size={14} className="inline mr-1" />
                  AI will automatically generate the campaign name, pain point, and outcome based on your inputs.
                </div>

                {campaignError && <p className="text-red-400 text-sm">{campaignError}</p>}

                <Button onClick={handleCreateCampaign} disabled={creating}
                  className="w-full bg-blue-600 hover:bg-blue-700">
                  {creating ? <><Loader2 size={14} className="animate-spin mr-2" /> Creating campaign...</> : 'Launch Campaign'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
