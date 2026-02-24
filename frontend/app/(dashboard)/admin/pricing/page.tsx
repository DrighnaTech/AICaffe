'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Percent, TrendingUp, Save, RefreshCw, ChevronRight,
  AlertTriangle, CheckCircle, Calculator, Globe, Coins, Zap
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatNumber, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PricingConfig {
  platformMargin: number
  tokenExchangeRate: number // ACT per $1
  minMargin: number
  maxMargin: number
  storagePricePerGB: number
  plans: {
    id: string
    name: string
    price: number
    tokens: number
    features: string[]
  }[]
  currencyRates: {
    [key: string]: number
  }
}

const defaultConfig: PricingConfig = {
  platformMargin: 20,
  tokenExchangeRate: 20000, // 20,000 ACT = $1
  minMargin: 20,
  maxMargin: 40,
  storagePricePerGB: 1,
  plans: [
    { id: 'starter', name: 'Starter', price: 19, tokens: 500000, features: ['500K ACT tokens', '1 GB CaffeSpace', 'Email support', 'Basic models'] },
    { id: 'explorer', name: 'Explorer', price: 79, tokens: 2500000, features: ['2.5M ACT tokens', '5 GB CaffeSpace', 'Priority support', 'All models', 'API access'] },
    { id: 'builder', name: 'Builder', price: 249, tokens: 10000000, features: ['10M ACT tokens', '15 GB CaffeSpace', '24/7 support', 'All models', 'API access', 'Custom integrations'] },
  ],
  currencyRates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.12,
    AUD: 1.53,
    CAD: 1.36,
  }
}

export default function AdminPricingPage() {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<PricingConfig>(defaultConfig)
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch pricing config
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pricing'],
    queryFn: async () => {
      // In production, fetch from API
      return defaultConfig
    },
    onSuccess: (data) => {
      setConfig(data)
    }
  })

  // Save pricing config
  const saveMutation = useMutation({
    mutationFn: async (newConfig: PricingConfig) => {
      // In production, save to API
      return { success: true }
    },
    onSuccess: () => {
      toast.success('Pricing configuration saved')
      setHasChanges(false)
    },
    onError: () => {
      toast.error('Failed to save pricing configuration')
    }
  })

  const updateConfig = (updates: Partial<PricingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const updatePlan = (planId: string, updates: Partial<typeof config.plans[0]>) => {
    setConfig(prev => ({
      ...prev,
      plans: prev.plans.map(p => p.id === planId ? { ...p, ...updates } : p)
    }))
    setHasChanges(true)
  }

  const updateCurrencyRate = (currency: string, rate: number) => {
    setConfig(prev => ({
      ...prev,
      currencyRates: { ...prev.currencyRates, [currency]: rate }
    }))
    setHasChanges(true)
  }

  // Calculate token value
  const tokenValueUsd = 1 / config.tokenExchangeRate

  // Calculate effective margin for a model
  const calculateMargin = (apiCost: number, ourPrice: number) => {
    return ((ourPrice - apiCost) / ourPrice * 100).toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-white">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Pricing</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Pricing Configuration
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="warning" className="mr-2">Unsaved Changes</Badge>
          )}
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              setConfig(defaultConfig)
              setHasChanges(false)
            }}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={() => saveMutation.mutate(config)}
            isLoading={saveMutation.isPending}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-violet-400" />
              Margin Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Platform Margin
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.platformMargin}
                    onChange={(e) => updateConfig({ platformMargin: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Applied to all API costs</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Min/Max Margin
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.minMargin}
                    onChange={(e) => updateConfig({ minMargin: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={config.maxMargin}
                    onChange={(e) => updateConfig({ maxMargin: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Current Effective Margin</span>
                <span className={`text-lg font-bold ${
                  config.platformMargin >= config.minMargin ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {config.platformMargin}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                  style={{ width: `${Math.min(config.platformMargin / config.maxMargin * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>{config.minMargin}% min</span>
                <span>{config.maxMargin}% max</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-cyan-400" />
              Token Economics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Token Exchange Rate (ACT per $1 USD)
              </label>
              <input
                type="number"
                value={config.tokenExchangeRate}
                onChange={(e) => updateConfig({ tokenExchangeRate: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-gray-400">1 ACT Token =</p>
                <p className="text-xl font-bold text-emerald-400">
                  ${tokenValueUsd.toFixed(6)}
                </p>
              </div>
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <p className="text-sm text-gray-400">$1 USD =</p>
                <p className="text-xl font-bold text-violet-400">
                  {formatNumber(config.tokenExchangeRate)} ACT
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Storage Price (per GB/month)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={config.storagePricePerGB}
                  onChange={(e) => updateConfig({ storagePricePerGB: parseFloat(e.target.value) })}
                  className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  step="0.01"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Plans */}
      <Card variant="bordered" padding="md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Subscription Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.plans.map((plan) => (
              <div key={plan.id} className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <Badge variant={
                    plan.id === 'builder' ? 'success' :
                    plan.id === 'explorer' ? 'info' : 'warning'
                  }>
                    {plan.id}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Price (USD/month)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => updatePlan(plan.id, { price: parseFloat(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Tokens Included</label>
                    <input
                      type="number"
                      value={plan.tokens}
                      onChange={(e) => updatePlan(plan.id, { tokens: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Value: {formatCurrency(plan.tokens / config.tokenExchangeRate)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Effective Rate</p>
                    <p className="text-lg font-bold text-emerald-400">
                      ${(plan.price / plan.tokens * 1000000).toFixed(2)} per 1M ACT
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Currency Exchange Rates */}
      <Card variant="bordered" padding="md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Currency Exchange Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(config.currencyRates).map(([currency, rate]) => (
              <div key={currency} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <label className="block text-sm font-medium text-gray-400 mb-1">{currency}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => updateCurrencyRate(currency, parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    step="0.01"
                    disabled={currency === 'USD'}
                  />
                </div>
                {currency !== 'USD' && (
                  <p className="text-xs text-gray-500 mt-1">
                    $1 USD = {rate} {currency}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Note: Exchange rates are used to display localized pricing. All transactions are processed in USD.
          </p>
        </CardContent>
      </Card>

      {/* Pricing Calculator */}
      <Card variant="bordered" padding="md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-violet-400" />
            Pricing Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">API Cost to Customer Price</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">API Cost (per 1M tokens)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 5.00"
                    leftIcon={<DollarSign className="w-4 h-4" />}
                    id="api-cost"
                  />
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Customer Price (ACT)</span>
                    <span className="text-lg font-bold text-white">
                      {formatNumber(5 * config.tokenExchangeRate * (1 + config.platformMargin / 100))} ACT
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-400">Your Margin</span>
                    <span className="text-lg font-bold text-emerald-400">
                      ${(5 * config.platformMargin / 100).toFixed(2)} ({config.platformMargin}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Example Model Pricing</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400">Model</th>
                    <th className="text-right py-2 text-gray-400">API Cost</th>
                    <th className="text-right py-2 text-gray-400">Our Price</th>
                    <th className="text-right py-2 text-gray-400">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-white">GPT-4o</td>
                    <td className="py-2 text-right text-gray-400">$5.00</td>
                    <td className="py-2 text-right text-white">${(5 * (1 + config.platformMargin / 100)).toFixed(2)}</td>
                    <td className="py-2 text-right text-emerald-400">{config.platformMargin}%</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-white">Claude 3.5</td>
                    <td className="py-2 text-right text-gray-400">$3.00</td>
                    <td className="py-2 text-right text-white">${(3 * (1 + config.platformMargin / 100)).toFixed(2)}</td>
                    <td className="py-2 text-right text-emerald-400">{config.platformMargin}%</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-white">Llama 3.3</td>
                    <td className="py-2 text-right text-gray-400">$0.80</td>
                    <td className="py-2 text-right text-white">${(0.8 * (1 + config.platformMargin / 100)).toFixed(2)}</td>
                    <td className="py-2 text-right text-emerald-400">{config.platformMargin}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {config.platformMargin < config.minMargin && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Margin Below Minimum</p>
            <p className="text-sm text-gray-400 mt-1">
              Your current margin ({config.platformMargin}%) is below the minimum threshold ({config.minMargin}%).
              This may result in losses on some API calls.
            </p>
          </div>
        </div>
      )}

      {config.platformMargin >= config.minMargin && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-400 font-medium">Pricing Configuration Valid</p>
            <p className="text-sm text-gray-400 mt-1">
              Your margin settings are within the acceptable range. Estimated monthly profit margin: {config.platformMargin}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
