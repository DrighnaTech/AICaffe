'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Coins, MessageSquare, Bot, Zap, TrendingUp, ArrowUpRight, ArrowDownRight,
  Clock, Star, ChevronRight, Sparkles, BarChart3, Cloud
} from 'lucide-react'
import { tokensApi, billingApi, assistantApi, modelsApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { formatNumber, formatCurrency, formatRelativeTime, tokensToUsd, getModelTypeLabel } from '@/lib/utils'
import type { AIModel, Conversation, TokenTransaction, UsageSummary } from '@/lib/types'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { balance, setBalance } = useWalletStore()

  // Fetch wallet
  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => tokensApi.wallet(),
  })

  // Fetch recent transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => tokensApi.transactions({ limit: 5 }),
  })

  // Fetch usage summary
  const { data: usageData } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: () => billingApi.usage({ period: 'month' }),
  })

  // Fetch recent conversations
  const { data: conversationsData } = useQuery({
    queryKey: ['recent-conversations'],
    queryFn: () => assistantApi.conversations({ limit: 5 }),
  })

  // Fetch featured models
  const { data: modelsData } = useQuery({
    queryKey: ['featured-models'],
    queryFn: () => modelsApi.list({ is_featured: true, limit: 4 }),
  })

  const wallet = walletData?.data?.wallet || walletData?.data
  const transactions: TokenTransaction[] = transactionsData?.data?.transactions || transactionsData?.data?.items || []
  const usage: UsageSummary | undefined = usageData?.data
  const conversations: Conversation[] = conversationsData?.data?.conversations || conversationsData?.data?.items || []
  const featuredModels: AIModel[] = modelsData?.data?.models || modelsData?.data?.items || []

  // Update wallet balance in store
  if (wallet && wallet.balance !== balance) {
    setBalance(wallet.balance)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your AI usage today.
          </p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <Button variant="outline" leftIcon={<BarChart3 className="w-4 h-4" />}>
              <Link href="/billing">View Analytics</Link>
            </Button>
          )}
          <Button variant="primary" leftIcon={<MessageSquare className="w-4 h-4" />}>
            <Link href="/assistant">New Chat</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Token Balance */}
        <motion.div whileHover={{ y: -2 }}>
          <Card variant="gradient" padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Token Balance</p>
                <p className="text-2xl font-bold text-white">
                  {wallet ? formatNumber(wallet.balance) : '...'}
                </p>
                <p className="text-sm text-gray-500">
                  ≈ {wallet ? formatCurrency(tokensToUsd(wallet.balance)) : '$0.00'}
                </p>
              </div>
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <Coins className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <Link href="/tokens" className="flex items-center gap-1 text-sm text-violet-400 mt-3 hover:text-violet-300">
              Buy more tokens <ChevronRight className="w-4 h-4" />
            </Link>
          </Card>
        </motion.div>

        {/* API Calls This Month */}
        <motion.div whileHover={{ y: -2 }}>
          <Card variant="bordered" padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">API Calls (Month)</p>
                <p className="text-2xl font-bold text-white">
                  {usage ? formatNumber(usage.total_api_calls) : '0'}
                </p>
                <p className="text-sm text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Active
                </p>
              </div>
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tokens Used */}
        <motion.div whileHover={{ y: -2 }}>
          <Card variant="bordered" padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Tokens Used (Month)</p>
                <p className="text-2xl font-bold text-white">
                  {usage ? formatNumber(usage.total_aicaffe_tokens) : '0'}
                </p>
                <p className="text-sm text-gray-500">
                  {usage ? formatCurrency(usage.total_cost_usd) : '$0.00'} spent
                </p>
              </div>
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Conversations */}
        <motion.div whileHover={{ y: -2 }}>
          <Card variant="bordered" padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Conversations</p>
                <p className="text-2xl font-bold text-white">
                  {conversations.length}
                </p>
                <p className="text-sm text-gray-500">Active chats</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card variant="bordered" padding="none" className="lg:col-span-2">
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Link href="/tokens" className="text-sm text-violet-400 hover:text-violet-300">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {transactions.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No recent activity</p>
                <p className="text-gray-500 text-sm">Start using AI models to see your activity here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        tx.transaction_type === 'consumption'
                          ? 'bg-red-500/20'
                          : 'bg-green-500/20'
                      }`}>
                        {tx.transaction_type === 'consumption' ? (
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium capitalize">
                          {tx.transaction_type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {tx.model_name || tx.description || 'Token transaction'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.transaction_type === 'consumption' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {tx.transaction_type === 'consumption' ? '-' : '+'}
                        {formatNumber(Math.abs(tx.token_amount))} ACT
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatRelativeTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Conversations */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card variant="gradient" padding="md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link
                  href="/assistant"
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <span className="text-white">Start New Chat</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
                <Link
                  href="/models"
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-violet-400" />
                    <span className="text-white">Explore Models</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
                <Link
                  href="/recommendations"
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span className="text-white">Get Recommendations</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
                <Link
                  href="/storage"
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-green-400" />
                    <span className="text-white">CaffeSpace Storage</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Conversations */}
          <Card variant="bordered" padding="md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Chats</CardTitle>
                <Link href="/assistant" className="text-sm text-violet-400 hover:text-violet-300">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No conversations yet</p>
              ) : (
                <div className="space-y-2">
                  {conversations.slice(0, 3).map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/assistant?conversation=${conv.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {conv.title || 'New conversation'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(conv.last_message_at || conv.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Featured Models */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Featured Models
            </CardTitle>
            <Link href="/models" className="text-sm text-violet-400 hover:text-violet-300">
              View all models
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredModels.map((model) => (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{model.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.provider_name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="default" size="sm">
                    {getModelTypeLabel(model.model_type)}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-gray-400">{(model.avg_rating ?? 0).toFixed(1)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
