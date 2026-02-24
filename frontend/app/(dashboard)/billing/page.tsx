'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Download, Calendar, Filter,
  ChevronDown, CreditCard, FileText, Clock, Zap, Check, Crown, Sparkles, ExternalLink
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'
import { billingApi, authApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UsageSummary, Invoice, ModelUsage } from '@/lib/types'

const SUBSCRIPTION_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    tokens: '10K',
    features: ['10K tokens/month', 'Basic models', 'Community support', '1 workspace'],
    popular: false,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    price: 29,
    tokens: '100K',
    features: ['100K tokens/month', 'All models', 'Priority support', 'API access', '5 workspaces'],
    popular: true,
  },
  {
    id: 'builder',
    name: 'Builder',
    price: 99,
    tokens: '500K',
    features: ['500K tokens/month', 'All models', '24/7 support', 'API access', 'Unlimited workspaces', 'Custom integrations'],
    popular: false,
  },
]

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last 12 months' },
]

export default function BillingPage() {
  const [period, setPeriod] = useState('month')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const searchParams = useSearchParams()

  // Handle subscription success from URL
  useEffect(() => {
    const success = searchParams.get('success')
    if (success === 'true') {
      toast.success('Subscription activated successfully!')
      window.history.replaceState({}, '', '/billing')
    }
  }, [searchParams])

  // Fetch user profile for subscription status
  const { data: userData } = useQuery({
    queryKey: ['user'],
    queryFn: () => authApi.me(),
  })

  // Fetch usage data
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage', period],
    queryFn: () => billingApi.usage({ period }),
  })

  // Fetch invoices
  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingApi.invoices({ limit: 10 }),
  })

  const currentPlan = userData?.data?.subscription_plan || 'starter'

  // Subscription checkout mutation
  const subscriptionMutation = useMutation({
    mutationFn: (plan: string) => billingApi.subscriptionCheckout({ plan, billing_cycle: billingCycle }),
    onSuccess: (response) => {
      if (response.data?.checkout_url) {
        window.location.href = response.data.checkout_url
      } else {
        toast.success('Plan updated successfully!')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to process subscription')
    },
  })

  // Customer portal mutation
  const portalMutation = useMutation({
    mutationFn: () => billingApi.customerPortal(),
    onSuccess: (response) => {
      if (response.data?.portal_url) {
        window.open(response.data.portal_url, '_blank')
      }
    },
    onError: () => {
      toast.error('Unable to open billing portal')
    },
  })

  const usage: UsageSummary | undefined = usageData?.data
  const invoices: Invoice[] = invoicesData?.data?.invoices || invoicesData?.data?.items || (Array.isArray(invoicesData?.data) ? invoicesData.data : [])

  // Prepare chart data
  const dailyChartData = usage?.by_day?.map((day) => ({
    date: formatDate(day.date, { month: 'short', day: 'numeric' }),
    calls: day.api_calls,
    tokens: day.tokens / 1000, // Show in K
    cost: day.cost_usd,
  })) || []

  const modelChartData = usage?.by_model?.slice(0, 6).map((m) => ({
    name: m.model_name,
    value: m.api_calls,
  })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
          <p className="text-gray-400 mt-1">
            Track your API usage and manage billing
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={period}
            onValueChange={setPeriod}
            options={PERIOD_OPTIONS}
            className="w-40"
          />
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="gradient" padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-white">
                {usage ? formatCurrency(usage.total_cost_usd) : '$0.00'}
              </p>
              <p className="text-sm text-gray-500">This {period}</p>
            </div>
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-violet-400" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">API Calls</p>
              <p className="text-2xl font-bold text-white">
                {usage ? formatNumber(usage.total_api_calls) : '0'}
              </p>
              <p className="text-sm text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Active
              </p>
            </div>
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Tokens Used</p>
              <p className="text-2xl font-bold text-white">
                {usage ? formatNumber(usage.total_aicaffe_tokens) : '0'}
              </p>
              <p className="text-sm text-gray-500">ACT consumed</p>
            </div>
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avg Cost/Call</p>
              <p className="text-2xl font-bold text-white">
                {usage && usage.total_api_calls > 0
                  ? formatCurrency(usage.total_cost_usd / usage.total_api_calls)
                  : '$0.00'}
              </p>
              <p className="text-sm text-gray-500">Per request</p>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Over Time */}
        <Card variant="bordered" padding="md" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorCalls)"
                    name="API Calls"
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                    name="Tokens (K)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Usage by Model */}
        <Card variant="bordered" padding="md">
          <CardHeader>
            <CardTitle>Top Models</CardTitle>
          </CardHeader>
          <CardContent>
            {modelChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {modelChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {modelChartData.slice(0, 4).map((model, i) => (
                <div key={model.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-gray-300 truncate max-w-[120px]">{model.name}</span>
                  </div>
                  <span className="text-white">{formatNumber(model.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown Table */}
      <Card variant="bordered" padding="none">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Usage by Model</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!usage?.by_model || usage.by_model.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No usage data for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Model</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Provider</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">API Calls</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Input Tokens</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Output Tokens</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">ACT Used</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {usage.by_model.map((model: ModelUsage) => (
                    <tr key={model.model_id} className="hover:bg-gray-800/30">
                      <td className="py-4 px-6">
                        <span className="text-white font-medium">{model.model_name}</span>
                      </td>
                      <td className="py-4 px-6 text-gray-400">{model.provider_name}</td>
                      <td className="py-4 px-6 text-right text-white">{formatNumber(model.api_calls)}</td>
                      <td className="py-4 px-6 text-right text-gray-300">{formatNumber(model.input_tokens)}</td>
                      <td className="py-4 px-6 text-right text-gray-300">{formatNumber(model.output_tokens)}</td>
                      <td className="py-4 px-6 text-right text-violet-400">{formatNumber(model.aicaffe_tokens)}</td>
                      <td className="py-4 px-6 text-right text-white font-medium">{formatCurrency(model.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              Subscription Plan
            </CardTitle>
            {currentPlan !== 'starter' && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ExternalLink className="w-4 h-4" />}
                onClick={() => portalMutation.mutate()}
                isLoading={portalMutation.isPending}
              >
                Manage Subscription
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingCycle === 'yearly' ? 'bg-violet-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-500'}`}>
              Yearly
              <Badge variant="success" size="sm" className="ml-2">Save 17%</Badge>
            </span>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -2 }}
                className={`relative rounded-xl p-5 border transition-all ${
                  currentPlan === plan.id
                    ? 'border-violet-500 bg-violet-500/10'
                    : plan.popular
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                {plan.popular && (
                  <Badge variant="cyan" size="sm" className="absolute -top-2 right-4">
                    Most Popular
                  </Badge>
                )}
                {currentPlan === plan.id && (
                  <Badge variant="purple" size="sm" className="absolute -top-2 right-4">
                    Current Plan
                  </Badge>
                )}

                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-white">
                    ${billingCycle === 'yearly' ? Math.round(plan.price * 10 / 12) : plan.price}
                  </span>
                  <span className="text-gray-500">/month</span>
                </div>

                <div className="flex items-center gap-2 mb-4 text-violet-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">{plan.tokens} tokens/month</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={currentPlan === plan.id ? 'outline' : plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  disabled={currentPlan === plan.id}
                  onClick={() => subscriptionMutation.mutate(plan.id)}
                  isLoading={subscriptionMutation.isPending}
                >
                  {currentPlan === plan.id ? 'Current Plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card variant="bordered" padding="none">
        <CardHeader className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              Invoices
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {invoices.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No invoices yet
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        invoice.status === 'paid' ? 'success' :
                        invoice.status === 'overdue' ? 'danger' :
                        invoice.status === 'sent' ? 'warning' : 'default'
                      }
                    >
                      {invoice.status}
                    </Badge>
                    <span className="text-white font-medium">{formatCurrency(invoice.total_usd)}</span>
                    {invoice.payment_url && invoice.status !== 'paid' && (
                      <Button variant="outline" size="sm" onClick={() => window.open(invoice.payment_url, '_blank')}>
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
