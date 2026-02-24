'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Coffee, Sparkles } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600/20 via-gray-900 to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Coffee className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">AICaffe</span>
          </Link>

          <div className="max-w-md">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-bold text-white mb-6"
            >
              One Platform for All AI Models
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-400 mb-8"
            >
              Access 200+ AI models from 22+ providers with a single API. Compare, discover, and deploy AI at scale.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { label: 'AI Providers', value: '22+' },
                { label: 'AI Models', value: '200+' },
                { label: 'Use Cases', value: '21+' },
                { label: 'API Uptime', value: '99.9%' },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-800/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Powered by GPT-4, Claude, Gemini, and more</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AICaffe</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
