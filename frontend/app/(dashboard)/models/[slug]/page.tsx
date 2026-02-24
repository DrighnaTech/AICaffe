'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Star, Zap, Clock, ExternalLink, Copy, Check, MessageSquare,
  ArrowLeft, Plus, DollarSign, Globe, Calendar, Code, Eye,
  Mic, Volume2, Image as ImageIcon, Video, Bot, ThumbsUp
} from 'lucide-react'
import { modelsApi, tokensApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useCompareStore } from '@/lib/store'
import {
  formatNumber, formatCurrency, formatDate, formatRelativeTime,
  getModelTypeLabel, getModelTypeColor, getRatingColor, copyToClipboard
} from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AIModel, ModelReview, TokenCostEstimate } from '@/lib/types'

export default function ModelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { selectedModels, addModel, removeModel } = useCompareStore()

  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)

  // Fetch model details
  const { data: modelData, isLoading, error } = useQuery({
    queryKey: ['model', slug],
    queryFn: () => modelsApi.get(slug),
  })

  // Fetch reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['model-reviews', slug],
    queryFn: () => modelsApi.reviews(slug, { limit: 10 }),
    enabled: !!slug,
  })

  // Calculate cost
  const { data: costData } = useQuery({
    queryKey: ['model-cost', modelData?.data?.id],
    queryFn: () => tokensApi.calculate({
      model_id: modelData?.data?.id,
      input_tokens: 1000,
      output_tokens: 500,
    }),
    enabled: !!modelData?.data?.id,
  })

  const model: AIModel | undefined = modelData?.data
  const rawReviews = reviewsData?.data as any
  const reviews: ModelReview[] = Array.isArray(rawReviews) ? rawReviews : (rawReviews?.reviews || rawReviews?.items || [])
  const costEstimate: TokenCostEstimate | undefined = costData?.data

  const isSelected = model ? selectedModels.includes(model.id) : false
  const canAddMore = selectedModels.length < 5

  const handleCompareToggle = () => {
    if (!model) return
    if (isSelected) {
      removeModel(model.id)
    } else if (canAddMore) {
      addModel(model.id)
    }
  }

  const handleCopyEndpoint = async () => {
    if (!model) return
    const endpoint = `POST /api/v1/chat/completions\n{\n  "model_id": "${model.id}",\n  "messages": [{"role": "user", "content": "Hello"}]\n}`
    const success = await copyToClipboard(endpoint)
    if (success) {
      setCopiedEndpoint(true)
      toast.success('API endpoint copied!')
      setTimeout(() => setCopiedEndpoint(false), 2000)
    }
  }

  const handleTryModel = () => {
    if (!model) return
    router.push(`/assistant?model=${model.id}`)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-800 rounded w-24" />
        <div className="flex gap-6">
          <div className="w-20 h-20 bg-gray-800 rounded-xl" />
          <div className="flex-1">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-2" />
            <div className="h-5 bg-gray-800 rounded w-1/4" />
          </div>
        </div>
        <div className="h-24 bg-gray-800 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !model) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Model not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Models
      </button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Model Info */}
        <div className="flex-1">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
              {model.logo_url ? (
                <img src={model.logo_url} alt={model.name} className="w-14 h-14 rounded-lg" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {model.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{model.name}</h1>
                {model.is_featured && <Badge variant="purple">Featured</Badge>}
                {model.is_open_source && <Badge variant="success">Open Source</Badge>}
              </div>
              <p className="text-gray-400">
                by <span className="text-white">{model.provider_name}</span>
                {model.version && <span className="text-gray-500"> v{model.version}</span>}
              </p>
            </div>
          </div>

          <p className="text-gray-300 mt-4 text-lg">
            {model.description || model.short_description}
          </p>

          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <Star className={`w-5 h-5 ${getRatingColor(model.avg_rating)} fill-current`} />
              <span className="text-white font-semibold">{model.avg_rating.toFixed(1)}</span>
              <span className="text-gray-500">({formatNumber(model.total_ratings)} reviews)</span>
            </div>
            {model.avg_latency_ms && (
              <div className="flex items-center gap-1.5">
                <Zap className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-300">{model.avg_latency_ms}ms avg</span>
              </div>
            )}
            {model.context_window && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className="text-gray-300">{formatNumber(model.context_window)} context</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <ExternalLink className="w-5 h-5 text-gray-500" />
              <span className="text-gray-300">{formatNumber(model.total_api_calls)} API calls</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 lg:w-64">
          <Button variant="primary" size="lg" onClick={handleTryModel} leftIcon={<MessageSquare className="w-5 h-5" />}>
            Try in Assistant
          </Button>
          <Button
            variant={isSelected ? 'secondary' : 'outline'}
            size="lg"
            onClick={handleCompareToggle}
            disabled={!isSelected && !canAddMore}
            leftIcon={isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          >
            {isSelected ? 'Added to Compare' : 'Add to Compare'}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={handleCopyEndpoint}
            leftIcon={copiedEndpoint ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
          >
            {copiedEndpoint ? 'Copied!' : 'Copy API Endpoint'}
          </Button>
        </div>
      </div>

      {/* Capabilities & Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge className={getModelTypeColor(model.model_type)} size="lg">
          {getModelTypeLabel(model.model_type)}
        </Badge>
        {model.capabilities?.text && <Badge variant="default" size="lg">Text</Badge>}
        {model.capabilities?.vision && <Badge variant="info" size="lg">Vision</Badge>}
        {model.capabilities?.audio && <Badge variant="warning" size="lg">Audio</Badge>}
        {model.capabilities?.video && <Badge variant="danger" size="lg">Video</Badge>}
        {model.capabilities?.function_calling && <Badge variant="purple" size="lg">Function Calling</Badge>}
        {model.capabilities?.streaming && <Badge variant="success" size="lg">Streaming</Badge>}
        {model.capabilities?.json_mode && <Badge variant="default" size="lg">JSON Mode</Badge>}
        {model.capabilities?.reasoning && <Badge variant="purple" size="lg">Reasoning</Badge>}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Input Price</p>
              <p className="text-lg font-semibold text-white">
                {model.input_price_per_million ? formatCurrency(model.input_price_per_million) : 'N/A'}
                <span className="text-sm text-gray-500">/1M</span>
              </p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Output Price</p>
              <p className="text-lg font-semibold text-white">
                {model.output_price_per_million ? formatCurrency(model.output_price_per_million) : 'N/A'}
                <span className="text-sm text-gray-500">/1M</span>
              </p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Speed</p>
              <p className="text-lg font-semibold text-white">
                {model.avg_tokens_per_second ? `${model.avg_tokens_per_second} tok/s` : 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Max Output</p>
              <p className="text-lg font-semibold text-white">
                {model.max_output_tokens ? formatNumber(model.max_output_tokens) : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Cost Calculator Preview */}
      {costEstimate && (
        <Card variant="gradient" padding="md">
          <CardHeader>
            <CardTitle>Cost Estimate (1K input + 500 output tokens)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Provider Cost</p>
                <p className="text-xl font-semibold text-white">
                  {formatCurrency(costEstimate.provider_cost_usd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Platform Fee (20%)</p>
                <p className="text-xl font-semibold text-white">
                  {formatCurrency(costEstimate.margin_usd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total USD</p>
                <p className="text-xl font-semibold text-white">
                  {formatCurrency(costEstimate.total_cost_usd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">AICaffe Tokens</p>
                <p className="text-xl font-semibold text-violet-400">
                  {formatNumber(costEstimate.aicaffe_tokens)} ACT
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benchmarks */}
      {model.benchmarks && Object.keys(model.benchmarks).length > 0 && (
        <Card variant="bordered" padding="md">
          <CardHeader>
            <CardTitle>Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(model.benchmarks).map(([key, value]) => (
                <div key={key} className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 uppercase">{key}</p>
                  <p className="text-2xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="bordered" padding="md">
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-400">Model ID</dt>
                <dd className="text-white font-mono text-sm">{model.model_identifier}</dd>
              </div>
              {model.parameters_count && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Parameters</dt>
                  <dd className="text-white">{model.parameters_count}</dd>
                </div>
              )}
              {model.training_cutoff && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Training Cutoff</dt>
                  <dd className="text-white">{formatDate(model.training_cutoff)}</dd>
                </div>
              )}
              {model.released_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Released</dt>
                  <dd className="text-white">{formatDate(model.released_at)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-400">Uptime</dt>
                <dd className="text-green-400">{model.uptime_percentage}%</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Features */}
        {model.features && model.features.length > 0 && (
          <Card variant="bordered" padding="md">
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {model.features.map((feature) => (
                  <div key={feature.id} className="flex items-center justify-between">
                    <span className="text-gray-300">{feature.feature_name}</span>
                    {feature.is_supported ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reviews */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reviews ({formatNumber(model.total_ratings)})</CardTitle>
            <Button variant="outline" size="sm">
              Write a Review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No reviews yet. Be the first to review!</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, showAllReviews ? undefined : 3).map((review) => (
                <div key={review.id} className="border-b border-gray-800 pb-4 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {review.user_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{review.user_name}</p>
                        <p className="text-sm text-gray-500">{formatRelativeTime(review.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.title && <p className="text-white font-medium mb-1">{review.title}</p>}
                  {review.review_text && <p className="text-gray-300">{review.review_text}</p>}
                  {review.is_verified && (
                    <Badge variant="success" size="sm" className="mt-2">Verified Purchase</Badge>
                  )}
                </div>
              ))}
              {reviews.length > 3 && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="w-full"
                >
                  {showAllReviews ? 'Show Less' : `Show All ${reviews.length} Reviews`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
