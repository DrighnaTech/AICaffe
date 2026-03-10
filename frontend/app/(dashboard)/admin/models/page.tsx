'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bot, Search, Filter, Download, Plus, Edit, Trash2, Eye, EyeOff,
  ChevronRight, ChevronLeft, Zap, DollarSign, TrendingUp, Activity,
  CheckCircle, XCircle, Settings, Globe, Star, StarOff
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatNumber, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AIModel } from '@/lib/types'

// Mock models data
const mockModels: AIModel[] = [
  {
    id: '1', name: 'GPT-4o', slug: 'gpt-4o', provider_id: '1', provider_name: 'OpenAI',
    model_identifier: 'gpt-4o', model_type: 'llm', description: 'Most capable GPT-4 model',
    input_price_per_million: 5, output_price_per_million: 15, context_window: 128000,
    is_available: true, is_featured: true, is_open_source: false,
    avg_latency_ms: 1200, capabilities: { text: true, vision: true, function_calling: true },
    benchmarks: { mmlu: 88.7 }, avg_rating: 4.5, total_ratings: 120, total_api_calls: 50000,
    uptime_percentage: 99.9, status: 'active',
  },
  {
    id: '2', name: 'Claude 3.5 Sonnet', slug: 'claude-3-5-sonnet', provider_id: '2', provider_name: 'Anthropic',
    model_identifier: 'claude-3-5-sonnet-20241022', model_type: 'llm', description: 'Best balance of speed and capability',
    input_price_per_million: 3, output_price_per_million: 15, context_window: 200000,
    is_available: true, is_featured: true, is_open_source: false,
    avg_latency_ms: 800, capabilities: { text: true, vision: true, code: true },
    benchmarks: { mmlu: 89.0 }, avg_rating: 4.7, total_ratings: 200, total_api_calls: 80000,
    uptime_percentage: 99.8, status: 'active',
  },
  {
    id: '3', name: 'DALL-E 3', slug: 'dall-e-3', provider_id: '1', provider_name: 'OpenAI',
    model_identifier: 'dall-e-3', model_type: 'image_generation', description: 'Best image generation',
    input_price_per_million: 0, output_price_per_million: 0, context_window: 0,
    is_available: true, is_featured: true, is_open_source: false,
    avg_latency_ms: 15000, capabilities: { text: true },
    benchmarks: {}, avg_rating: 4.3, total_ratings: 90, total_api_calls: 30000,
    uptime_percentage: 99.5, status: 'active',
  },
  {
    id: '4', name: 'Gemini 2.0 Pro', slug: 'gemini-2-pro', provider_id: '3', provider_name: 'Google',
    model_identifier: 'gemini-2.0-pro', model_type: 'llm', description: 'Google\'s most capable model',
    input_price_per_million: 2.5, output_price_per_million: 10, context_window: 1000000,
    is_available: true, is_featured: false, is_open_source: false,
    avg_latency_ms: 600, capabilities: { text: true, vision: true, code: true },
    benchmarks: { mmlu: 87.5 }, avg_rating: 4.4, total_ratings: 150, total_api_calls: 60000,
    uptime_percentage: 99.7, status: 'active',
  },
  {
    id: '5', name: 'Llama 3.3 70B', slug: 'llama-3-3-70b', provider_id: '4', provider_name: 'Meta',
    model_identifier: 'llama-3.3-70b', model_type: 'llm', description: 'Open source powerhouse',
    input_price_per_million: 0.8, output_price_per_million: 0.8, context_window: 128000,
    is_available: true, is_featured: false, is_open_source: true,
    avg_latency_ms: 400, capabilities: { text: true, code: true },
    benchmarks: { mmlu: 83.0 }, avg_rating: 4.1, total_ratings: 80, total_api_calls: 40000,
    uptime_percentage: 99.6, status: 'active',
  },
  {
    id: '6', name: 'ElevenLabs TTS', slug: 'elevenlabs-tts', provider_id: '5', provider_name: 'ElevenLabs',
    model_identifier: 'eleven-multilingual-v2', model_type: 'text_to_speech', description: 'Best text-to-speech',
    input_price_per_million: 0, output_price_per_million: 0, context_window: 0,
    is_available: true, is_featured: true, is_open_source: false,
    avg_latency_ms: 500, capabilities: { text: true, audio: true },
    benchmarks: {}, avg_rating: 4.6, total_ratings: 70, total_api_calls: 20000,
    uptime_percentage: 99.4, status: 'active',
  },
]

export default function AdminModelsPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch models
  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['admin-models', typeFilter, providerFilter],
    queryFn: async () => {
      return { data: mockModels, total: mockModels.length }
    }
  })

  const modelsRaw = modelsData?.data as any
  const models: AIModel[] = Array.isArray(modelsRaw) ? modelsRaw : (modelsRaw?.models || modelsRaw?.items || modelsRaw?.data || [])

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          model.provider_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || model.model_type === typeFilter
    const matchesProvider = providerFilter === 'all' || model.provider_name === providerFilter
    return matchesSearch && matchesType && matchesProvider
  })

  // Update model mutation
  const updateModelMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<AIModel> }) => {
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] })
      toast.success('Model updated successfully')
      setShowEditModal(false)
    },
    onError: () => {
      toast.error('Failed to update model')
    }
  })

  // Toggle availability
  const toggleAvailability = (model: AIModel) => {
    updateModelMutation.mutate({ id: model.id, updates: { is_available: !model.is_available } })
  }

  // Toggle featured
  const toggleFeatured = (model: AIModel) => {
    updateModelMutation.mutate({ id: model.id, updates: { is_featured: !model.is_featured } })
  }

  const providers = Array.from(new Set(models.map(m => m.provider_name)))
  const totalPages = Math.ceil(filteredModels.length / itemsPerPage)
  const paginatedModels = filteredModels.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'llm': return 'violet'
      case 'image_generation': return 'pink'
      case 'text_to_speech': case 'audio_generation': case 'audio_transcription': return 'cyan'
      case 'video_generation': return 'orange'
      case 'embedding': return 'emerald'
      default: return 'gray'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-white">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Models</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-400" />
            Model Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
            Add Model
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{models.length}</p>
              <p className="text-sm text-gray-400">Total Models</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {models.filter(m => m.is_available).length}
              </p>
              <p className="text-sm text-gray-400">Available</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Star className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {models.filter(m => m.is_featured).length}
              </p>
              <p className="text-sm text-gray-400">Featured</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{providers.length}</p>
              <p className="text-sm text-gray-400">Providers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card variant="bordered" padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'llm', label: 'LLM' },
              { value: 'image', label: 'Image' },
              { value: 'audio', label: 'Audio' },
              { value: 'video', label: 'Video' },
              { value: 'embedding', label: 'Embedding' },
            ]}
            className="w-40"
          />
          <Select
            value={providerFilter}
            onValueChange={setProviderFilter}
            options={[
              { value: 'all', label: 'All Providers' },
              ...providers.map(p => ({ value: p, label: p }))
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* Models Table */}
      <Card variant="bordered" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Model</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Provider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Pricing (per 1M)</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Latency</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedModels.map((model) => (
                <tr key={model.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        model.model_type === 'llm' ? 'bg-violet-500/20' :
                        model.model_type === 'image' ? 'bg-pink-500/20' :
                        model.model_type === 'audio' ? 'bg-cyan-500/20' : 'bg-gray-500/20'
                      }`}>
                        <Bot className={`w-5 h-5 ${
                          model.model_type === 'llm' ? 'text-violet-400' :
                          model.model_type === 'image' ? 'text-pink-400' :
                          model.model_type === 'audio' ? 'text-cyan-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{model.name}</p>
                          {model.is_featured && (
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{model.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getTypeColor(model.model_type) as any}>
                      {model.model_type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">{model.provider_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-emerald-400">In: ${model.input_price_per_million}</p>
                      <p className="text-orange-400">Out: ${model.output_price_per_million}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">{model.avg_latency_ms}ms</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={model.is_available ? 'success' : 'danger'}>
                      {model.is_available ? 'Available' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedModel(model)
                          setShowEditModal(true)
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => toggleFeatured(model)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title={model.is_featured ? 'Unfeature' : 'Feature'}
                      >
                        {model.is_featured ? (
                          <StarOff className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Star className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleAvailability(model)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title={model.is_available ? 'Disable' : 'Enable'}
                      >
                        {model.is_available ? (
                          <EyeOff className="w-4 h-4 text-green-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <p className="text-sm text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredModels.length)} of {filteredModels.length} models
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1 text-sm text-white">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onOpenChange={() => setShowEditModal(false)}
        title="Edit Model"
        size="lg"
      >
        {selectedModel && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Model Name"
                value={selectedModel.name}
                onChange={(e) => setSelectedModel({ ...selectedModel, name: e.target.value })}
              />
              <Input
                label="Slug"
                value={selectedModel.slug}
                onChange={(e) => setSelectedModel({ ...selectedModel, slug: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={selectedModel.description}
                onChange={(e) => setSelectedModel({ ...selectedModel, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Input Cost (per 1M tokens)"
                type="number"
                value={String(selectedModel.input_price_per_million ?? 0)}
                onChange={(e) => setSelectedModel({ ...selectedModel, input_price_per_million: parseFloat(e.target.value) })}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />
              <Input
                label="Output Cost (per 1M tokens)"
                type="number"
                value={String(selectedModel.output_price_per_million ?? 0)}
                onChange={(e) => setSelectedModel({ ...selectedModel, output_price_per_million: parseFloat(e.target.value) })}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Context Window"
                type="number"
                value={String(selectedModel.context_window)}
                onChange={(e) => setSelectedModel({ ...selectedModel, context_window: parseInt(e.target.value) })}
              />
              <Input
                label="Average Latency (ms)"
                type="number"
                value={String(selectedModel.avg_latency_ms)}
                onChange={(e) => setSelectedModel({ ...selectedModel, avg_latency_ms: parseInt(e.target.value) })}
                leftIcon={<Zap className="w-4 h-4" />}
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModel.is_available}
                  onChange={(e) => setSelectedModel({ ...selectedModel, is_available: e.target.checked })}
                  className="rounded border-gray-600 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-gray-300">Available</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModel.is_featured}
                  onChange={(e) => setSelectedModel({ ...selectedModel, is_featured: e.target.checked })}
                  className="rounded border-gray-600 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-gray-300">Featured</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => updateModelMutation.mutate({ id: selectedModel.id, updates: selectedModel })}
                isLoading={updateModelMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
