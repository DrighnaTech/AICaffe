'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Coffee, Sparkles, Zap, Shield, Globe, ChevronRight, Check, Star,
  MessageSquare, Image as ImageIcon, Code, Mic, Video, Bot, ArrowRight,
  TrendingUp, Users, CreditCard, Clock, Heart, Menu, X, Play,
  Database, Cloud, Lock, Layers, BarChart3, HardDrive
} from 'lucide-react'

// Currency rates (would be fetched from API in production)
const CURRENCY_RATES: Record<string, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.79 },
  INR: { symbol: '₹', rate: 83.12 },
  AUD: { symbol: 'A$', rate: 1.53 },
  CAD: { symbol: 'C$', rate: 1.36 },
}

// Dynamic pricing with 40% margin target
const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals exploring AI',
    baseTokens: 500000,
    basePriceUSD: 19,
    storage: 1, // GB included
    features: [
      '500K AICaffe Tokens/month',
      'Access to 50+ AI models',
      'AI Assistant with GPT-4 & Claude',
      '1 GB CaffeSpace storage',
      'Standard support',
      'API access',
    ],
    highlighted: false,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'For professionals building with AI',
    baseTokens: 2500000,
    basePriceUSD: 79,
    storage: 5, // GB included
    features: [
      '2.5M AICaffe Tokens/month',
      'Access to ALL 200+ models',
      'Priority model access',
      '5 GB CaffeSpace storage',
      'Advanced analytics',
      'Priority support',
      'Custom system prompts',
      'Team sharing (up to 3)',
    ],
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'For teams and businesses',
    baseTokens: 10000000,
    basePriceUSD: 249,
    storage: 15, // GB included
    features: [
      '10M AICaffe Tokens/month',
      'All Explorer features',
      'Dedicated support',
      '15 GB CaffeSpace storage',
      'SSO & advanced security',
      'Custom integrations',
      'Usage analytics dashboard',
      'Team sharing (unlimited)',
      'SLA guarantee (99.9%)',
    ],
    highlighted: false,
  },
]

const PROVIDERS = [
  { name: 'OpenAI', logo: '🤖' },
  { name: 'Anthropic', logo: '🧠' },
  { name: 'Google', logo: '🔮' },
  { name: 'Meta', logo: '👁' },
  { name: 'Mistral', logo: '🌪' },
  { name: 'Cohere', logo: '🔗' },
  { name: 'Groq', logo: '⚡' },
  { name: 'DeepSeek', logo: '🔍' },
]

const STATS = [
  { value: '200+', label: 'AI Models' },
  { value: '22+', label: 'Providers' },
  { value: '99.9%', label: 'Uptime' },
  { value: '40%', label: 'Cost Savings' },
]

const USE_CASES = [
  { icon: MessageSquare, title: 'Chat & Assistants', desc: 'Build conversational AI' },
  { icon: Code, title: 'Code Generation', desc: 'Generate & debug code' },
  { icon: ImageIcon, title: 'Image Creation', desc: 'DALL-E, Midjourney, Flux' },
  { icon: Mic, title: 'Voice & Audio', desc: 'TTS & transcription' },
  { icon: Video, title: 'Video Generation', desc: 'Create videos with AI' },
  { icon: Bot, title: 'AI Agents', desc: 'Autonomous workflows' },
]

export default function LandingPage() {
  const router = useRouter()
  const [currency, setCurrency] = useState('USD')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  const formatPrice = (usdPrice: number) => {
    const { symbol, rate } = CURRENCY_RATES[currency]
    const converted = Math.round(usdPrice * rate)
    return `${symbol}${converted}`
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Coffee className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">AICaffe</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-gray-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="#models" className="text-gray-400 hover:text-white transition-colors">
                Models
              </Link>
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg font-medium hover:from-violet-500 hover:to-cyan-500 transition-all"
              >
                Start Free
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-800 bg-gray-900"
          >
            <div className="px-4 py-4 space-y-3">
              <Link href="#features" className="block py-2 text-gray-300">Features</Link>
              <Link href="#pricing" className="block py-2 text-gray-300">Pricing</Link>
              <Link href="#models" className="block py-2 text-gray-300">Models</Link>
              <Link href="/login" className="block py-2 text-gray-300">Sign In</Link>
              <Link
                href="/register"
                className="block w-full text-center py-3 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg font-medium"
              >
                Start Free
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Now with 200+ AI models from 22+ providers</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              One Platform for
              <span className="block bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                All AI Models
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-8">
              Access GPT-4, Claude, Gemini, Llama & 200+ models with a single API.
              Save up to 40% compared to direct subscriptions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl text-lg font-semibold hover:from-violet-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2"
              >
                Start Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 bg-gray-800 border border-gray-700 rounded-xl text-lg font-semibold hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Watch Demo
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                  <div className="text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Providers Marquee */}
      <section className="py-12 border-y border-gray-800 overflow-hidden">
        <div className="flex items-center gap-12 animate-marquee">
          {[...PROVIDERS, ...PROVIDERS].map((provider, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
              <span className="text-2xl">{provider.logo}</span>
              <span className="text-lg font-medium">{provider.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need for AI</h2>
            <p className="text-xl text-gray-400">
              One subscription, unlimited possibilities
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* AI Assistant */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl"
            >
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
              <p className="text-gray-400 mb-4">
                Chat with any model seamlessly. Switch between GPT-4, Claude, Gemini mid-conversation.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">GPT-4</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">Claude 3.5</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">Gemini 2</span>
              </div>
            </motion.div>

            {/* Universal Tokens */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-2xl"
            >
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Universal Tokens</h3>
              <p className="text-gray-400 mb-4">
                One token balance works across all models. No more juggling multiple subscriptions.
              </p>
              <div className="text-sm text-cyan-400">
                Save up to 40% vs direct subscriptions
              </div>
            </motion.div>

            {/* CaffeSpace Storage */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl"
            >
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">CaffeSpace Storage</h3>
              <p className="text-gray-400 mb-4">
                Cloud storage for your AI assets, conversations, and generated content. Powered by Azure.
              </p>
              <div className="text-sm text-green-400">
                1-15 GB included, scale as needed
              </div>
            </motion.div>

            {/* Model Comparison */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl"
            >
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Model Comparison</h3>
              <p className="text-gray-400">
                Compare up to 5 models side-by-side. Find the perfect model for your use case.
              </p>
            </motion.div>

            {/* Analytics */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl"
            >
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Usage Analytics</h3>
              <p className="text-gray-400">
                Track spending, optimize usage, and get insights across all your AI operations.
              </p>
            </motion.div>

            {/* Security */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl"
            >
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Enterprise Security</h3>
              <p className="text-gray-400">
                SOC 2 compliant, encrypted API keys, SSO, and audit logs for enterprise teams.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Built for Every Use Case</h2>
            <p className="text-xl text-gray-400">
              From chat to code to creative content
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {USE_CASES.map((uc) => (
              <motion.div
                key={uc.title}
                whileHover={{ y: -4, scale: 1.02 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-center cursor-pointer hover:border-violet-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <uc.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h4 className="font-medium text-white mb-1">{uc.title}</h4>
                <p className="text-xs text-gray-500">{uc.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-400 mb-8">
              Pay less than individual AI subscriptions. Cancel anytime.
            </p>

            {/* Currency Selector */}
            <div className="inline-flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
              {Object.keys(CURRENCY_RATES).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currency === c
                      ? 'bg-violet-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                className={`relative p-8 rounded-2xl ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-violet-500/20 to-gray-900 border-2 border-violet-500'
                    : 'bg-gray-900/50 border border-gray-800'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full text-sm font-medium">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">{formatPrice(plan.basePriceUSD)}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {(plan.baseTokens / 1000000).toFixed(1)}M tokens included
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/register?plan=${plan.id}`}
                  className={`block w-full py-3 rounded-xl font-medium text-center transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  Get Started
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CaffeSpace Storage Add-on */}
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <HardDrive className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">CaffeSpace Storage Add-on</h4>
                  <p className="text-gray-400 text-sm">Need more storage? Scale as you grow.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">1-5 GB</p>
                  <p className="text-green-400 font-medium">+{formatPrice(5)}/mo</p>
                </div>
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">5-10 GB</p>
                  <p className="text-green-400 font-medium">+{formatPrice(10)}/mo</p>
                </div>
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">10-15 GB</p>
                  <p className="text-green-400 font-medium">+{formatPrice(15)}/mo</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                +{formatPrice(5)} for each additional 5 GB. Powered by Azure Blob Storage.
              </p>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Compare: ChatGPT Plus ($20) + Claude Pro ($20) + Midjourney ($10) = $50/month
            </p>
            <p className="text-xl text-white font-medium">
              AICaffe Explorer gives you ALL of them + more for just {formatPrice(79)}/month
            </p>
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section id="models" className="py-20 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">200+ Models, One API</h2>
          <p className="text-xl text-gray-400 mb-12">
            Access the best AI models from every major provider
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { name: 'GPT-4o', provider: 'OpenAI', type: 'Language' },
              { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'Language' },
              { name: 'Gemini 2.0 Flash', provider: 'Google', type: 'Multimodal' },
              { name: 'Llama 3.3 70B', provider: 'Meta', type: 'Open Source' },
              { name: 'DALL-E 3', provider: 'OpenAI', type: 'Image' },
              { name: 'Flux Pro', provider: 'Black Forest', type: 'Image' },
              { name: 'DeepSeek V3', provider: 'DeepSeek', type: 'Efficient' },
              { name: 'o1-preview', provider: 'OpenAI', type: 'Reasoning' },
            ].map((model) => (
              <div key={model.name} className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <p className="font-medium text-white">{model.name}</p>
                <p className="text-sm text-gray-500">{model.provider}</p>
                <span className="inline-block mt-2 px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs">
                  {model.type}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/models"
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300"
          >
            View all 200+ models <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to supercharge your AI workflow?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of developers and businesses using AICaffe
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl text-lg font-semibold hover:from-violet-500 hover:to-cyan-500 transition-all"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-8 py-4 bg-gray-800 border border-gray-700 rounded-xl text-lg font-semibold hover:bg-gray-700 transition-all"
            >
              Contact Sales
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required. 10,000 free tokens to start.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">AICaffe</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-xs">
                One platform for all AI models. Access 200+ models from 22+ providers with universal tokens.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/models" className="hover:text-white">Models</Link></li>
                <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-white">API Docs</Link></li>
                <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-800">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} AICaffe by DataCaffe.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="https://twitter.com/aicaffe" className="text-gray-400 hover:text-white">
                Twitter
              </a>
              <a href="https://github.com/datacaffe" className="text-gray-400 hover:text-white">
                GitHub
              </a>
              <a href="https://discord.gg/aicaffe" className="text-gray-400 hover:text-white">
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Marquee Animation Styles */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  )
}
