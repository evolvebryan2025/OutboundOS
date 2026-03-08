'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(1, 'Campaign name required'),
  business_type: z.string().min(1, 'Business type required'),
  city: z.string().min(1, 'City required'),
  offer: z.string().min(1, 'Offer required'),
  pain_point: z.string().min(1, 'Pain point required'),
  outcome: z.string().min(1, 'Outcome required'),
})

type FormData = z.infer<typeof schema>

export function CampaignForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create campaign'); setLoading(false); return }
    router.push(`/dashboard/campaigns/${json.campaign.id}`)
  }

  const fields = [
    { name: 'name' as const, label: 'Campaign Name', placeholder: 'Miami Chiropractors Q1' },
    { name: 'business_type' as const, label: 'Business Type', placeholder: 'Chiropractors' },
    { name: 'city' as const, label: 'City / Region', placeholder: 'Miami, FL' },
    { name: 'offer' as const, label: 'Your Offer', placeholder: 'AI Sales Infrastructure System' },
    { name: 'pain_point' as const, label: 'Their Pain Point', placeholder: 'Losing patients to missed calls and slow follow-ups' },
    { name: 'outcome' as const, label: 'Promised Outcome', placeholder: 'Book 10+ new appointments per month on autopilot' },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {fields.map(({ name, label, placeholder }) => (
        <div key={name} className="space-y-2">
          <Label className="text-gray-300">{label}</Label>
          <Input {...register(name)} placeholder={placeholder}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
          {errors[name] && <p className="text-red-400 text-sm">{errors[name]?.message}</p>}
        </div>
      ))}
      {error && <p className="text-red-400">{error}</p>}
      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full" disabled={loading}>
        {loading ? 'Launching pipeline...' : '🚀 Create Campaign & Start Scraping'}
      </Button>
    </form>
  )
}
