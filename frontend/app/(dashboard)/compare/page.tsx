'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, Plus, X, ArrowRight, Zap, DollarSign, Clock, Star, Check } from 'lucide-react'
import { modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { formatNumber, formatCurrency } from '@/lib/utils'
import type { AIModel } from '@/lib/types'

export default function ComparePage() {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['models', 'compare'],
    queryFn: () => modelsApi.list({ page_size: 100 }),
  })

  const models = modelsData?.data?.models || []
  const filteredModels = models.filter((m: AIModel) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.provider_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedModelData = models.filter((m: AIModel) => selectedModels.includes(m.id))

  const addModel = (id: string) => {
    if (selectedModels.length < 4 && !selectedModels.includes(id)) {
      setSelectedModels([...selectedModels, id])
    }
  }

  const removeModel = (id: string) => {
    setSelectedModels(selectedModels.filter(m => m !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GitCompare className="w-7 h-7 text-violet-400" />
            Compare AI Models
          </h1>
          <p className="text-gray-400 mt-1">Select up to 4 models to compare side by side</p>
        </div>
      </div>

      {/* Model Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search models to compare..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Selected Models */}
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedModels.length === 0 && (
              <span className="text-gray-500 text-sm">No models selected. Click on models below to add them.</span>
            )}
            {selectedModelData.map((model: AIModel) => (
              <div
                key={model.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full text-violet-300"
              >
                <span className="text-sm">{model.name}</span>
                <button onClick={() => removeModel(model.id)} className="hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Available Models Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
            {filteredModels.slice(0, 20).map((model: AIModel) => (
              <button
                key={model.id}
                onClick={() => selectedModels.includes(model.id) ? removeModel(model.id) : addModel(model.id)}
                disabled={selectedModels.length >= 4 && !selectedModels.includes(model.id)}
                className={`p-2 text-left rounded-lg border transition-all ${
                  selectedModels.includes(model.id)
                    ? 'bg-violet-500/20 border-violet-500/50 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 disabled:opacity-50'
                }`}
              >
                <div className="font-medium text-sm truncate">{model.name}</div>
                <div className="text-xs text-gray-500 truncate">{model.provider_name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {selectedModelData.length >= 2 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                  {selectedModelData.map((model: AIModel) => (
                    <th key={model.id} className="text-left p-4 text-white font-medium min-w-[200px]">
                      <div>{model.name}</div>
                      <div className="text-xs text-gray-500 font-normal">{model.provider_name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><Star className="w-4 h-4 inline mr-2" />Rating</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4 text-white">
                      {(model.avg_rating ?? 0).toFixed(1)} / 5.0
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><DollarSign className="w-4 h-4 inline mr-2" />Input Price</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4 text-white">
                      ${model.input_price_per_million ?? 0}/M tokens
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><DollarSign className="w-4 h-4 inline mr-2" />Output Price</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4 text-white">
                      ${model.output_price_per_million ?? 0}/M tokens
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><Zap className="w-4 h-4 inline mr-2" />Context Window</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4 text-white">
                      {formatNumber(model.context_window)} tokens
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><Clock className="w-4 h-4 inline mr-2" />Latency</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4 text-white">
                      {model.avg_latency_ms ?? 'N/A'} ms
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-4 text-gray-400"><Check className="w-4 h-4 inline mr-2" />Open Source</td>
                  {selectedModelData.map((model: AIModel) => (
                    <td key={model.id} className="p-4">
                      <span className={model.is_open_source ? 'text-green-400' : 'text-gray-500'}>
                        {model.is_open_source ? 'Yes' : 'No'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selectedModelData.length < 2 && selectedModels.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">Select at least 2 models to compare</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
