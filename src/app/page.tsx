import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap, Users, BarChart3, Mail } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Outbound OS</h1>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold leading-tight max-w-3xl mx-auto">
          Automate Your Outbound Sales <span className="text-blue-400">End to End</span>
        </h2>
        <p className="text-xl text-gray-400 mt-6 max-w-2xl mx-auto">
          Scrape local business leads from Google Maps, generate personalized email sequences with AI, and push them straight to Instantly — all on autopilot.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
              Start Free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:text-white text-lg px-8 py-6">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Users, title: 'Lead Scraping', desc: 'Scrape verified business leads from Google Maps by niche and city.' },
            { icon: Mail, title: 'AI Email Sequences', desc: 'Generate personalized 3-step email sequences with GPT, then humanize with StealthGPT.' },
            { icon: Zap, title: 'Instantly Integration', desc: 'Push leads and sequences directly into your Instantly campaigns.' },
            { icon: BarChart3, title: 'Analytics', desc: 'Track open rates, reply rates, and calls booked across all campaigns.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        Outbound OS &mdash; Sales Operating System
      </footer>
    </div>
  )
}
