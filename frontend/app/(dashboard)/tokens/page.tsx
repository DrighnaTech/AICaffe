'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Wallet, CreditCard, ArrowUpRight, ArrowDownRight, Clock, Sparkles,
  TrendingUp, Gift, AlertCircle, Check, ChevronRight, Zap, CheckCircle, XCircle
} from 'lucide-react'
import { tokensApi, billingApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { formatNumber, formatCurrency, formatRelativeTime, tokensToUsd } from '@/lib/utils'
import { useWalletStore } from '@/lib/store'
import toast from 'react-hot-toast'
import type { TokenWallet, TokenPackage, TokenTransaction } from '@/lib/types'

export default function TokensPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { balance, setBalance } = useWalletStore()
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; tokens?: number } | null>(null)

  // Handle payment success/cancellation from URL params
  useEffect(() => {
    const success = searchParams.get('success')
    const cancelled = searchParams.get('cancelled')
    const sessionId = searchParams.get('session_id')

    if (success === 'true' && sessionId) {
      // Verify payment and show success
      billingApi.verifyPayment(sessionId)
        .then((response) => {
          if (response.data?.verified) {
            setPaymentResult({ success: true, tokens: response.data.token_amount })
            setShowSuccessModal(true)
            // Refresh wallet data
            queryClient.invalidateQueries({ queryKey: ['wallet'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
          }
        })
        .catch(() => {
          // Even if verification fails, refresh data (webhook might have processed it)
          queryClient.invalidateQueries({ queryKey: ['wallet'] })
          queryClient.invalidateQueries({ queryKey: ['transactions'] })
          toast.success('Payment received! Your tokens will be credited shortly.')
        })

      // Clean up URL
      window.history.replaceState({}, '', '/tokens')
    } else if (cancelled === 'true') {
      toast.error('Payment was cancelled')
      window.history.replaceState({}, '', '/tokens')
    }
  }, [searchParams, queryClient])

  // Fetch wallet
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => tokensApi.wallet(),
  })

  // Fetch packages
  const { data: packagesData } = useQuery({
    queryKey: ['token-packages'],
    queryFn: () => tokensApi.packages(),
  })

  // Fetch transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => tokensApi.transactions({ limit: 20 }),
  })

  const wallet: TokenWallet | undefined = walletData?.data
  const packages: TokenPackage[] = packagesData?.data?.packages || packagesData?.data?.items || (Array.isArray(packagesData?.data) ? packagesData.data : [])
  const transactions: TokenTransaction[] = transactionsData?.data?.transactions || transactionsData?.data?.items || (Array.isArray(transactionsData?.data) ? transactionsData.data : [])

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: (packageId: string) => billingApi.checkout({ package_id: packageId }),
    onSuccess: (response) => {
      const checkoutUrl = response.data?.checkout_url
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        toast.success('Purchase initiated!')
        queryClient.invalidateQueries({ queryKey: ['wallet'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }
      setShowPurchaseModal(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to process purchase')
    },
  })

  const handlePurchase = (pkg: TokenPackage) => {
    setSelectedPackage(pkg)
    setShowPurchaseModal(true)
  }

  const confirmPurchase = () => {
    if (selectedPackage) {
      purchaseMutation.mutate(selectedPackage.id)
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ArrowDownRight className="w-4 h-4 text-green-400" />
      case 'consumption':
        return <ArrowUpRight className="w-4 h-4 text-red-400" />
      case 'bonus':
        return <Gift className="w-4 h-4 text-violet-400" />
      case 'refund':
        return <ArrowDownRight className="w-4 h-4 text-blue-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'bonus':
      case 'refund':
        return 'text-green-400'
      case 'consumption':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Token Wallet</h1>
        <p className="text-gray-400 mt-1">
          Manage your AICaffe tokens and purchase more
        </p>
      </div>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="gradient" padding="lg" className="md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 mb-1">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">
                  {wallet ? formatNumber(wallet.balance) : '...'}
                </span>
                <span className="text-xl text-violet-400">ACT</span>
              </div>
              <p className="text-gray-500 mt-1">
                ≈ {wallet ? formatCurrency(wallet.balance_usd || tokensToUsd(wallet.balance)) : '$0.00'} USD
              </p>
            </div>
            <div className="p-3 bg-violet-500/20 rounded-xl">
              <Wallet className="w-8 h-8 text-violet-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
            <div>
              <p className="text-sm text-gray-500">Total Purchased</p>
              <p className="text-lg font-semibold text-white">
                {wallet ? formatNumber(wallet.total_purchased) : '0'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Used</p>
              <p className="text-lg font-semibold text-white">
                {wallet ? formatNumber(wallet.total_consumed) : '0'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Refunded</p>
              <p className="text-lg font-semibold text-white">
                {wallet ? formatNumber(wallet.total_refunded) : '0'}
              </p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Token Rate</p>
              <p className="text-lg font-semibold text-white">20,000 ACT = $1</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Universal tokens work across all 200+ AI models. 20% platform fee included.
          </p>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Check className="w-4 h-4" />
            <span>No model-specific subscriptions</span>
          </div>
        </Card>
      </div>

      {/* Token Packages */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Purchase Tokens</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {packages.map((pkg) => (
            <motion.div
              key={pkg.id}
              whileHover={{ y: -4 }}
              className={`relative bg-gray-900/50 border rounded-xl p-5 cursor-pointer transition-all ${
                pkg.is_featured
                  ? 'border-violet-500 ring-1 ring-violet-500/50'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => handlePurchase(pkg)}
            >
              {pkg.is_featured && (
                <Badge variant="purple" size="sm" className="absolute -top-2 -right-2">
                  Best Value
                </Badge>
              )}

              <h3 className="text-lg font-semibold text-white mb-1">{pkg.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{pkg.description}</p>

              <div className="mb-4">
                <span className="text-3xl font-bold text-white">
                  {formatCurrency(pkg.price_usd)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Tokens</span>
                  <span className="text-white font-medium">
                    {formatNumber(pkg.token_amount)}
                  </span>
                </div>
                {pkg.bonus_percentage > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Bonus</span>
                    <span className="text-green-400 font-medium">
                      +{pkg.bonus_percentage}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="text-violet-400 font-medium">
                    {formatNumber(pkg.total_tokens || pkg.token_amount * (1 + pkg.bonus_percentage / 100))} ACT
                  </span>
                </div>
              </div>

              <Button variant={pkg.is_featured ? 'primary' : 'outline'} className="w-full">
                Purchase
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <Card variant="bordered" padding="none">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      {getTransactionIcon(tx.transaction_type)}
                    </div>
                    <div>
                      <p className="text-white font-medium capitalize">
                        {tx.transaction_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {tx.description || tx.model_name || 'Token transaction'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTransactionColor(tx.transaction_type)}`}>
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

      {/* Purchase Confirmation Modal */}
      <Modal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
        title="Confirm Purchase"
        size="sm"
      >
        {selectedPackage && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Package</span>
                <span className="text-white font-medium">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Tokens</span>
                <span className="text-white">{formatNumber(selectedPackage.token_amount)}</span>
              </div>
              {selectedPackage.bonus_percentage > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Bonus (+{selectedPackage.bonus_percentage}%)</span>
                  <span className="text-green-400">
                    +{formatNumber(selectedPackage.token_amount * selectedPackage.bonus_percentage / 100)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-gray-400">Total</span>
                <span className="text-violet-400 font-semibold">
                  {formatNumber(selectedPackage.total_tokens || selectedPackage.token_amount * (1 + selectedPackage.bonus_percentage / 100))} ACT
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-3 border-y border-gray-800">
              <span className="text-lg text-white">Amount Due</span>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(selectedPackage.price_usd)}
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={confirmPurchase}
                isLoading={purchaseMutation.isPending}
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Pay with Stripe
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Success Modal */}
      <Modal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        title="Payment Successful!"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              Tokens Added Successfully
            </p>
            {paymentResult?.tokens && (
              <p className="text-2xl font-bold text-violet-400 mt-2">
                +{formatNumber(paymentResult.tokens)} ACT
              </p>
            )}
          </div>
          <p className="text-gray-400">
            Your tokens have been added to your wallet and are ready to use.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setShowSuccessModal(false)}
          >
            Start Using Tokens
          </Button>
        </div>
      </Modal>
    </div>
  )
}
