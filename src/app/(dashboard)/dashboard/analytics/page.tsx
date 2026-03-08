import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Try to fetch analytics if the table exists
  let analyticsMap: Record<string, { open_rate: number | null; reply_rate: number | null; bounce_rate: number | null; emails_sent: number; calls_booked: number }> = {}
  try {
    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('*')
      .eq('user_id', user.id)

    if (analytics) {
      for (const a of analytics) {
        analyticsMap[a.campaign_id] = a
      }
    }
  } catch {
    // Table may not exist yet
  }

  const activeCampaigns = campaigns?.filter(c => ['active', 'completed'].includes(c.status)) ?? []
  const totalEmails = Object.values(analyticsMap).reduce((sum, a) => sum + (a.emails_sent || 0), 0)
  const totalBooked = Object.values(analyticsMap).reduce((sum, a) => sum + (a.calls_booked || 0), 0)

  const avgOpenRate = Object.values(analyticsMap).length > 0
    ? Object.values(analyticsMap).reduce((sum, a) => sum + (a.open_rate || 0), 0) / Object.values(analyticsMap).length
    : null

  const avgReplyRate = Object.values(analyticsMap).length > 0
    ? Object.values(analyticsMap).reduce((sum, a) => sum + (a.reply_rate || 0), 0) / Object.values(analyticsMap).length
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400">Track campaign performance and email metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Emails Sent</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{totalEmails.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Avg Open Rate</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-400">{avgOpenRate !== null ? `${avgOpenRate.toFixed(1)}%` : '--'}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Avg Reply Rate</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-400">{avgReplyRate !== null ? `${avgReplyRate.toFixed(1)}%` : '--'}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Calls Booked</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-purple-400">{totalBooked}</p></CardContent>
        </Card>
      </div>

      {activeCampaigns.length > 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-white">Campaign Performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Campaign</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 text-right">Leads</TableHead>
                  <TableHead className="text-gray-400 text-right">Emails Sent</TableHead>
                  <TableHead className="text-gray-400 text-right">Open Rate</TableHead>
                  <TableHead className="text-gray-400 text-right">Reply Rate</TableHead>
                  <TableHead className="text-gray-400 text-right">Calls Booked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCampaigns.map(c => {
                  const a = analyticsMap[c.id]
                  return (
                    <TableRow key={c.id} className="border-gray-800">
                      <TableCell className="text-white font-medium">{c.name}</TableCell>
                      <TableCell className="text-gray-300 capitalize">{c.status}</TableCell>
                      <TableCell className="text-white text-right">{(c.leads_pushed || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-white text-right">{a ? a.emails_sent.toLocaleString() : '--'}</TableCell>
                      <TableCell className="text-white text-right">{a?.open_rate != null ? `${a.open_rate.toFixed(1)}%` : '--'}</TableCell>
                      <TableCell className="text-white text-right">{a?.reply_rate != null ? `${a.reply_rate.toFixed(1)}%` : '--'}</TableCell>
                      <TableCell className="text-white text-right">{a ? a.calls_booked : '--'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-20 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400 text-lg">No analytics data yet</p>
          <p className="text-gray-500 text-sm mt-2">Analytics will appear once campaigns are active and sending emails</p>
        </div>
      )}
    </div>
  )
}
