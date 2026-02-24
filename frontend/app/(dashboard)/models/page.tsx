'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search, Filter, Grid, List, SlidersHorizontal, X, ChevronDown,
  Sparkles, Zap, DollarSign, Star, ArrowUpDown
} from 'lucide-react'
import { modelsApi, providersApi } from '@/lib/api'
import { ModelCard } from '@/components/models/ModelCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { useCompareStore } from '@/lib/store'
import { getModelTypeLabel } from '@/lib/utils'
import type { AIModel, AIProvider } from '@/lib/types'

const MODEL_TYPES = [
  { value: 'llm', label: 'Language Models' },
  { value: 'multimodal', label: 'Multimodal' },
  { value: 'image_generation', label: 'Image Generation' },
  { value: 'code_generation', label: 'Code Generation' },
  { value: 'audio_transcription', label: 'Speech-to-Text' },
  { value: 'text_to_speech', label: 'Text-to-Speech' },
  { value: 'video_generation', label: 'Video Generation' },
  { value: 'embedding', label: 'Embeddings' },
  { value: 'search', label: 'AI Search' },
]

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'context', label: 'Largest Context' },
]

export default function ModelsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedModels, clearAll } = useCompareStore()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [modelType, setModelType] = useState(searchParams.get('type') || '')
  const [provider, setProvider] = useState(searchParams.get('provider') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'featured')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Advanced filters
  const [minContext, setMinContext] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [openSourceOnly, setOpenSourceOnly] = useState(false)
  const [visionCapable, setVisionCapable] = useState(false)

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => providersApi.list(),
  })

  // Fetch models
  const { data: modelsData, isLoading, error } = useQuery({
    queryKey: ['models', search, modelType, provider, sortBy, minContext, maxPrice, openSourceOnly, visionCapable],
    queryFn: () => modelsApi.list({
      search: search || undefined,
      model_type: modelType || undefined,
      provider_slug: provider || undefined,
      sort_by: sortBy,
      min_context_window: minContext ? parseInt(minContext) : undefined,
      max_input_price: maxPrice ? parseFloat(maxPrice) : undefined,
      is_open_source: openSourceOnly || undefined,
      has_vision: visionCapable || undefined,
      limit: 50,
    }),
  })

  const providers: AIProvider[] = providersData?.data?.providers || providersData?.data?.items || (Array.isArray(providersData?.data) ? providersData.data : [])
  const models: AIModel[] = modelsData?.data?.models || modelsData?.data?.items || (Array.isArray(modelsData?.data) ? modelsData.data : [])

  const providerOptions = [
    { value: '', label: 'All Providers' },
    ...providers.map((p) => ({ value: p.slug, label: p.name })),
  ]

  const activeFiltersCount = [
    modelType,
    provider,
    minContext,
    maxPrice,
    openSourceOnly,
    visionCapable,
  ].filter(Boolean).length

  const handleCompareClick = () => {
    if (selectedModels.length >= 2) {
      router.push(`/compare?models=${selectedModels.join(',')}`)
    }
  }

  const clearFilters = () => {
    setModelType('')
    setProvider('')
    setMinContext('')
    setMaxPrice('')
    setOpenSourceOnly(false)
    setVisionCapable(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Models</h1>
          <p className="text-gray-400 mt-1">
            Explore {models.length}+ models from {providers.length}+ providers
          </p>
        </div>

        {selectedModels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            <Badge variant="purple" size="lg">
              {selectedModels.length} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompareClick}
              disabled={selectedModels.length < 2}
            >
              Compare Models
            </Button>
          </motion.div>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <Input
            placeholder="Search models by name, provider, or capability..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
            rightIcon={
              search && (
                <button onClick={() => setSearch('')}>
                  <X className="w-4 h-4 hover:text-white" />
                </button>
              )
            }
          />
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Select
            value={modelType}
            onValueChange={setModelType}
            options={[{ value: '', label: 'All Types' }, ...MODEL_TYPES]}
            className="w-40"
          />

          <Select
            value={provider}
            onValueChange={setProvider}
            options={providerOptions}
            className="w-40"
          />

          <Select
            value={sortBy}
            onValueChange={setSortBy}
            options={SORT_OPTIONS}
            className="w-40"
          />

          <Button
            variant={showFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<SlidersHorizontal className="w-4 h-4" />}
          >
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="purple" size="sm" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          <div className="flex border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Advanced Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-violet-400 hover:text-violet-300"
            >
              Clear all filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Min Context Window"
              type="number"
              placeholder="e.g. 100000"
              value={minContext}
              onChange={(e) => setMinContext(e.target.value)}
            />

            <Input
              label="Max Input Price ($/1M)"
              type="number"
              placeholder="e.g. 10"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Capabilities</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openSourceOnly}
                    onChange={(e) => setOpenSourceOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                  />
                  Open Source Only
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visionCapable}
                    onChange={(e) => setVisionCapable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                  />
                  Vision Capable
                </label>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Filter Tags */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Sparkles, label: 'Featured', filter: () => setSortBy('featured') },
          { icon: Star, label: 'Top Rated', filter: () => setSortBy('rating') },
          { icon: Zap, label: 'Fastest', filter: () => setSortBy('fastest') },
          { icon: DollarSign, label: 'Budget Friendly', filter: () => { setSortBy('price_low'); setMaxPrice('5'); } },
        ].map((tag) => (
          <button
            key={tag.label}
            onClick={tag.filter}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <tag.icon className="w-3.5 h-3.5" />
            {tag.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-700 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-gray-800 rounded mb-4" />
              <div className="flex gap-2 mb-4">
                <div className="h-6 bg-gray-800 rounded-full w-20" />
                <div className="h-6 bg-gray-800 rounded-full w-16" />
              </div>
              <div className="h-8 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Failed to load models. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No models found matching your criteria.</p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  )
}
