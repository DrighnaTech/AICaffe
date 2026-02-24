'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Sparkles, Target, Zap, Clock, DollarSign, Check, ArrowRight, Loader2 } from 'lucide-react'
import { recommendApi, modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Link from 'next/link'
import type { AIModel } from '@/lib/types'

const USE_CASES = [
  { id: 'chatbot', label: 'Conversational Chatbot', icon: '💬' },
  { id: 'code', label: 'Code Generation', icon: '💻' },
  { id: 'creative', label: 'Creative Writing', icon: '✍️' },
  { id: 'analysis', label: 'Data Analysis', icon: '📊' },
  { id: 'research', label: 'Research & Summarization', icon: '🔬' },
  { id: 'translation', label: 'Translation', icon: '🌍' },
  { id: 'image', label: 'Image Generation', icon: '🎨' },
  { id: 'audio', label: 'Audio Processing', icon: '🎵' },
]

const PRIORITIES = [
  { id: 'speed', label: 'Speed', icon: Zap, description: 'Fastest response times' },
  { id: 'quality', label: 'Quality', icon: Target, description: 'Best output quality' },
  { id: 'cost', label: 'Cost', icon: DollarSign, description: 'Most affordable option' },
  { id: 'balanced', label: 'Balanced', icon: Check, description: 'Best overall value' },
]

export default function RecommendationsPage() {
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<string>('balanced')

  const recommendMutation = useMutation({
    mutationFn: (data: { purpose: string; priority: string }) =>
      recommendApi.quick(data),
  })

  const handleGetRecommendations = () => {
    if (selectedUseCase) {
      recommendMutation.mutate({
        purpose: selectedUseCase,
        priority: selectedPriority,
      })
    }
  }

  const rawRecommendations = recommendMutation.data?.data as any
  const recommendations = rawRecommendations?.recommendations || (Array.isArray(rawRecommendations) ? rawRecommendations : [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-violet-400" />
            AI Model Recommendations
          </h1>
          <p className="text-gray-400 mt-1">Find the perfect AI model for your use case</p>
        </div>
      </div>

      {/* Use Case Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">What do you want to build?</h2>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {USE_CASES.map((useCase) => (
              <button
                key={useCase.id}
                onClick={() => setSelectedUseCase(useCase.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedUseCase === useCase.id
                    ? 'bg-violet-500/20 border-violet-500/50 text-white'
                    : 'bg-gray-800/30 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">{useCase.icon}</div>
                <div className="font-medium text-sm">{useCase.label}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">What matters most?</h2>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PRIORITIES.map((priority) => {
              const Icon = priority.icon
              return (
                <button
                  key={priority.id}
                  onClick={() => setSelectedPriority(priority.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedPriority === priority.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                      : 'bg-gray-800/30 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${selectedPriority === priority.id ? 'text-cyan-400' : 'text-gray-500'}`} />
                  <div className="font-medium text-sm">{priority.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{priority.description}</div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Get Recommendations Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleGetRecommendations}
          disabled={!selectedUseCase || recommendMutation.isPending}
          className="px-8 py-3"
        >
          {recommendMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Finding best models...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Get Recommendations
            </>
          )}
        </Button>
      </div>

      {/* Recommendations Results */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">Recommended Models</h2>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {recommendations.map((rec: any, index: number) => (
              <div
                key={rec.model_id || index}
                className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{rec.model_name || rec.name}</h3>
                    <p className="text-sm text-gray-400">{rec.provider || rec.provider_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Match Score</div>
                    <div className="font-bold text-green-400">{rec.score || rec.match_score || 95}%</div>
                  </div>
                  <Link href={`/models/${rec.model_id || rec.slug}`}>
                    <Button variant="outline" size="sm">
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {recommendMutation.isSuccess && recommendations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">No recommendations found. Try adjusting your criteria.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
