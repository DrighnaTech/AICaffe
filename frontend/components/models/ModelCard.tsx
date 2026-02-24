'use client'

import Link from 'next/link'
import { Star, Zap, DollarSign, Clock, Check, Plus, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useCompareStore } from '@/lib/store'
import { formatNumber, formatCurrency, getModelTypeLabel, getModelTypeColor } from '@/lib/utils'
import type { AIModel } from '@/lib/types'

interface ModelCardProps {
  model: AIModel
  showCompareButton?: boolean
  onSelect?: (model: AIModel) => void
}

export function ModelCard({ model, showCompareButton = true, onSelect }: ModelCardProps) {
  const { selectedModels, addModel, removeModel } = useCompareStore()
  const isSelected = selectedModels.includes(model.id)
  const canAddMore = selectedModels.length < 5

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSelected) {
      removeModel(model.id)
    } else if (canAddMore) {
      addModel(model.id)
    }
  }

  const inputPrice = model.input_price_per_million
  const outputPrice = model.output_price_per_million

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group"
    >
      <Link href={`/models/${model.slug}`}>
        <div className="relative bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/50 hover:border-gray-700 transition-all h-full">
          {/* Featured Badge */}
          {model.is_featured && (
            <div className="absolute -top-2 -right-2">
              <Badge variant="purple" size="sm">Featured</Badge>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              {model.logo_url ? (
                <img src={model.logo_url} alt={model.name} className="w-8 h-8 rounded" />
              ) : (
                <span className="text-lg font-bold text-white">
                  {model.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
                {model.name}
              </h3>
              <p className="text-sm text-gray-500">{model.provider_name}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">
            {model.short_description || model.description}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className={getModelTypeColor(model.model_type)} size="sm">
              {getModelTypeLabel(model.model_type)}
            </Badge>
            {model.is_open_source && (
              <Badge variant="success" size="sm">Open Source</Badge>
            )}
            {model.capabilities?.vision && (
              <Badge variant="info" size="sm">Vision</Badge>
            )}
            {model.capabilities?.function_calling && (
              <Badge variant="default" size="sm">Tools</Badge>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Rating */}
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-medium">{model.avg_rating.toFixed(1)}</span>
              <span className="text-gray-500">({formatNumber(model.total_ratings)})</span>
            </div>

            {/* Latency */}
            {model.avg_latency_ms && (
              <div className="flex items-center gap-1.5 text-sm">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-300">{model.avg_latency_ms}ms</span>
              </div>
            )}

            {/* Context Window */}
            {model.context_window && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300">{formatNumber(model.context_window)} ctx</span>
              </div>
            )}

            {/* API Calls */}
            <div className="flex items-center gap-1.5 text-sm">
              <ExternalLink className="w-4 h-4 text-gray-500" />
              <span className="text-gray-300">{formatNumber(model.total_api_calls)} calls</span>
            </div>
          </div>

          {/* Pricing */}
          {(inputPrice || outputPrice) && (
            <div className="flex items-center justify-between py-3 border-t border-gray-800">
              <div className="text-sm">
                <span className="text-gray-500">Input:</span>
                <span className="text-white ml-1">
                  {inputPrice ? formatCurrency(inputPrice) : 'N/A'}
                </span>
                <span className="text-gray-600">/1M</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Output:</span>
                <span className="text-white ml-1">
                  {outputPrice ? formatCurrency(outputPrice) : 'N/A'}
                </span>
                <span className="text-gray-600">/1M</span>
              </div>
            </div>
          )}

          {/* Compare Button */}
          {showCompareButton && (
            <div className="pt-3 border-t border-gray-800">
              <Button
                variant={isSelected ? 'primary' : 'outline'}
                size="sm"
                className="w-full"
                onClick={handleCompareToggle}
                disabled={!isSelected && !canAddMore}
                leftIcon={isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {isSelected ? 'Added to Compare' : 'Add to Compare'}
              </Button>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
