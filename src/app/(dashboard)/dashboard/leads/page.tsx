import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const totalScraped = campaigns?.reduce((sum, c) => sum + (c.leads_scraped || 0), 0) ?? 0
  const totalVerified = campaigns?.reduce((sum, c) => sum + (c.leads_verified || 0), 0) ?? 0
  const totalPushed = campaigns?.reduce((sum, c) => sum + (c.leads_pushed || 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-gray-400">Overview of all leads across your campaigns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Total Scraped</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{totalScraped.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Verified</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-400">{totalVerified.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-gray-300 text-sm">Pushed to Instantly</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-400">{totalPushed.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-white">Leads by Campaign</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Campaign</TableHead>
                  <TableHead className="text-gray-400">Business Type</TableHead>
                  <TableHead className="text-gray-400">City</TableHead>
                  <TableHead className="text-gray-400 text-right">Scraped</TableHead>
                  <TableHead className="text-gray-400 text-right">Verified</TableHead>
                  <TableHead className="text-gray-400 text-right">Pushed</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id} className="border-gray-800">
                    <TableCell className="text-white font-medium">{c.name}</TableCell>
                    <TableCell className="text-gray-300">{c.business_type}</TableCell>
                    <TableCell className="text-gray-300">{c.city}</TableCell>
                    <TableCell className="text-white text-right">{(c.leads_scraped || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-white text-right">{(c.leads_verified || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-white text-right">{(c.leads_pushed || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-xs ${
                        c.status === 'active' ? 'bg-green-500/20 text-green-400 border-0' :
                        c.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-0' :
                        'bg-gray-500/20 text-gray-400 border-0'
                      }`}>{c.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-20 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400 text-lg">No leads yet</p>
          <p className="text-gray-500 text-sm mt-2">Create a campaign to start scraping leads</p>
        </div>
      )}
    </div>
  )
}
