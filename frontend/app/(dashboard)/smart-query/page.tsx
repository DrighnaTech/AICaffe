'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Sparkles, Users, Zap, MessageSquare, CheckCircle2,
  Loader2, ChevronDown, Copy, ThumbsUp, ThumbsDown, RefreshCw,
  Target, Scale, Lightbulb, FileCheck, Wand2, Network,
  Wallet, Cpu, ArrowRightLeft, ChevronRight, X, Play, Eye, Square, User,
  Shield, PenTool, GitCompare, BarChart3, TrendingUp
} from 'lucide-react'
import { orchestratorApi, tokensApi, recommendApi, modelsApi, AgentRole, TaskType } from '@/lib/api'
import { useAuthStore, useWalletStore } from '@/lib/store'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import type { AIModel } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Constants ────────────────────────────────────────────────────────────

const TOKENS_PER_USD = 20_000

const TASK_TYPES = [
  { id: 'simple', label: 'Simple', desc: 'Single agent, fast response', icon: Zap },
  { id: 'parallel', label: 'Parallel', desc: 'Multiple agents in parallel', icon: Users },
  { id: 'debate', label: 'Debate', desc: 'Agents debate for best answer', icon: Scale },
  { id: 'consensus', label: 'Consensus', desc: 'Find common ground', icon: Target },
  { id: 'expert_panel', label: 'Expert Panel', desc: 'Domain experts collaborate', icon: Brain },
]

const EXPERT_AGENTS: { id: AgentRole; name: string; desc: string; icon: any; color: string }[] = [
  { id: 'researcher', name: 'Researcher', desc: 'Deep research & fact-finding', icon: FileCheck, color: 'text-blue-400' },
  { id: 'analyst', name: 'Analyst', desc: 'Data analysis & insights', icon: Target, color: 'text-green-400' },
  { id: 'writer', name: 'Writer', desc: 'Clear, engaging content', icon: MessageSquare, color: 'text-purple-400' },
  { id: 'critic', name: 'Critic', desc: 'Critical evaluation', icon: Scale, color: 'text-red-400' },
  { id: 'synthesizer', name: 'Synthesizer', desc: 'Combine multiple sources', icon: Network, color: 'text-cyan-400' },
  { id: 'fact_checker', name: 'Fact Checker', desc: 'Verify accuracy', icon: CheckCircle2, color: 'text-yellow-400' },
  { id: 'creative', name: 'Creative', desc: 'Innovative ideas', icon: Lightbulb, color: 'text-pink-400' },
  { id: 'technical', name: 'Technical', desc: 'Technical expertise', icon: Wand2, color: 'text-orange-400' },
]

const AGENT_COLOR_MAP: Record<string, string> = {
  researcher: 'bg-blue-500/20 text-blue-400',
  analyst: 'bg-green-500/20 text-green-400',
  writer: 'bg-purple-500/20 text-purple-400',
  critic: 'bg-red-500/20 text-red-400',
  synthesizer: 'bg-cyan-500/20 text-cyan-400',
  fact_checker: 'bg-yellow-500/20 text-yellow-400',
  creative: 'bg-pink-500/20 text-pink-400',
  technical: 'bg-orange-500/20 text-orange-400',
}

// Reasoning/slow models to skip for standard tasks
const REASONING_PATTERNS = ['reasoner', 'deepseek-r1', 'o1-preview', 'o1-mini', '-r1']
const isReasoningModel = (m: AIModel) =>
  REASONING_PATTERNS.some((p) => m.model_identifier.toLowerCase().includes(p))

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function toStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

// ── Types ────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system-notice'
  content: string
  modelName?: string
  tokens?: number
  timestamp: Date
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function SmartQueryPage() {
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [query, setQuery] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('parallel')
  const [selectedAgents, setSelectedAgents] = useState<AgentRole[]>(['researcher', 'analyst', 'writer'])
  const [useSmartMode, setUseSmartMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAgentDetails, setShowAgentDetails] = useState(false)

  // Model selection
  const [modelOverride, setModelOverride] = useState<AIModel | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)

  // Recommendation flow (two-step for first query in Smart Mode)
  const [showRecommendation, setShowRecommendation] = useState(false)
  const [pendingQuery, setPendingQuery] = useState('')

  // Conversation threading (like AI Hub)
  const [conversationThread, setConversationThread] = useState<{ role: string; content: string }[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [lastUsedModelName, setLastUsedModelName] = useState<string | null>(null)

  // Streaming
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState('')

  // Orchestration result (for manual mode)
  const [orchResult, setOrchResult] = useState<any>(null)

  // Task analysis from smart-query endpoint (doc §18: Task Decomposer)
  const [taskAnalysis, setTaskAnalysis] = useState<any>(null)

  // Post-response actions (doc §18: Verification Layer)
  const [factCheckResult, setFactCheckResult] = useState<string | null>(null)
  const [isFactChecking, setIsFactChecking] = useState(false)
  const [improveResult, setImproveResult] = useState<string | null>(null)
  const [isImproving, setIsImproving] = useState(false)

  // Multi-model comparison mode (doc §18: Consensus Engine)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<any>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonAgents, setComparisonAgents] = useState<AgentRole[]>(['researcher', 'analyst', 'writer'])

  // ── Data queries ─────────────────────────────────────────────────────

  const token = useAuthStore((s) => s.token)
  const deduct = useWalletStore((s) => s.deduct)

  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ['smart-query-wallet'],
    queryFn: () => tokensApi.wallet(),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const { data: modelsData } = useQuery({
    queryKey: ['smart-query-models'],
    queryFn: () => modelsApi.list({ status: 'active', limit: 200 }),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  })

  // Recommendation (manual trigger)
  const { data: recommendationData, isFetching: isRecommending, refetch: fetchRecommendation } = useQuery({
    queryKey: ['smart-recommend', pendingQuery],
    queryFn: () => recommendApi.quick({ purpose: pendingQuery, priority: 'balanced' }),
    enabled: false,
    retry: false,
  })

  const wallet = walletData?.data?.wallet
  const recommendations = recommendationData?.data?.recommendations || []
  const topRecommendation = recommendations[0]
  const allModels: AIModel[] = modelsData?.data?.models || modelsData?.data || []

  // Grouped models for picker dropdown (memoized)
  const groupedModels = useMemo(() => {
    const ROUTABLE = ['llm', 'multimodal', 'code_generation']
    const routableModels = allModels
      .filter((m) => ROUTABLE.includes(m.model_type) && m.status === 'active' && !isReasoningModel(m))
      .sort((a, b) => (a.provider_name || '').localeCompare(b.provider_name || ''))
    const grouped: Record<string, AIModel[]> = {}
    for (const m of routableModels) {
      const provider = m.provider_name || 'Other'
      if (!grouped[provider]) grouped[provider] = []
      grouped[provider].push(m)
    }
    return grouped
  }, [allModels])

  // Effective model: override > recommendation-matched model > first available
  const recommendedModel = useMemo(() => {
    if (!topRecommendation?.model_id) return null
    return allModels.find((m) => m.id === topRecommendation.model_id) || null
  }, [topRecommendation, allModels])

  const effectiveModel = useMemo(
    () => modelOverride || recommendedModel || allModels.find((m) => m.status === 'active' && !isReasoningModel(m)) || null,
    [modelOverride, recommendedModel, allModels]
  )

  // Whether we're in conversation mode (have chat history)
  const hasConversation = chatMessages.length > 0

  // ── Orchestration result helpers ──────────────────────────────────────

  const orchData = orchResult
  const orchResultInner = orchData?.result || orchData
  const orchResponse = toStr(orchResultInner?.final_response || orchResultInner?.synthesized_response || orchResultInner?.response || '')
  const agentResponses: any[] = orchResultInner?.agent_responses || []
  const orchTotalTokens = orchResultInner?.total_tokens || 0
  const orchTotalLatency = orchResultInner?.total_latency_ms || 0
  const orchQuality = orchResultInner?.quality_score || orchResultInner?.confidence || 0
  const orchTaskType = toStr(orchResultInner?.task_type || orchData?.analysis?.best_task_type || '')

  // ── Handlers ─────────────────────────────────────────────────────────

  const toggleAgent = (agent: AgentRole) => {
    if (selectedAgents.includes(agent)) {
      setSelectedAgents(selectedAgents.filter(a => a !== agent))
    } else {
      setSelectedAgents([...selectedAgents, agent])
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  /** Step 1: User clicks "Analyze" — routes based on mode */
  const handleAnalyze = () => {
    if (!query.trim()) return
    setError(null)

    if (comparisonMode) {
      // Comparison mode: run multi-model comparison
      handleCompare()
    } else if (useSmartMode && !hasConversation) {
      // First Smart Mode query: show recommendation panel
      setPendingQuery(query.trim())
      setShowRecommendation(true)
      setTimeout(() => fetchRecommendation(), 50)
    } else if (useSmartMode) {
      // Follow-up: stream directly with current model
      handleStreamSmart()
    } else {
      // Manual mode: orchestration
      handleExecuteOrchestration(query.trim())
    }
  }

  /** Smart Mode: Stream from single AI model with full conversation context */
  const handleStreamSmart = useCallback(async () => {
    const q = pendingQuery || query.trim()
    if (!q || isStreaming) return
    if (!effectiveModel) {
      toast.error('No model available — please wait for models to load or select manually')
      return
    }

    const currentModelName = effectiveModel.name
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setStreamedContent('')
    setError(null)
    setShowRecommendation(false)

    // Track messages added for rollback on error
    let messagesAdded = 0

    // Add model-switch notice if model changed mid-conversation
    if (lastUsedModelName && lastUsedModelName !== currentModelName) {
      setChatMessages((prev) => [...prev, {
        role: 'system-notice' as const,
        content: `Switched from ${lastUsedModelName} → ${currentModelName}`,
        timestamp: new Date(),
      }])
      messagesAdded++
    }

    // Add user message to visible chat
    setChatMessages((prev) => [...prev, {
      role: 'user' as const,
      content: q,
      timestamp: new Date(),
    }])
    messagesAdded++

    // Auto-scroll
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    let accumulated = ''
    let tokensCharged = 0
    let totalTokens = 0

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: effectiveModel.id,
          messages: [...conversationThread, { role: 'user', content: q }],
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const msg = errBody?.error?.message || errBody?.detail || `Request failed (HTTP ${response.status})`
        throw new Error(msg)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false

      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { done = true; break }
          try {
            const chunk = JSON.parse(raw)
            if (chunk.error) throw new Error(chunk.error.message || 'Stream error from provider')
            const delta = chunk.choices?.[0]?.delta?.content || ''
            if (delta) {
              accumulated += delta
              setStreamedContent(accumulated)
            }
            if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens
            if (chunk.aicaffe_tokens_charged) tokensCharged = chunk.aicaffe_tokens_charged
          } catch (parseErr: any) {
            if (!(parseErr instanceof SyntaxError)) throw parseErr
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped — keep whatever streamed so far
      } else {
        toast.error(err.message || 'Request failed')
        if (messagesAdded > 0) {
          setChatMessages((prev) => prev.slice(0, -messagesAdded))
        }
        setIsStreaming(false)
        setStreamedContent('')
        return
      }
    }

    // Empty response check
    if (!accumulated) {
      if (messagesAdded > 0) {
        setChatMessages((prev) => prev.slice(0, -messagesAdded))
      }
      if (!controller.signal.aborted) {
        toast.error(`${currentModelName} returned an empty response — try again or switch model`)
      }
      setIsStreaming(false)
      setStreamedContent('')
      return
    }

    // Finalize: add to conversation thread + visible chat
    setConversationThread((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: accumulated },
    ])
    setChatMessages((prev) => [...prev, {
      role: 'assistant' as const,
      content: accumulated,
      modelName: currentModelName,
      tokens: totalTokens,
      timestamp: new Date(),
    }])
    setLastUsedModelName(currentModelName)
    if (tokensCharged > 0) deduct(tokensCharged)
    setIsStreaming(false)
    setStreamedContent('')
    setQuery('')
    setPendingQuery('')
    refetchWallet()
    setTimeout(() => followUpRef.current?.focus(), 100)
  }, [query, pendingQuery, effectiveModel, isStreaming, token, deduct, conversationThread, lastUsedModelName, refetchWallet])

  /** Manual Mode: Call orchestrator for multi-agent response */
  const handleExecuteOrchestration = async (q?: string) => {
    const queryText = q || query.trim()
    if (!queryText) return

    setLoading(true)
    setError(null)
    setOrchResult(null)

    // Add user message
    setChatMessages((prev) => [...prev, {
      role: 'user' as const,
      content: queryText,
      timestamp: new Date(),
    }])

    try {
      const prefs = modelOverride ? { model_override: modelOverride.id } : undefined
      const response = await orchestratorApi.orchestrate({
        query: queryText,
        task_type: taskType,
        agents: selectedAgents,
        quality_threshold: 0.7,
        preferences: prefs,
      })
      const data = response.data
      setOrchResult(data)
      const resultInner = data?.result || data
      const responseText = toStr(resultInner?.final_response || resultInner?.synthesized_response || resultInner?.response || '')

      // Add to chat + thread
      setChatMessages((prev) => [...prev, {
        role: 'assistant' as const,
        content: responseText || 'No response text returned.',
        modelName: `Orchestration (${taskType})`,
        timestamp: new Date(),
      }])
      setConversationThread((prev) => [
        ...prev,
        { role: 'user', content: queryText },
        { role: 'assistant', content: responseText },
      ])
      setQuery('')
      refetchWallet()
    } catch (err: any) {
      const errData = err.response?.data
      const detail = errData?.detail || errData?.error?.message || errData?.error || err.message || 'Failed to process query'
      setError(toStr(detail))
      // Rollback user message
      setChatMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleNewConversation = () => {
    setConversationThread([])
    setChatMessages([])
    setOrchResult(null)
    setQuery('')
    setPendingQuery('')
    setError(null)
    setLastUsedModelName(null)
    setShowRecommendation(false)
    setStreamedContent('')
    setShowModelPicker(false)
    setTaskAnalysis(null)
    setFactCheckResult(null)
    setImproveResult(null)
    setComparisonResult(null)
  }

  /** Auto Smart Query — uses orchestratorApi.smartQuery() (doc §18: auto-determines best approach) */
  const handleAutoSmartQuery = async () => {
    const q = pendingQuery || query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setShowRecommendation(false)
    setTaskAnalysis(null)

    setChatMessages((prev) => [...prev, {
      role: 'user' as const,
      content: q,
      timestamp: new Date(),
    }])

    try {
      const response = await orchestratorApi.smartQuery({
        query: q,
        context: conversationThread.length > 0
          ? conversationThread.map(m => `${m.role}: ${m.content}`).join('\n')
          : undefined,
      })
      const data = response.data
      setTaskAnalysis(data?.analysis || null)
      setOrchResult(data?.result || data)

      const resultInner = data?.result || data
      const responseText = toStr(resultInner?.final_response || resultInner?.synthesized_response || resultInner?.response || '')
      const agentCount = resultInner?.agent_responses?.length || 0
      const taskTypeUsed = data?.analysis?.best_task_type || resultInner?.task_type || 'smart'

      setChatMessages((prev) => [...prev, {
        role: 'assistant' as const,
        content: responseText || 'No response returned.',
        modelName: `Smart Query (${taskTypeUsed}${agentCount > 0 ? `, ${agentCount} agents` : ''})`,
        tokens: resultInner?.total_tokens || 0,
        timestamp: new Date(),
      }])
      setConversationThread((prev) => [
        ...prev,
        { role: 'user', content: q },
        { role: 'assistant', content: responseText },
      ])
      setQuery('')
      setPendingQuery('')
      refetchWallet()
    } catch (err: any) {
      const errData = err.response?.data
      const detail = errData?.detail || errData?.error?.message || errData?.error || err.message || 'Smart query failed'
      setError(toStr(detail))
      setChatMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  /** Fact-check the last assistant response (doc §18: Verification Layer) */
  const handleFactCheck = async () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return

    setIsFactChecking(true)
    setFactCheckResult(null)
    try {
      const response = await orchestratorApi.factCheck({ content: lastAssistant.content })
      setFactCheckResult(response.data?.fact_check_report || 'No fact-check report returned.')
    } catch (err: any) {
      toast.error('Fact-check failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsFactChecking(false)
    }
  }

  /** Improve the last assistant response (doc §18: Write-Review-Test quality) */
  const handleImprove = async (type: 'clarity' | 'accuracy' | 'engagement' | 'seo' | 'technical' | 'creative') => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return

    setIsImproving(true)
    setImproveResult(null)
    try {
      const response = await orchestratorApi.improveContent({
        content: lastAssistant.content,
        improvement_type: type,
      })
      setImproveResult(response.data?.improved || 'No improvement returned.')
    } catch (err: any) {
      toast.error('Improve failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsImproving(false)
    }
  }

  /** Multi-model comparison (doc §18: Consensus Engine) */
  const handleCompare = async () => {
    const q = query.trim() || pendingQuery
    if (!q) { toast.error('Enter a query first'); return }

    setIsComparing(true)
    setComparisonResult(null)
    try {
      const response = await orchestratorApi.compareAgents({
        query: q,
        agents: comparisonAgents,
      })
      setComparisonResult(response.data)
      setQuery('')
    } catch (err: any) {
      toast.error('Comparison failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsComparing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleAnalyze()
    }
    // Enter without shift in follow-up mode
    if (e.key === 'Enter' && !e.shiftKey && hasConversation) {
      e.preventDefault()
      handleAnalyze()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Smart Query</h1>
              <p className="text-sm text-gray-400">
                {useSmartMode ? 'Intelligent AI routing with conversation context' : 'Multi-agent AI orchestration'}
              </p>
            </div>
            {/* Wallet badge */}
            {wallet && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-sm font-medium text-white">{formatTokens(wallet.balance)}</span>
                <span className="text-xs text-gray-500">ACT</span>
              </div>
            )}
          </div>
        </div>

        {/* ── INITIAL INPUT (no conversation yet) ──────────────────────── */}
        {!hasConversation && !showRecommendation && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Mode Selector Tabs */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setUseSmartMode(true); setComparisonMode(false); setModelOverride(null); setShowModelPicker(false) }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      useSmartMode && !comparisonMode ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Smart Mode
                  </button>
                  <button
                    onClick={() => { setUseSmartMode(false); setComparisonMode(false); setModelOverride(null); setShowModelPicker(false) }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      !useSmartMode && !comparisonMode ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Multi-Agent
                  </button>
                  <button
                    onClick={() => { setComparisonMode(true); setUseSmartMode(false) }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      comparisonMode ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <GitCompare className="w-4 h-4" />
                    Compare
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 mt-2 text-center">
                  {useSmartMode && !comparisonMode && 'Auto-routes to the best AI model for your query'}
                  {!useSmartMode && !comparisonMode && 'Multiple expert agents collaborate on your response'}
                  {comparisonMode && 'Compare responses from multiple agents side-by-side'}
                </p>
              </div>

              {/* Query Input */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={useSmartMode
                    ? "Ask anything — Smart Mode will pick the best AI model for your query..."
                    : "Ask anything — multiple expert agents will collaborate on your response..."
                  }
                  className="w-full h-28 px-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAnalyze() } }}
                />
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800/50">
                  {/* Model selector (Smart Mode) */}
                  {useSmartMode && (
                    <div className="flex items-center gap-2 relative">
                      <button
                        onClick={() => setShowModelPicker(!showModelPicker)}
                        className="flex items-center gap-2 px-3 py-1 rounded-lg border border-gray-700 hover:border-violet-500/50 bg-gray-800/60 hover:bg-gray-800 transition-all cursor-pointer group"
                      >
                        <Brain className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs text-gray-300 font-medium">
                          {modelOverride ? modelOverride.name : effectiveModel?.name || 'Auto-select'}
                        </span>
                        {effectiveModel?.provider_name && (
                          <span className="text-xs text-gray-600">{effectiveModel.provider_name}</span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-violet-400 transition-all ${showModelPicker ? 'rotate-180' : ''}`} />
                      </button>
                      {modelOverride ? (
                        <>
                          <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            Manual override
                          </span>
                          <button
                            onClick={() => { setModelOverride(null); setShowModelPicker(false) }}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                            title="Reset to recommended"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                          Auto-recommended
                        </span>
                      )}

                      {/* Model picker dropdown */}
                      {showModelPicker && (
                        <div className="absolute bottom-full left-0 mb-2 w-96 max-h-80 overflow-y-auto bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50">
                          <div className="p-3 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl flex items-center justify-between">
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-violet-400" />
                              Select AI Model
                            </p>
                            <button onClick={() => setShowModelPicker(false)} className="text-gray-500 hover:text-gray-300">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-1">
                            {Object.entries(groupedModels).map(([provider, providerModels]) => (
                              <div key={provider}>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 pt-2 pb-1 font-semibold">
                                  {provider}
                                </p>
                                {providerModels.map((m) => {
                                  const isSelected = effectiveModel?.id === m.id
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => {
                                        if (recommendedModel?.id === m.id) {
                                          setModelOverride(null)
                                        } else {
                                          setModelOverride(m)
                                        }
                                        setShowModelPicker(false)
                                      }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                        isSelected
                                          ? 'bg-violet-500/20 text-white border border-violet-500/30'
                                          : 'text-gray-300 hover:bg-gray-700/50'
                                      }`}
                                    >
                                      <Eye className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                      <span className="flex-1 truncate">{m.name}</span>
                                      {isSelected && (
                                        <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/30 flex-shrink-0">
                                          Selected
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {!useSmartMode && <span className="text-xs text-gray-600">Multi-agent mode</span>}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{query.length} chars · Ctrl+Enter</span>
                    <button
                      onClick={handleAnalyze}
                      disabled={!query.trim() || loading || isStreaming}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      {useSmartMode ? 'Analyze & Recommend' : 'Run Query'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual Mode Configuration */}
              {!useSmartMode && !comparisonMode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Orchestration Mode</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {TASK_TYPES.map((type) => (
                        <button key={type.id} onClick={() => setTaskType(type.id as TaskType)}
                          className={`p-3 rounded-lg border transition-all text-left ${taskType === type.id ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                          <type.icon className={`w-5 h-5 mb-1 ${taskType === type.id ? 'text-violet-400' : 'text-gray-400'}`} />
                          <div className={`text-sm font-medium ${taskType === type.id ? 'text-white' : 'text-gray-300'}`}>{type.label}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{type.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Select Expert Agents ({selectedAgents.length})</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {EXPERT_AGENTS.map((agent) => (
                        <button key={agent.id} onClick={() => toggleAgent(agent.id)}
                          className={`p-3 rounded-lg border transition-all text-left ${selectedAgents.includes(agent.id) ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                          <agent.icon className={`w-5 h-5 mb-1 ${selectedAgents.includes(agent.id) ? agent.color : 'text-gray-400'}`} />
                          <div className={`text-sm font-medium ${selectedAgents.includes(agent.id) ? 'text-white' : 'text-gray-300'}`}>{agent.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{agent.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Comparison Mode Configuration (doc §18: Multi-Model Consensus Engine) */}
              {comparisonMode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 rounded-xl border border-amber-500/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GitCompare className="w-4 h-4 text-amber-400" />
                    <label className="text-sm font-medium text-gray-300">Select Agents to Compare ({comparisonAgents.length})</label>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Each agent will answer independently. Responses are scored on accuracy, completeness, clarity, and usefulness.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {EXPERT_AGENTS.map((agent) => {
                      const isSelected = comparisonAgents.includes(agent.id)
                      return (
                        <button key={agent.id} onClick={() => {
                          if (isSelected) setComparisonAgents(comparisonAgents.filter(a => a !== agent.id))
                          else setComparisonAgents([...comparisonAgents, agent.id])
                        }}
                          className={`p-3 rounded-lg border transition-all text-left ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                          <agent.icon className={`w-5 h-5 mb-1 ${isSelected ? agent.color : 'text-gray-400'}`} />
                          <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{agent.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Sidebar — How It Works + Quick Actions */}
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  How It Works
                </h3>
                <div className="space-y-2.5 text-sm">
                  {(comparisonMode ? [
                    'Select 2-5 expert agents to compare',
                    'Enter your query and click Compare',
                    'Each agent answers independently',
                    'AI evaluator scores & declares a winner',
                  ] : useSmartMode ? [
                    'Type your query and click Analyze',
                    'Review the recommended AI model',
                    'Accept or override with a different AI',
                    'Chat with follow-ups — context is preserved',
                    'Switch models anytime — conversation carries over',
                  ] : [
                    'Configure orchestration mode & agents',
                    'Type your query and click Run',
                    'Multiple agents collaborate on your query',
                    'Get a synthesized response from all agents',
                  ]).map((s, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-violet-400">{i + 1}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="font-medium text-white mb-3 text-sm">Quick Actions</h3>
                <div className="space-y-1.5">
                  {[
                    { q: 'Research the latest trends in AI and provide a comprehensive analysis', l: 'AI Trends Analysis' },
                    { q: 'Write a professional blog post about the future of remote work', l: 'Blog Post Writing' },
                    { q: 'Compare and contrast different cloud providers (AWS, GCP, Azure)', l: 'Comparison Analysis' },
                  ].map(({ q, l }) => (
                    <button key={l} onClick={() => { setQuery(q); setUseSmartMode(true) }}
                      className="w-full text-left p-2 text-xs text-gray-400 hover:bg-gray-800 rounded-lg flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-gray-600" />{l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RECOMMENDATION PANEL (first Smart Mode query) ─────────── */}
        {showRecommendation && !hasConversation && useSmartMode && (
          <div className="max-w-3xl mx-auto space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl border-2 border-violet-500/30 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-5 h-5 text-violet-400" />
                <h3 className="font-semibold text-white">AI Recommendation</h3>
                {isRecommending && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
              </div>

              <p className="text-sm text-gray-400">
                Query: <span className="text-gray-200">&ldquo;{pendingQuery.slice(0, 120)}{pendingQuery.length > 120 ? '...' : ''}&rdquo;</span>
              </p>

              {/* Task category badge */}
              {recommendationData?.data?.query?.task_category && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Detected task:</span>
                  <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 capitalize">
                    {recommendationData.data.query.task_category}
                  </span>
                  {recommendationData.data.query.task_confidence > 0 && (
                    <span className="text-xs text-gray-600">
                      ({Math.round(recommendationData.data.query.task_confidence * 100)}% confidence)
                    </span>
                  )}
                </div>
              )}

              {/* Top recommendation */}
              {topRecommendation && (
                <div className="flex items-start gap-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{topRecommendation.model_name}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-violet-500/20 text-violet-300 rounded">
                        {Math.round((topRecommendation.match_score || 0) * 100)}% match
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {topRecommendation.provider_name}
                      {topRecommendation.model_identifier && (
                        <span className="text-gray-600"> · {topRecommendation.model_identifier}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{toStr(topRecommendation.reasoning)}</p>
                    {topRecommendation.strengths?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {topRecommendation.strengths.slice(0, 4).map((s: string, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded">{toStr(s)}</span>
                        ))}
                      </div>
                    )}
                    {topRecommendation.estimated_cost_act != null && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        Est. cost: ~{topRecommendation.estimated_cost_act} ACT per query
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!topRecommendation && !isRecommending && (
                <p className="text-sm text-gray-500 italic">No recommendation available. Select a model manually below.</p>
              )}

              {/* Override: model picker inline */}
              <div className="relative">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  {showModelPicker ? 'Hide model list' : 'I want to use a different AI'}
                </button>

                {showModelPicker && (
                  <div className="mt-3 space-y-2">
                    {modelOverride && (
                      <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-white flex-1">Override: {modelOverride.name}</span>
                        <button onClick={() => setModelOverride(null)} className="text-gray-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {Object.entries(groupedModels).map(([provider, models]) => (
                        <div key={provider}>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 px-1">{provider}</p>
                          <div className="space-y-0.5">
                            {models.map((m) => {
                              const isSel = modelOverride?.id === m.id
                              return (
                                <button key={m.id} onClick={() => {
                                  if (isSel) setModelOverride(null)
                                  else setModelOverride(m)
                                }}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                    isSel ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' : 'text-gray-300 hover:bg-gray-800'
                                  }`}>
                                  {m.name}
                                  {recommendedModel?.id === m.id && (
                                    <span className="ml-2 text-[10px] text-violet-400">(Recommended)</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                <button
                  onClick={() => handleStreamSmart()}
                  disabled={isStreaming || (!modelOverride && !recommendedModel && !effectiveModel)}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4" />
                  {modelOverride
                    ? `Run with ${modelOverride.name}`
                    : `Run with ${effectiveModel?.name || 'Recommended AI'}`
                  }
                </button>
                <button
                  onClick={handleAutoSmartQuery}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/10 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  title="Auto-analyze query, pick agents + strategy, and execute"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Auto (Multi-Agent)
                </button>
                <button onClick={() => { setShowRecommendation(false); setPendingQuery('') }}
                  className="px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                  Back
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── CONVERSATION VIEW (chat messages + follow-up) ────────── */}
        {hasConversation && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Conversation header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
                    {Math.floor(conversationThread.length / 2)} {Math.floor(conversationThread.length / 2) === 1 ? 'exchange' : 'exchanges'}
                  </span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">Context preserved across messages</span>
                </div>
              </div>
              <button onClick={handleNewConversation}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-800 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> New Conversation
              </button>
            </div>

            {/* Chat Messages */}
            <div className="space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'system-notice' ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="h-px flex-1 bg-gray-800" />
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                        <span className="text-[11px] text-amber-400 font-medium">{msg.content}</span>
                      </div>
                      <div className="h-px flex-1 bg-gray-800" />
                    </div>
                  ) : msg.role === 'user' ? (
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-[80%] px-4 py-3 bg-violet-600/20 border border-violet-500/20 rounded-2xl rounded-tr-sm">
                        <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-violet-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <Brain className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Model name badge */}
                        {msg.modelName && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] text-cyan-400 font-medium">{msg.modelName}</span>
                            {msg.tokens != null && msg.tokens > 0 && (
                              <span className="text-[10px] text-gray-600">{formatTokens(msg.tokens)} tokens</span>
                            )}
                          </div>
                        )}
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                        {/* Actions (doc §18: Verification Layer) */}
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <button
                            onClick={() => copyToClipboard(msg.content)}
                            className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
                            title="Copy"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button className="p-1 text-gray-600 hover:text-green-400 rounded transition-colors" title="Helpful">
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors" title="Not helpful">
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                          {/* Verification actions — only on last assistant message */}
                          {i === chatMessages.length - 1 && (
                            <>
                              <span className="text-gray-800 mx-0.5">|</span>
                              <button
                                onClick={handleFactCheck}
                                disabled={isFactChecking}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors disabled:opacity-50"
                                title="Verify accuracy with fact-checker agent"
                              >
                                <Shield className="w-3 h-3" />
                                {isFactChecking ? 'Checking...' : 'Fact-check'}
                              </button>
                              <button
                                onClick={() => handleImprove('clarity')}
                                disabled={isImproving}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors disabled:opacity-50"
                                title="Improve clarity using expert agents"
                              >
                                <PenTool className="w-3 h-3" />
                                {isImproving ? 'Improving...' : 'Improve'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-cyan-400 font-medium">{effectiveModel?.name || 'AI'}</span>
                      <span className="text-[10px] text-gray-600">typing...</span>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      {streamedContent ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{streamedContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator for orchestration */}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm text-gray-400">Multiple agents are working on your query...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Orchestration agent details (expandable) */}
            {orchResult && agentResponses.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <button onClick={() => setShowAgentDetails(!showAgentDetails)}
                  className="w-full p-3 flex items-center justify-between text-sm text-gray-400 hover:bg-gray-800/50">
                  <span>Individual Agent Responses ({agentResponses.length})</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAgentDetails ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showAgentDetails && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="p-4 pt-0 space-y-3">
                        {agentResponses.map((ar: any, idx: number) => {
                          const agentKey = ar.agent || ar.role || 'unknown'
                          const cc = AGENT_COLOR_MAP[agentKey] || 'bg-gray-500/20 text-gray-400'
                          return (
                            <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cc}`}>
                                  <Brain className="w-3 h-3" />
                                </div>
                                <span className="font-medium text-white capitalize text-sm">{ar.agent_name || agentKey}</span>
                                {ar.model_used && <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">{ar.model_used}</span>}
                                {ar.tokens_used > 0 && <span className="text-xs px-1.5 py-0.5 bg-cyan-500/10 rounded text-cyan-400">{formatTokens(ar.tokens_used)} tok</span>}
                                {ar.latency_ms > 0 && <span className="text-xs text-gray-500">{formatMs(ar.latency_ms)}</span>}
                              </div>
                              <p className="text-sm text-gray-300 whitespace-pre-wrap">{toStr(ar.response)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Task Analysis (doc §18: Task Decomposer output) */}
            {taskAnalysis && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-medium text-white">Task Analysis</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {taskAnalysis.complexity && (
                    <div className="bg-gray-800/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Complexity</span>
                      <span className={`text-sm font-medium capitalize ${
                        taskAnalysis.complexity === 'complex' ? 'text-red-400' : taskAnalysis.complexity === 'moderate' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{taskAnalysis.complexity}</span>
                    </div>
                  )}
                  {taskAnalysis.best_task_type && (
                    <div className="bg-gray-800/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Strategy</span>
                      <span className="text-sm font-medium text-violet-400 capitalize">{taskAnalysis.best_task_type}</span>
                    </div>
                  )}
                  {taskAnalysis.estimated_agents && (
                    <div className="bg-gray-800/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Agents Used</span>
                      <span className="text-sm font-medium text-white">{taskAnalysis.estimated_agents}</span>
                    </div>
                  )}
                  {taskAnalysis.requires_factual_accuracy && (
                    <div className="bg-gray-800/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Accuracy</span>
                      <span className="text-sm font-medium text-emerald-400">Required</span>
                    </div>
                  )}
                </div>
                {taskAnalysis.key_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-[10px] text-gray-500 self-center mr-1">Topics:</span>
                    {taskAnalysis.key_topics.map((t: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {taskAnalysis.required_roles?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-500 self-center mr-1">Roles:</span>
                    {taskAnalysis.required_roles.map((r: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-violet-500/10 text-violet-400 rounded-full capitalize">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fact-check Result (doc §18: Verification Layer) */}
            {factCheckResult && (
              <div className="bg-gray-900 rounded-xl border border-amber-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-medium text-white">Fact-Check Report</h4>
                  </div>
                  <button onClick={() => setFactCheckResult(null)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{factCheckResult}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Improve Result (doc §18: Write-Review-Test triangle) */}
            {improveResult && (
              <div className="bg-gray-900 rounded-xl border border-cyan-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-medium text-white">Improved Response</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyToClipboard(improveResult)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button onClick={() => setImproveResult(null)} className="text-gray-500 hover:text-gray-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{improveResult}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Comparison Result (doc §18: Multi-Model Consensus Engine) */}
            {comparisonResult && (
              <div className="bg-gray-900 rounded-xl border border-amber-500/20 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-medium text-white">Agent Comparison</h4>
                  </div>
                  <button onClick={() => setComparisonResult(null)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Evaluation summary */}
                {comparisonResult.evaluation && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-medium text-amber-300">Evaluation Summary</span>
                      {comparisonResult.evaluation.winner && (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20">
                          Winner: {comparisonResult.evaluation.winner}
                        </span>
                      )}
                    </div>
                    {comparisonResult.evaluation.summary && (
                      <p className="text-xs text-gray-400">{toStr(comparisonResult.evaluation.summary)}</p>
                    )}
                  </div>
                )}

                {/* Agent responses side-by-side */}
                <div className={`grid gap-3 ${
                  (comparisonResult.responses?.length || 0) <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}>
                  {(comparisonResult.responses || []).map((resp: any, idx: number) => {
                    const agentKey = resp.agent || resp.role || `agent-${idx}`
                    const cc = AGENT_COLOR_MAP[agentKey] || 'bg-gray-500/20 text-gray-400'
                    const score = comparisonResult.evaluation?.scores?.[agentKey]
                    const isWinner = comparisonResult.evaluation?.winner === agentKey

                    return (
                      <div key={idx} className={`bg-gray-800/50 rounded-lg p-3 border ${isWinner ? 'border-emerald-500/30' : 'border-gray-700/50'}`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cc}`}>
                            <Brain className="w-3 h-3" />
                          </div>
                          <span className="font-medium text-white capitalize text-sm">{resp.agent_name || agentKey}</span>
                          {isWinner && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20">
                              Best
                            </span>
                          )}
                          {score != null && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded ml-auto">
                              Score: {typeof score === 'number' ? score.toFixed(1) : toStr(score)}
                            </span>
                          )}
                          {resp.model_used && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">{resp.model_used}</span>
                          )}
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-gray-300 max-h-60 overflow-y-auto">
                          <ReactMarkdown>{toStr(resp.response)}</ReactMarkdown>
                        </div>
                        {resp.latency_ms > 0 && (
                          <p className="text-[10px] text-gray-600 mt-2">{formatMs(resp.latency_ms)} · {formatTokens(resp.tokens_used || 0)} tokens</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Scoring breakdown */}
                {comparisonResult.evaluation?.criteria_scores && (
                  <div className="bg-gray-800/30 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Scoring Criteria</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(comparisonResult.evaluation.criteria_scores).map(([criterion, scores]: [string, any]) => (
                        <div key={criterion} className="text-center">
                          <p className="text-[10px] text-gray-500 capitalize mb-1">{criterion}</p>
                          <div className="flex gap-1 justify-center flex-wrap">
                            {typeof scores === 'object' && scores !== null ? (
                              Object.entries(scores).map(([agent, val]: [string, any]) => (
                                <span key={agent} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  AGENT_COLOR_MAP[agent] || 'bg-gray-700 text-gray-400'
                                }`}>
                                  {agent}: {typeof val === 'number' ? val.toFixed(1) : toStr(val)}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400">{toStr(scores)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comparing indicator */}
            {isComparing && (
              <div className="bg-gray-900 rounded-xl border border-amber-500/20 p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  <div>
                    <p className="text-sm text-white font-medium">Running agent comparison...</p>
                    <p className="text-xs text-gray-500">{comparisonAgents.length} agents answering independently, then AI evaluator will score</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Follow-up input */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <textarea
                ref={followUpRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a follow-up — context is preserved..."
                className="w-full h-16 px-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none text-sm"
                onKeyDown={handleKeyDown}
                disabled={isStreaming || loading}
              />
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800/50">
                {/* Model selector */}
                <div className="flex items-center gap-2 relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-gray-700 hover:border-violet-500/50 bg-gray-800/60 hover:bg-gray-800 transition-all cursor-pointer group"
                  >
                    <Brain className="w-3 h-3 text-violet-400" />
                    <span className="text-xs text-gray-300 font-medium">{effectiveModel?.name || 'Select model'}</span>
                    <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                  </button>
                  {modelOverride && (
                    <button
                      onClick={() => { setModelOverride(null); setShowModelPicker(false) }}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                      title="Reset to auto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[11px] text-gray-600">
                    {modelOverride ? 'Manual override' : 'Auto-selected'}
                  </span>

                  {/* Model picker dropdown */}
                  {showModelPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 max-h-72 overflow-y-auto bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50">
                      <div className="p-2.5 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl flex items-center justify-between">
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                          Switch Model
                        </p>
                        <button onClick={() => setShowModelPicker(false)} className="text-gray-500 hover:text-gray-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-1">
                        {Object.entries(groupedModels).map(([provider, providerModels]) => (
                          <div key={provider}>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 pt-2 pb-1 font-semibold">
                              {provider}
                            </p>
                            {providerModels.map((m) => {
                              const isSelected = effectiveModel?.id === m.id
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    setModelOverride(m.id === recommendedModel?.id ? null : m)
                                    setShowModelPicker(false)
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs transition-colors ${
                                    isSelected
                                      ? 'bg-violet-500/20 text-white border border-violet-500/30'
                                      : 'text-gray-300 hover:bg-gray-700/50'
                                  }`}
                                >
                                  <Eye className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {isSelected && (
                                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                      Active
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isStreaming && (
                    <button onClick={handleStop}
                      className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-1.5">
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={!query.trim() || loading || isStreaming}
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-glow-sm hover:shadow-glow-md transition-all"
                  >
                    <Sparkles className="w-3 h-3" /> Send
                  </button>
                </div>
              </div>
            </div>

            {/* Context info */}
            <p className="text-center text-[11px] text-gray-700">
              Next response by <span className={modelOverride ? 'text-amber-400 font-medium' : 'text-violet-400 font-medium'}>{effectiveModel?.name || '...'}</span>
              {modelOverride && (
                <span className="text-amber-500/60"> (overridden)</span>
              )}
              {' · '} Switch models anytime — conversation context carries over
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
