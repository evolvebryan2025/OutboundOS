import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: campaigns } = await supabase
    .from('campaigns').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Welcome back, {profile?.full_name || user.email}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Credits Remaining</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{profile?.credits_remaining?.toLocaleString() || 0}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Active Campaigns</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{campaigns?.filter(c => c.status === 'active').length || 0}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Plan</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-400 capitalize">{profile?.plan || 'Starter'}</p></CardContent>
        </Card>
      </div>
      {campaigns && campaigns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Campaigns</h2>
          <div className="space-y-3">
            {campaigns.map(c => (
              <Card key={c.id} className="bg-gray-900 border-gray-800">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-white font-medium">{c.name}</p>
                    <p className="text-gray-400 text-sm">{c.business_type} · {c.city}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    c.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    c.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>{c.status}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
