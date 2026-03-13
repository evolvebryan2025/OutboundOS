'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS, TOPUP_PACKS } from '@/lib/plans'
import { Check, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react'
import type { Profile } from '@/lib/supabase/types'

type PlanKey = keyof typeof PLANS

const ERROR_MESSAGES: Record<string, string> = {
  missing_order: 'PayPal order was not found. Please try again.',
  capture_failed: 'Payment capture failed. Please try again or contact support.',
  not_completed: 'Payment was not completed. Please try again.',
  no_custom_id: 'Payment reference was missing. Please contact support.',
  invalid_pack: 'Invalid credit pack. Please try again.',
  credit_update_failed: 'Credits could not be updated. Please contact support.',
  internal: 'Something went wrong. Please try again later.',
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setProfile(data.profile)
        }
      } catch {
        // Profile fetch failed — page still usable
      } finally {
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const currentPlan = (profile?.plan ?? 'starter') as PlanKey
  const hasActiveSubscription = Boolean(profile?.paypal_subscription_id)

  async function handleCheckout(planKey: string) {
    setLoading(planKey)
    try {
      const res = await fetch('/api/paypal/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoading(null)
    } catch {
      setLoading(null)
    }
  }

  async function handleTopup(index: number) {
    setLoading(`topup-${index}`)
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topupIndex: index }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoading(null)
    } catch {
      setLoading(null)
    }
  }

  async function handleCancelSubscription() {
    if (!cancelConfirm) {
      setCancelConfirm(true)
      return
    }
    setLoading('cancel')
    try {
      const res = await fetch('/api/paypal/cancel-subscription', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCancelSuccess(true)
        setCancelConfirm(false)
        setProfile(prev => prev ? {
          ...prev,
          plan: 'starter' as const,
          paypal_subscription_id: null,
          credits_remaining: 15000,
          credits_monthly: 15000,
        } : null)
      }
    } catch {
      // Cancel failed
    } finally {
      setLoading(null)
      setCancelConfirm(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Success / Error banners */}
      {successParam === 'true' && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <p className="text-sm text-green-300">Payment successful! Your credits have been added.</p>
        </div>
      )}
      {errorParam && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{ERROR_MESSAGES[errorParam] ?? 'An unknown error occurred.'}</p>
        </div>
      )}
      {cancelSuccess && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-300">Subscription cancelled. You've been moved to the Starter plan.</p>
        </div>
      )}

      {/* Header + current plan summary */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-gray-400">Manage your subscription and credits</p>
        </div>
        {hasActiveSubscription && (
          <Button
            variant="outline"
            onClick={handleCancelSubscription}
            disabled={loading === 'cancel'}
            className={`border-gray-700 ${cancelConfirm ? 'text-red-400 hover:text-red-300 border-red-500/50' : 'text-gray-300 hover:text-white'}`}
          >
            {loading === 'cancel' ? 'Cancelling...' : cancelConfirm ? 'Confirm Cancel?' : 'Cancel Subscription'}
          </Button>
        )}
      </div>

      {/* Current plan + credits card */}
      {!profileLoading && profile && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-6">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Current Plan</p>
                <p className="text-lg font-semibold text-white capitalize">{currentPlan}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-gray-700 hidden sm:block" />
            <div>
              <p className="text-sm text-gray-400">Credits Remaining</p>
              <p className="text-lg font-semibold text-white">
                {profile.credits_remaining.toLocaleString()}
                <span className="text-sm text-gray-500 font-normal"> / {profile.credits_monthly.toLocaleString()} monthly</span>
              </p>
            </div>
            <div className="h-8 w-px bg-gray-700 hidden sm:block" />
            <div>
              <p className="text-sm text-gray-400">Subscription</p>
              <p className="text-lg font-semibold">
                {hasActiveSubscription
                  ? <span className="text-green-400">Active</span>
                  : <span className="text-gray-500">None</span>
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PLANS).map(([key, plan]) => {
            const isCurrent = key === currentPlan
            const isPopular = key === 'growth'
            return (
              <Card key={key} className={`bg-gray-900 border-gray-800 ${isPopular ? 'border-blue-500' : ''} ${isCurrent ? 'ring-1 ring-green-500/50' : ''}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{plan.name}</CardTitle>
                    <div className="flex gap-1.5">
                      {isCurrent && <Badge className="bg-green-600/20 text-green-400 text-xs border border-green-500/30">Current</Badge>}
                      {isPopular && <Badge className="bg-blue-600 text-white text-xs">Popular</Badge>}
                    </div>
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
                  <Button
                    className={`w-full ${isCurrent ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    onClick={() => handleCheckout(key)}
                    disabled={loading === key || isCurrent}
                  >
                    {isCurrent ? 'Current Plan' : loading === key ? 'Loading...' : `Get ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
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
