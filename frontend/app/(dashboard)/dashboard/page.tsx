'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Coins, MessageSquare, Bot, Zap, TrendingUp, ArrowUpRight, ArrowDownRight,
  Clock, Star, ChevronRight, Sparkles, BarChart3, Cloud,
  Code2, FlaskConical, PenTool, Search
} from 'lucide-react'
import { tokensApi, billingApi, assistantApi, modelsApi } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { formatNumber, formatCurrency, formatRelativeTime, tokensToUsd, getModelTypeLabel } from '@/lib/utils'
import type { AIModel, Conversation, TokenTransaction, UsageSummary } from '@/lib/types'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const balance = useWalletStore((s) => s.balance)
  const setBalance = useWalletStore((s) => s.setBalance)

  // Fetch wallet
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => tokensApi.wallet(),
  })

  // Fetch recent transactions
  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => tokensApi.transactions({ limit: 5 }),
    retry: false,
    throwOnError: false,
  })

  // Fetch usage summary
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: () => billingApi.usage({ period: 'month' }),
    retry: false,
    throwOnError: false,
  })

  // Fetch recent conversations
  const { data: conversationsData, isLoading: convsLoading } = useQuery({
    queryKey: ['recent-conversations'],
    queryFn: () => assistantApi.conversations({ limit: 5 }),
  })

  // Fetch featured models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['featured-models'],
    queryFn: () => modelsApi.list({ is_featured: true, limit: 4 }),
  })

  const wallet = walletData?.data?.wallet || walletData?.data
  const transactions: TokenTransaction[] = useMemo(
    () => transactionsData?.data?.transactions || transactionsData?.data?.items || [],
    [transactionsData]
  )
  const usage: UsageSummary | undefined = usageData?.data
  const conversations: Conversation[] = useMemo(
    () => conversationsData?.data?.conversations || conversationsData?.data?.items || [],
    [conversationsData]
  )
  const featuredModels: AIModel[] = useMemo(
    () => modelsData?.data?.models || modelsData?.data?.items || [],
    [modelsData]
  )

  // Sync wallet balance
  if (wallet && wallet.balance !== balance) {
    setBalance(wallet.balance)
  }

  const statsLoading = walletLoading || usageLoading

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your AI usage today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ai-hub"
            className="flex items-center gap-2 px-3.5 py-2 rounded-button bg-white/[0.04] border border-white/[0.06] text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            Explore AI Hub
          </Link>
          <Link
            href="/assistant"
            className="flex items-center gap-2 px-3.5 py-2 rounded-button bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium shadow-glow-sm hover:shadow-glow-md transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            New Chat
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Token Balance */}
          <Card variant="stat" accent="violet" padding="md" hover>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Token Balance</span>
              <div className="p-1.5 bg-violet-500/10 rounded-lg">
                <Coins className="w-4 h-4 text-violet-400" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white tracking-tight">
              {wallet ? formatNumber(wallet.balance) : '0'}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-600">
                {wallet ? formatCurrency(tokensToUsd(wallet.balance)) : '$0.00'}
              </span>
              <Link href="/tokens" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                Buy more
              </Link>
            </div>
          </Card>

          {/* API Calls */}
          <Card variant="stat" accent="cyan" padding="md" hover>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">API Calls</span>
              <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white tracking-tight">
              {usage ? formatNumber(usage.total_api_calls) : '0'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">This month</span>
            </div>
          </Card>

          {/* Tokens Used */}
          <Card variant="stat" accent="emerald" padding="md" hover>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Tokens Used</span>
              <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white tracking-tight">
              {usage ? formatNumber(usage.total_aicaffe_tokens) : '0'}
            </p>
            <span className="text-xs text-gray-600 mt-1.5 block">
              {usage ? formatCurrency(usage.total_cost_usd) : '$0.00'} spent
            </span>
          </Card>

          {/* Conversations */}
          <Card variant="stat" accent="amber" padding="md" hover>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Conversations</span>
              <div className="p-1.5 bg-amber-500/10 rounded-lg">
                <MessageSquare className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white tracking-tight">
              {conversations.length}
            </p>
            <span className="text-xs text-gray-600 mt-1.5 block">Active chats</span>
          </Card>
        </div>
      )}

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Chat with AI', href: '/assistant', icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'Browse Models', href: '/models', icon: Bot, color: 'text-violet-400' },
          { label: 'Smart Query', href: '/smart-query', icon: Sparkles, color: 'text-amber-400' },
          { label: 'Code Studio', href: '/workshops/code', icon: Code2, color: 'text-emerald-400' },
          { label: 'Research Lab', href: '/workshops/research', icon: FlaskConical, color: 'text-blue-400' },
          { label: 'Content Forge', href: '/workshops/content', icon: PenTool, color: 'text-rose-400' },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group glass-card p-3.5 flex flex-col items-center gap-2 hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-200"
          >
            <action.icon className={`w-5 h-5 ${action.color} group-hover:scale-110 transition-transform`} />
            <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            <Link href="/tokens" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
              View all
            </Link>
          </div>

          {txLoading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton variant="text" className="h-3.5 w-24" />
                      <Skeleton variant="text" className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <Skeleton variant="text" className="h-3.5 w-20 ml-auto" />
                    <Skeleton variant="text" className="h-3 w-12 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/[0.03] flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-sm text-gray-400">No recent activity</p>
              <p className="text-xs text-gray-600 mt-1">Start using AI models to see your activity here</p>
            </div>
          ) : (
            <div>
              {transactions.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                    i !== transactions.length - 1 ? 'border-b border-white/[0.03]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      tx.transaction_type === 'consumption'
                        ? 'bg-red-500/10'
                        : 'bg-emerald-500/10'
                    }`}>
                      {tx.transaction_type === 'consumption' ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] text-white font-medium capitalize">
                        {tx.transaction_type.replace('_', ' ')}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        {tx.model_name || tx.description || 'Token transaction'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13px] font-semibold ${
                      tx.transaction_type === 'consumption' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {tx.transaction_type === 'consumption' ? '-' : '+'}
                      {formatNumber(Math.abs(tx.token_amount))} ACT
                    </p>
                    <p className="text-[11px] text-gray-600">
                      {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Conversations */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <h3 className="text-sm font-semibold text-white">Recent Chats</h3>
              <Link href="/assistant" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                View all
              </Link>
            </div>

            {convsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton variant="text" className="h-3.5 w-full" />
                      <Skeleton variant="text" className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-gray-600">No conversations yet</p>
                <Link href="/assistant" className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block">
                  Start your first chat
                </Link>
              </div>
            ) : (
              <div className="p-2">
                {conversations.slice(0, 4).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/assistant?conversation=${conv.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="w-8 h-8 bg-white/[0.04] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white truncate">
                        {conv.title || 'New conversation'}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        {formatRelativeTime(conv.last_message_at || conv.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Storage Quick Access */}
          <Link href="/storage" className="glass-card p-4 flex items-center gap-3 hover:border-white/[0.1] transition-all block">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Cloud className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-white font-medium">CaffeSpace Storage</p>
              <p className="text-[11px] text-gray-600">Manage your files and projects</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
          </Link>
        </div>
      </div>

      {/* Featured Models */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Featured Models</h3>
          </div>
          <Link href="/models" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
            View all models
          </Link>
        </div>

        <div className="p-5">
          {modelsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 bg-white/[0.02] rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton variant="text" className="h-3.5 w-24" />
                      <Skeleton variant="text" className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton variant="text" className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : featuredModels.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-gray-600">No featured models available</p>
              <Link href="/models" className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block">
                Browse all models
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredModels.map((model) => (
                <Link
                  key={model.id}
                  href={`/models/${model.slug}`}
                  className="group p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:border-white/[0.08] hover:bg-white/[0.03] transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white/[0.06] rounded-lg flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">{model.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                        {model.name}
                      </p>
                      <p className="text-[11px] text-gray-600">{model.provider_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="default" size="sm">
                      {getModelTypeLabel(model.model_type)}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[11px] text-gray-500">{(model.avg_rating ?? 0).toFixed(1)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
