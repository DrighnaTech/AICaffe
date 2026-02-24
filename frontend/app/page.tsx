'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, ArrowRight, Zap, Shield, Globe, BarChart3, MessageSquare,
  Search, Star, TrendingUp, Bot, Cpu, Image, Headphones, Video, Code,
  FileText, Layers, ChevronRight
} from 'lucide-react'

const STATS = [
  { label: 'AI Models', value: '200+', icon: Bot },
  { label: 'Providers', value: '22+', icon: Globe },
  { label: 'Use Cases', value: '50+', icon: Layers },
  { label: 'API Calls/Day', value: '1M+', icon: Zap },
]

const FEATURES = [
  {
    icon: Search, title: 'Discover & Compare',
    desc: 'Browse 200+ AI models from 22+ providers. Filter by type, price, speed, and benchmarks. Side-by-side comparisons.',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    icon: Sparkles, title: 'Smart Recommendations',
    desc: 'Tell us your use case and our engine recommends the best model. Audio, video, code, research — we cover it all.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: MessageSquare, title: 'Universal AI Assistant',
    desc: 'Chat with any AI model through one interface. Switch models mid-conversation. Compare responses side by side.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: BarChart3, title: 'One Token, All Models',
    desc: 'Buy AICaffe Tokens (ACT) once, use everywhere. Real-time exchange rates. Transparent 20% margin.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: TrendingUp, title: 'AI News & Intelligence',
    desc: 'Real-time AI news aggregated from 12+ sources. Provider updates, model releases, and industry insights.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Shield, title: 'Enterprise Ready',
    desc: 'Team wallets, API key management, usage analytics, vendor settlements, and SOC-2 compliance.',
    color: 'from-violet-500 to-purple-500',
  },
]

const USE_CASES = [
  { icon: FileText, name: 'Content Writing', models: 'GPT-4o, Claude, Gemini' },
  { icon: Code, name: 'Code Generation', models: 'Claude, GPT-4o, DeepSeek' },
  { icon: Image, name: 'Image Creation', models: 'DALL·E 3, Midjourney, Stable Diffusion' },
  { icon: Headphones, name: 'Audio & Voice', models: 'ElevenLabs, Whisper, Suno' },
  { icon: Video, name: 'Video Generation', models: 'Sora, Runway, Kling' },
  { icon: Search, name: 'Research & Analysis', models: 'Perplexity, Claude, GPT-4o' },
]

const TOP_MODELS = [
  { name: 'GPT-4o', provider: 'OpenAI', rating: 4.8, type: 'LLM', price: '$2.50/M' },
  { name: 'Claude Sonnet 4', provider: 'Anthropic', rating: 4.9, type: 'LLM', price: '$3.00/M' },
  { name: 'Gemini 2.0 Flash', provider: 'Google', rating: 4.7, type: 'Multimodal', price: '$0.075/M' },
  { name: 'Llama 3.3 70B', provider: 'Meta', rating: 4.6, type: 'LLM', price: 'Free/Open' },
  { name: 'DALL·E 3', provider: 'OpenAI', rating: 4.5, type: 'Image', price: '$0.04/img' },
  { name: 'Grok-2', provider: 'xAI', rating: 4.4, type: 'LLM', price: '$2.00/M' },
]

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="max-w-7xl mx-auto space-y-16">
      {/* Hero */}
      <section className="text-center py-12 space-y-6">
        <div className="inline-flex items-center gap-2 badge-purple px-4 py-1.5 text-sm">
          <Sparkles className="w-4 h-4" /> The Future of AI is Here
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          One Platform for{' '}
          <span className="gradient-text">Every AI Model</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Compare 200+ AI models from 22+ providers. Smart recommendations. Universal tokens.
          News aggregation. All in one beautiful interface.
        </p>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto relative mt-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search AI models, providers, or describe what you need..."
            className="input w-full pl-12 pr-32 py-4 text-lg rounded-2xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-xl">
            <span className="flex items-center gap-2">
              Find Models <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {['LLMs', 'Image Generation', 'Audio', 'Video', 'Code', 'Embeddings'].map((cat) => (
            <Link key={cat} href={`/models?type=${cat.toLowerCase()}`}
              className="btn-ghost text-sm border border-gray-800 rounded-full px-4 py-1.5">
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="card text-center">
            <stat.icon className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-3xl font-bold gradient-text">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-2">Everything You Need</h2>
        <p className="text-gray-400 text-center mb-8">One platform to discover, compare, and use every AI model</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card-hover group">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-2">Pick Your Purpose</h2>
        <p className="text-gray-400 text-center mb-8">Select your objective and we recommend the best model</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {USE_CASES.map((uc) => (
            <Link key={uc.name} href={`/recommendations?purpose=${uc.name}`}
              className="card-hover group flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <uc.icon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium group-hover:text-purple-400 transition-colors">{uc.name}</h4>
                <p className="text-gray-500 text-xs mt-1">{uc.models}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 ml-auto mt-1 group-hover:text-purple-400 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Top Models */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">Top Rated Models</h2>
            <p className="text-gray-400">Community-rated AI models across all categories</p>
          </div>
          <Link href="/models/leaderboard" className="btn-secondary flex items-center gap-2">
            View Leaderboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_MODELS.map((model, i) => (
            <div key={model.name} className="card-hover flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-bold text-sm">
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{model.name}</h4>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{model.provider}</span>
                  <span>•</span>
                  <span className="badge-blue text-[10px]">{model.type}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-sm font-medium">{model.rating}</span>
                </div>
                <span className="text-xs text-gray-500">{model.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Token CTA */}
      <section className="card glow-purple bg-gradient-to-br from-purple-900/40 to-pink-900/20 text-center py-12">
        <h2 className="text-3xl font-bold mb-3">One Token. Every AI Model.</h2>
        <p className="text-gray-300 max-w-xl mx-auto mb-6">
          Buy AICaffe Tokens (ACT) and use them with any AI provider. No separate accounts needed.
          Transparent pricing with real-time exchange rates.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg px-6 py-3 text-center">
            <div className="text-sm text-gray-400">Exchange Rate</div>
            <div className="text-lg font-bold text-white">1 USD = 20,000 ACT</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-6 py-3 text-center">
            <div className="text-sm text-gray-400">Platform Margin</div>
            <div className="text-lg font-bold text-white">20% Transparent</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-6 py-3 text-center">
            <div className="text-sm text-gray-400">Free Starter</div>
            <div className="text-lg font-bold text-white">10,000 ACT</div>
          </div>
        </div>
        <Link href="/tokens" className="btn-primary px-8 py-3 text-lg inline-flex items-center gap-2">
          <Zap className="w-5 h-5" /> Get Started Free
        </Link>
      </section>
    </div>
  )
}
