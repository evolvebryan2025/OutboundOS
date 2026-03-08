'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS, TOPUP_PACKS } from '@/lib/plans'
import { Check } from 'lucide-react'

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(planKey: string) {
    setLoading(planKey)
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  async function handleTopup(index: number) {
    setLoading(`topup-${index}`)
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topupIndex: index }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  async function handlePortal() {
    setLoading('portal')
    const res = await fetch('/api/stripe/create-portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-gray-400">Manage your subscription and credits</p>
        </div>
        <Button variant="outline" onClick={handlePortal} disabled={loading === 'portal'}
          className="border-gray-700 text-gray-300 hover:text-white">
          {loading === 'portal' ? 'Loading...' : 'Manage Subscription'}
        </Button>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PLANS).map(([key, plan]) => (
            <Card key={key} className={`bg-gray-900 border-gray-800 ${key === 'growth' ? 'border-blue-500' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">{plan.name}</CardTitle>
                  {key === 'growth' && <Badge className="bg-blue-600 text-white text-xs">Popular</Badge>}
                </div>
                <p className="text-3xl font-bold text-white">${plan.price}<span className="text-sm text-gray-400">/mo</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check size={14} className="text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleCheckout(key)}
                  disabled={loading === key}>
                  {loading === key ? 'Loading...' : `Get ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Top-up packs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Credit Top-Up Packs</h2>
        <p className="text-gray-400 text-sm mb-4">No expiry. Rollover up to 60 days.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TOPUP_PACKS.map((pack, i) => (
            <Card key={i} className="bg-gray-900 border-gray-800">
              <CardContent className="pt-6 space-y-3 text-center">
                <p className="text-2xl font-bold text-white">{pack.leads.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">leads</p>
                <p className="text-xl font-semibold text-green-400">${pack.price}</p>
                <Button className="w-full bg-gray-700 hover:bg-gray-600 text-white" onClick={() => handleTopup(i)}
                  disabled={loading === `topup-${i}`}>
                  {loading === `topup-${i}` ? 'Loading...' : 'Buy Now'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
