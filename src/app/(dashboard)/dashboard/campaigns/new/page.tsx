import { CampaignForm } from '@/components/campaigns/CampaignForm'

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">New Campaign</h1>
        <p className="text-gray-400">Fill in the details and we&apos;ll scrape leads + write your sequence automatically</p>
      </div>
      <CampaignForm />
    </div>
  )
}
