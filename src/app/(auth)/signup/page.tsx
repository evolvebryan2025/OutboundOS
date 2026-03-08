'use client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  if (done) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-2xl">📬</p>
          <p className="text-white font-medium">Check your email</p>
          <p className="text-gray-400 text-sm">We sent a confirmation link to <strong>{email}</strong></p>
          <Link href="/login" className="text-blue-400 hover:underline text-sm">Back to sign in</Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Create account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Bryan" className="bg-gray-800 border-gray-700 text-white" required />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white" required />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white" required minLength={8} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <p className="text-center text-gray-400 text-sm">
            Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
