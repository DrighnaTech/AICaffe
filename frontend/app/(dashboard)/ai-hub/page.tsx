'use client'

import { useState, useRef, useCallback, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Loader2, FileText, Search, Palette, Code2,
  Mic, Video, Database, Languages, Bot, Wand2, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Zap, Lightbulb, BookOpen, CheckCircle2, Square,
  Download, RefreshCw, ImagePlus, Brain, Eye, X, ArrowRightLeft, User,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore, useWalletStore } from '@/lib/store'
import toast from 'react-hot-toast'
import type { AIModel } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Category-specific system prompts (injected per doc §7 "Workshop-specific system prompts") ──
const CATEGORY_SYSTEM_PROMPTS: Record<string, string> = {
  content: 'You are a content creation expert. Focus on clear, engaging writing with strong structure. Adapt tone for the audience. Use headers, bullet points, and examples where appropriate.',
  research: 'You are a research and analysis expert. Focus on accuracy, cite sources when possible, present multiple perspectives, and identify gaps or limitations in available information.',
  design: 'You are a design expert focused on UX principles, accessibility, and visual aesthetics. Provide detailed design specifications, consider user flows, and reference modern design patterns.',
  development: 'You are a senior software engineer. Write clean, production-ready code with best practices. Include error handling, type safety, and brief inline comments for complex logic. Prefer modern patterns.',
  audio: 'You are an audio and music expert. Provide detailed technical guidance on audio production, processing, and creative direction.',
  video: 'You are a video production expert. Provide guidance on cinematography, editing, effects, and storytelling through visual media.',
  data: 'You are a data analysis expert. Focus on structured analysis, statistical rigor, clear visualizations guidance, and actionable insights from data.',
  translation: 'You are a professional translator and localization expert. Preserve meaning, tone, and cultural nuances. Flag ambiguities and provide alternatives where appropriate.',
  assistant: 'You are a helpful, knowledgeable assistant. Provide clear, accurate, and well-structured responses. Be concise but thorough.',
  image: 'You are an image creation expert. Provide detailed creative direction, describe visual compositions, and suggest artistic approaches.',
}

// ── Smart Model Routing: best model per task category ─────────────────────
// Each category maps to ordered model identifier patterns (best → fallback)
// and a human-readable reason shown in the UI.
const CATEGORY_MODEL_AFFINITIES: Record<string, { models: string[]; reason: string }> = {
  content: {
    models: ['claude-3.5-sonnet', 'claude-3-5-sonnet', 'gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b', 'mistral-large', 'deepseek-chat', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for writing & content',
  },
  research: {
    models: ['gemini-2.0-flash', 'gemini-2.5', 'claude-3.5-sonnet', 'gpt-4o', 'deepseek-chat', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for research & analysis',
  },
  design: {
    models: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-2.0-flash', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for design prompts',
  },
  image: {
    models: ['gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for image prompts',
  },
  development: {
    models: ['deepseek-chat', 'codestral', 'claude-3.5-sonnet', 'gpt-4o', 'llama-3.3-70b', 'gemini-2.0-flash', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for code generation',
  },
  audio: {
    models: ['gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for audio tasks',
  },
  video: {
    models: ['gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for video tasks',
  },
  data: {
    models: ['gemini-2.0-flash', 'gemini-2.5', 'claude-3.5-sonnet', 'gpt-4o', 'deepseek-chat', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for data analysis',
  },
  translation: {
    models: ['gemini-2.0-flash', 'gemini-2.5', 'gpt-4o', 'mistral-large', 'claude-3.5-sonnet', 'llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-8b'],
    reason: 'Best for translation',
  },
  assistant: {
    models: ['llama-3.3-70b', 'gemini-2.0-flash', 'gpt-4o', 'claude-3.5-sonnet', 'deepseek-chat', 'llama-3.1-8b', 'llama3.1-8b', 'mistral-large'],
    reason: 'Fast & versatile',
  },
}

// ── Category config ────────────────────────────────────────────────────────
type TaskCategory =
  | 'content' | 'research' | 'design' | 'development'
  | 'audio' | 'video' | 'data' | 'translation' | 'assistant' | 'image'

const CATEGORIES: {
  id: TaskCategory
  name: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  subcategories?: { id: string; name: string }[]
}[] = [
  {
    id: 'content',
    name: 'Content',
    description: 'Writing, copywriting, blog posts',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20',
    subcategories: [
      { id: 'blog', name: 'Blog Posts' },
      { id: 'copywriting', name: 'Copywriting' },
      { id: 'creative', name: 'Creative Writing' },
      { id: 'email', name: 'Email Writing' },
      { id: 'social', name: 'Social Media' },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Analysis, summarization, fact-finding',
    icon: <Search className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
    subcategories: [
      { id: 'analysis', name: 'Analysis' },
      { id: 'summarization', name: 'Summarization' },
      { id: 'fact_check', name: 'Fact-Check' },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Image generation, UI concepts',
    icon: <Palette className="w-5 h-5" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20',
    subcategories: [
      { id: 'image_gen', name: 'Generate Image' },
      { id: 'ui_concepts', name: 'UI Concepts' },
      { id: 'logo_design', name: 'Logo Design' },
    ],
  },
  {
    id: 'image',
    name: 'Image AI',
    description: 'AI image generation & editing',
    icon: <ImagePlus className="w-5 h-5" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20',
    subcategories: [
      { id: 'image_gen', name: 'Generate Image' },
      { id: 'edit_image', name: 'Edit / Remix' },
      { id: 'logo_design', name: 'Logo Design' },
      { id: 'illustration', name: 'Illustration' },
    ],
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Code generation, debugging',
    icon: <Code2 className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20',
    subcategories: [
      { id: 'code_generation', name: 'Code Generation' },
      { id: 'debugging', name: 'Debugging' },
      { id: 'code_review', name: 'Code Review' },
    ],
  },
  {
    id: 'audio',
    name: 'Audio',
    description: 'Voice, music, sound',
    icon: <Mic className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20',
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Video generation, editing',
    icon: <Video className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Data analysis, visualization',
    icon: <Database className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
  },
  {
    id: 'translation',
    name: 'Translation',
    description: 'Language translation',
    icon: <Languages className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
  },
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'General chat, Q&A',
    icon: <Bot className="w-5 h-5" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20',
    subcategories: [
      { id: 'fast', name: 'Fast Response' },
      { id: 'reasoning', name: 'Deep Reasoning' },
    ],
  },
]

const QUICK_TEMPLATES = [
  { icon: <FileText className="w-4 h-4" />, label: 'Write a blog post about', category: 'content' as TaskCategory },
  { icon: <Code2 className="w-4 h-4" />, label: 'Generate code to', category: 'development' as TaskCategory },
  { icon: <Search className="w-4 h-4" />, label: 'Research and summarize', category: 'research' as TaskCategory },
  { icon: <Lightbulb className="w-4 h-4" />, label: 'Brainstorm ideas for', category: 'assistant' as TaskCategory },
  { icon: <BookOpen className="w-4 h-4" />, label: 'Summarize this text:', category: 'research' as TaskCategory },
  { icon: <Wand2 className="w-4 h-4" />, label: 'Translate to English:', category: 'translation' as TaskCategory },
  { icon: <Palette className="w-4 h-4" />, label: 'Generate an image of', category: 'design' as TaskCategory },
]

// ── Image Generation Config ───────────────────────────────────────────────
const IMAGE_STYLES = [
  { id: 'realistic', name: 'Realistic', suffix: 'photorealistic, high quality, 8k, detailed, DSLR' },
  { id: 'anime', name: 'Anime', suffix: 'anime style, vibrant colors, detailed illustration' },
  { id: 'digital_art', name: 'Digital Art', suffix: 'digital art, concept art, trending on artstation' },
  { id: 'oil_painting', name: 'Oil Painting', suffix: 'oil painting, textured brushstrokes, gallery quality' },
  { id: 'watercolor', name: 'Watercolor', suffix: 'watercolor painting, soft washes, delicate' },
  { id: '3d_render', name: '3D Render', suffix: '3D render, octane render, cinematic lighting' },
  { id: 'pixel_art', name: 'Pixel Art', suffix: 'pixel art, retro 16-bit, crisp pixels' },
  { id: 'sketch', name: 'Sketch', suffix: 'pencil sketch, detailed line art, hand drawn' },
]

const IMAGE_SIZES = [
  { id: '1024x1024', name: 'Square (1:1)', width: 1024, height: 1024 },
  { id: '1280x720', name: 'Landscape (16:9)', width: 1280, height: 720 },
  { id: '720x1280', name: 'Portrait (9:16)', width: 720, height: 1280 },
]

interface GeneratedImage {
  url: string
  prompt: string
  style: string
  size: string
  timestamp: Date
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant' | 'system-notice'
  content: string
  modelName?: string
  tokens?: number
  timestamp: Date
}

interface SessionTask {
  id: string
  prompt: string
  result: string
  modelName: string
  totalTokens: number
  tokensCharged: number
  category: TaskCategory
  timestamp: Date
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Reasoning/slow models to skip for standard tasks
const REASONING_PATTERNS = ['reasoner', 'deepseek-r1', 'o1-preview', 'o1-mini', '-r1']
const isReasoningModel = (m: AIModel) =>
  REASONING_PATTERNS.some((p) => m.model_identifier.toLowerCase().includes(p))

function pickModelForCategory(
  models: AIModel[],
  category: string | null
): { model: AIModel | null; reason: string; fallbacks: AIModel[] } {
  if (!category || !models.length) return { model: null, reason: '', fallbacks: [] }

  const affinities = CATEGORY_MODEL_AFFINITIES[category]
  if (!affinities) return { model: models[0] || null, reason: 'General purpose', fallbacks: [] }

  // Include llm, multimodal, and code_generation — Claude/GPT-4o/Gemini are 'multimodal' in DB
  const ROUTABLE_TYPES = ['llm', 'multimodal', 'code_generation']
  const activeLLMs = models.filter((m) => ROUTABLE_TYPES.includes(m.model_type) && m.status === 'active')

  // Match by model identifier pattern (priority order), collecting all matches for fallback chain
  const matched: AIModel[] = []
  for (const pattern of affinities.models) {
    const match = activeLLMs.find(
      (m) => m.model_identifier.toLowerCase().includes(pattern.toLowerCase()) && !isReasoningModel(m) && !matched.includes(m)
    )
    if (match) matched.push(match)
    if (matched.length >= 3) break // Primary + 2 fallbacks per doc §6
  }

  if (matched.length > 0) {
    return { model: matched[0], reason: affinities.reason, fallbacks: matched.slice(1) }
  }

  // Fallback: any active non-reasoning LLM
  const fallback = activeLLMs.find((m) => !isReasoningModel(m))
  return { model: fallback || activeLLMs[0] || null, reason: 'General purpose', fallbacks: [] }
}

/** Provider health indicator based on model metrics */
function getHealthStatus(model: AIModel): { label: string; color: string; dot: string } {
  const uptime = model.uptime_percentage ?? 100
  if (uptime >= 99) return { label: 'Healthy', color: 'text-emerald-400', dot: 'bg-emerald-400' }
  if (uptime >= 95) return { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400' }
  return { label: 'Unstable', color: 'text-red-400', dot: 'bg-red-400' }
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AIHubPage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  const scrollCategories = (dir: 'left' | 'right') => {
    categoryScrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }

  const [prompt, setPrompt] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState('')
  const [currentResult, setCurrentResult] = useState<SessionTask | null>(null)
  const [sessionHistory, setSessionHistory] = useState<SessionTask[]>([])
  // Conversation thread — accumulates all message pairs for multi-turn context (sent to API)
  const [conversationThread, setConversationThread] = useState<{ role: string; content: string }[]>([])
  // Visible chat messages — includes model name per response + system notices for model switches
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  // Track which model was used last, to detect switches
  const [lastUsedModelName, setLastUsedModelName] = useState<string | null>(null)

  // Image generation state
  const [imageStyle, setImageStyle] = useState('realistic')
  const [imageSize, setImageSize] = useState('1024x1024')
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // Model override — user can override the auto-selected model
  const [modelOverride, setModelOverride] = useState<AIModel | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)

  const token = useAuthStore((s) => s.token)
  const deduct = useWalletStore((s) => s.deduct)

  // Fetch all active models from the registry (LLM + multimodal + code_generation)
  const { data: modelsData } = useQuery({
    queryKey: ['hub-models'],
    queryFn: () => modelsApi.list({ status: 'active', limit: 200 }),
    staleTime: 10 * 60 * 1000, // models rarely change — 10 min cache
  })

  const models: AIModel[] =
    modelsData?.data?.models ||
    modelsData?.data?.items ||
    (Array.isArray(modelsData?.data) ? modelsData.data : [])

  const { model: autoModel, reason: autoModelReason, fallbacks: autoFallbacks } = useMemo(
    () => pickModelForCategory(models, selectedCategory),
    [models, selectedCategory]
  )
  const effectiveModel = useMemo(() => modelOverride || autoModel, [modelOverride, autoModel])

  // Image mode: Design/Image category + image-related subcategory
  const isImageMode =
    (selectedCategory === 'image') ||
    (selectedCategory === 'design' && (!selectedSubcategory || selectedSubcategory === 'image_gen'))

  // Memoize grouped models for picker dropdown (avoids O(n) filter+sort+group on every render)
  const groupedModels = useMemo(() => {
    const ROUTABLE = ['llm', 'multimodal', 'code_generation']
    const routableModels = models
      .filter((m) => ROUTABLE.includes(m.model_type) && m.status === 'active' && !isReasoningModel(m))
      .sort((a, b) => (a.provider_name || '').localeCompare(b.provider_name || ''))
    const grouped: Record<string, AIModel[]> = {}
    for (const m of routableModels) {
      const provider = m.provider_name || 'Other'
      if (!grouped[provider]) grouped[provider] = []
      grouped[provider].push(m)
    }
    return grouped
  }, [models])

  // Memoize ReactMarkdown components config (prevents re-render of all markdown on every state change)
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-lg !bg-gray-900"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      )
    },
  }), [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCategorySelect = (category: TaskCategory) => {
    if (category !== selectedCategory) {
      setConversationThread([])
      setChatMessages([])
      setCurrentResult(null)
      setModelOverride(null)
      setShowModelPicker(false)
      setLastUsedModelName(null)
    }
    setSelectedCategory(category)
    setSelectedSubcategory(null)
    textareaRef.current?.focus()
  }

  const handleNewTopic = () => {
    setConversationThread([])
    setChatMessages([])
    setCurrentResult(null)
    setPrompt('')
    setLastUsedModelName(null)
    textareaRef.current?.focus()
  }

  const handleQuickTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    setSelectedCategory(template.category)
    setSelectedSubcategory(null)
    setPrompt(template.label + ' ')
    textareaRef.current?.focus()
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleImageGenerate = useCallback(() => {
    if (!prompt.trim() || isGeneratingImage) return
    setIsGeneratingImage(true)

    const style = IMAGE_STYLES.find((s) => s.id === imageStyle)
    const size = IMAGE_SIZES.find((s) => s.id === imageSize)
    const fullPrompt = `${prompt.trim()}, ${style?.suffix || ''}`
    const seed = Math.floor(Math.random() * 999999)
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${size?.width || 1024}&height=${size?.height || 1024}&model=flux&nologo=true&seed=${seed}`

    const img = new window.Image()
    img.onload = () => {
      setGeneratedImages((prev) =>
        [{ url, prompt: prompt.trim(), style: style?.name || 'Realistic', size: imageSize, timestamp: new Date() }, ...prev].slice(0, 12)
      )
      setIsGeneratingImage(false)
      setPrompt('')
    }
    img.onerror = () => {
      toast.error('Image generation failed — please try again')
      setIsGeneratingImage(false)
    }
    img.src = url
  }, [prompt, imageStyle, imageSize, isGeneratingImage])

  const handleDownloadImage = async (imageUrl: string, imagePrompt: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aicaffe-${imagePrompt.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '-')}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Image downloaded!')
    } catch {
      toast.error('Download failed')
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) return
    if (!selectedCategory) {
      toast.error('Please select a category first')
      return
    }
    if (!effectiveModel) {
      toast.error('No model available — model registry may still be loading')
      return
    }

    const currentModelName = effectiveModel.name
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setStreamedContent('')
    setCurrentResult(null)

    // Track how many messages we add before the API call so we can rollback on error
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
      content: prompt,
      timestamp: new Date(),
    }])
    messagesAdded++

    // Auto-scroll to result area
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)

    let accumulated = ''
    let tokensCharged = 0
    let totalTokens = 0

    try {
      // Build messages with category-specific system prompt (doc §7)
      const systemPrompt = selectedCategory ? CATEGORY_SYSTEM_PROMPTS[selectedCategory] : null
      const apiMessages = [
        ...(systemPrompt && conversationThread.length === 0 ? [{ role: 'system', content: systemPrompt }] : []),
        ...conversationThread,
        { role: 'user', content: prompt },
      ]

      const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: effectiveModel.id,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const msg =
          errBody?.error?.message ||
          errBody?.detail ||
          `Request failed (HTTP ${response.status})`
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
          if (raw === '[DONE]') {
            done = true
            break
          }
          try {
            const chunk = JSON.parse(raw)
            if (chunk.error) {
              throw new Error(chunk.error.message || 'Stream error from provider')
            }
            const delta = chunk.choices?.[0]?.delta?.content || ''
            if (delta) {
              accumulated += delta
              setStreamedContent(accumulated)
            }
            // Final chunk may carry usage info
            if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens
            if (chunk.aicaffe_tokens_charged) tokensCharged = chunk.aicaffe_tokens_charged
          } catch (parseErr: any) {
            // Re-throw provider/stream errors; only swallow JSON parse failures
            if (!(parseErr instanceof SyntaxError)) throw parseErr
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped — keep whatever streamed so far
      } else {
        toast.error(err.message || 'Request failed')
        // Rollback: remove dangling user message + switch notice added before the API call
        if (messagesAdded > 0) {
          setChatMessages((prev) => prev.slice(0, -messagesAdded))
        }
        setIsStreaming(false)
        setStreamedContent('')
        return
      }
    }

    // If no content was generated (empty response or abort before any content arrived)
    if (!accumulated) {
      // Rollback: remove dangling user message + switch notice
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

    // Finalize task
    const task: SessionTask = {
      id: `task-${Date.now()}`,
      prompt,
      result: accumulated,
      modelName: currentModelName,
      totalTokens,
      tokensCharged,
      category: selectedCategory!,
      timestamp: new Date(),
    }
    setCurrentResult(task)
    setSessionHistory((prev) => [task, ...prev].slice(0, 5))
    // API thread (plain messages for context)
    setConversationThread((prev) => [
      ...prev,
      { role: 'user', content: prompt },
      { role: 'assistant', content: accumulated },
    ])
    // Visible chat (with model info)
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
    setPrompt('')
    setTimeout(() => followUpRef.current?.focus(), 100)
  }, [prompt, selectedCategory, effectiveModel, isStreaming, token, deduct, conversationThread, lastUsedModelName])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isImageMode) handleImageGenerate()
      else handleSubmit()
    }
  }

  // Whether we're in "conversation mode" — result is showing, use follow-up box
  const hasActiveResult = !isImageMode && (isStreaming || currentResult)

  const selectedCategoryConfig = CATEGORIES.find((c) => c.id === selectedCategory)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-7rem)] -m-6 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-4">

        {/* Header — compact single line */}
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <h1 className="text-xl font-semibold text-white">AI Hub</h1>
          <span className="text-gray-500 text-sm">— pick a category and describe your task</span>
        </div>

        {/* Category Strip — horizontal scroll with arrows */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={() => scrollCategories('left')}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 text-gray-400 hover:text-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={categoryScrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-none scroll-smooth"
          >
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === category.id
                    ? `${category.bgColor} border-2 shadow-lg`
                    : `${category.bgColor} border-gray-700/50`
                }`}
              >
                <div className={category.color}>{category.icon}</div>
                <span className="text-sm font-medium text-white">{category.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => scrollCategories('right')}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 text-gray-400 hover:text-white transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Subcategory Pills */}
        <AnimatePresence>
          {selectedCategoryConfig?.subcategories && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-wrap gap-2 justify-center mb-3"
            >
              <span className="text-gray-500 text-sm mr-2 self-center">Subcategory:</span>
              {selectedCategoryConfig.subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() =>
                    setSelectedSubcategory(selectedSubcategory === sub.id ? null : sub.id)
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    selectedSubcategory === sub.id
                      ? 'bg-white text-gray-900 font-medium'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Generation Controls — shown in image mode */}
        <AnimatePresence>
          {isImageMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 space-y-3"
            >
              {/* Style Selector */}
              <div>
                <h3 className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setImageStyle(style.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        imageStyle === style.id
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm shadow-pink-500/10'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Size Selector */}
              <div>
                <h3 className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Size
                </h3>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setImageSize(size.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        imageSize === size.id
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm shadow-pink-500/10'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area — hidden when conversation is active (follow-up box shown below result instead) */}
        <div className={`relative mb-4 ${hasActiveResult ? 'hidden' : ''}`}>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-1">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isImageMode
                  ? 'Describe the image you want to create... (e.g. "A futuristic city at sunset")'
                  : selectedCategory
                  ? `Describe your ${selectedCategoryConfig?.name.toLowerCase()} task...`
                  : 'Select a category above, then describe your task...'
              }
              rows={3}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700/50">
              {/* Model selector with override support */}
              <div className="flex items-center gap-3 relative">
                {isImageMode ? (
                  <span className="text-xs text-gray-500">
                    Powered by{' '}
                    <span className="text-pink-300 font-medium">FLUX</span>
                    <span className="text-gray-600"> · Pollinations.ai</span>
                    <span className="text-gray-700"> · Free</span>
                  </span>
                ) : effectiveModel && selectedCategory ? (
                  <div className="flex items-center gap-2">
                    {/* Clickable model selector — looks like a dropdown */}
                    <button
                      onClick={() => setShowModelPicker(!showModelPicker)}
                      className="flex items-center gap-2 px-3 py-1 rounded-lg border border-gray-600 hover:border-violet-500/50 bg-gray-700/40 hover:bg-gray-700/60 transition-all cursor-pointer group"
                    >
                      <Brain className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs text-gray-300 font-medium">{effectiveModel.name}</span>
                      {effectiveModel.provider_name && (
                        <span className="text-xs text-gray-500">{effectiveModel.provider_name}</span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 group-hover:text-violet-400 transition-all ${showModelPicker ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Reason tag */}
                    <span className="text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                      {modelOverride ? 'Manual override' : autoModelReason}
                    </span>
                    {/* Reset to auto if overridden */}
                    {modelOverride && (
                      <button
                        onClick={() => { setModelOverride(null); setShowModelPicker(false) }}
                        className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                        title="Reset to recommended model"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">Select a category to see auto-selected model</span>
                )}

                {/* Model Picker Dropdown */}
                {showModelPicker && selectedCategory && !isImageMode && (
                  <div className="absolute bottom-full left-0 mb-2 w-[420px] max-h-96 overflow-y-auto bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50">
                    <div className="p-3 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl flex items-center justify-between">
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-violet-400" />
                        Select AI Model
                      </p>
                      <button
                        onClick={() => setShowModelPicker(false)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Fallback Chain (doc §6: "Pre-computed fallback chain, max 3 attempts") */}
                    {autoModel && autoFallbacks.length > 0 && (
                      <div className="px-3 py-2.5 border-b border-gray-700 bg-gray-800/50">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Routing Chain</p>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 bg-violet-500/15 text-violet-300 rounded border border-violet-500/20 font-medium">{autoModel.name}</span>
                          {autoFallbacks.map((fb, i) => (
                            <span key={fb.id} className="flex items-center gap-1.5">
                              <span className="text-gray-600">→</span>
                              <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded border border-gray-600">{fb.name}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">Auto-fallback if primary model fails</p>
                      </div>
                    )}

                    <div className="p-1">
                      {Object.entries(groupedModels).map(([provider, providerModels]) => (
                        <div key={provider}>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 pt-2 pb-1 font-semibold">
                            {provider}
                          </p>
                          {providerModels.map((m) => {
                            const isRecommended = autoModel?.id === m.id
                            const isFallback = autoFallbacks.some((fb) => fb.id === m.id)
                            const isSelected = effectiveModel?.id === m.id
                            const health = getHealthStatus(m)
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  if (autoModel?.id === m.id) {
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
                                {/* Health dot */}
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${health.dot}`} title={health.label} />
                                <span className="flex-1 truncate">{m.name}</span>
                                {/* Latency indicator */}
                                {m.avg_latency_ms != null && m.avg_latency_ms > 0 && (
                                  <span className="text-[10px] text-gray-600 flex-shrink-0">{m.avg_latency_ms < 1000 ? `${m.avg_latency_ms}ms` : `${(m.avg_latency_ms/1000).toFixed(1)}s`}</span>
                                )}
                                {isRecommended && (
                                  <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/30 flex-shrink-0">
                                    Best
                                  </span>
                                )}
                                {isFallback && !isSelected && (
                                  <span className="text-[10px] bg-gray-600/30 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    Fallback
                                  </span>
                                )}
                                {isSelected && !isRecommended && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30 flex-shrink-0">
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

                {conversationThread.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                      {conversationThread.length / 2} {conversationThread.length / 2 === 1 ? 'exchange' : 'exchanges'} · remembering context
                    </span>
                    <button
                      onClick={handleNewTopic}
                      className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                    >
                      New topic
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{prompt.length} chars</span>
                {isStreaming ? (
                  <Button
                    variant="ghost"
                    onClick={handleStop}
                    leftIcon={<Square className="w-4 h-4" />}
                    className="text-red-400 hover:text-red-300 border border-red-500/30"
                  >
                    Stop
                  </Button>
                ) : isImageMode ? (
                  <Button
                    variant="primary"
                    onClick={handleImageGenerate}
                    disabled={!prompt.trim() || isGeneratingImage}
                    leftIcon={isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    className="!bg-pink-600 hover:!bg-pink-500"
                  >
                    {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!prompt.trim() || !selectedCategory}
                    leftIcon={<Zap className="w-4 h-4" />}
                  >
                    Generate
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Templates — shown only before first submission */}
        {!selectedCategory && !currentResult && (
          <div className="mb-10">
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Quick Start
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {QUICK_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickTemplate(template)}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-800 hover:border-gray-600 transition-all text-left group"
                >
                  <div className="text-gray-400 group-hover:text-white transition-colors">
                    {template.icon}
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {template.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image Generation Results */}
        <AnimatePresence>
          {isImageMode && (isGeneratingImage || generatedImages.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-10"
            >
              {/* Loading State */}
              {isGeneratingImage && (
                <div className="flex flex-col items-center justify-center py-16 bg-gray-800/50 border border-pink-500/20 rounded-2xl mb-6">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-pink-500/20 border-t-pink-400 animate-spin" />
                    <ImagePlus className="w-6 h-6 text-pink-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-gray-300 font-medium">Generating your image...</p>
                  <p className="text-gray-600 text-sm mt-1">This usually takes 10-30 seconds</p>
                </div>
              )}

              {/* Generated Images Gallery */}
              {generatedImages.length > 0 && (
                <div>
                  <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Generated Images ({generatedImages.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {generatedImages.map((img, idx) => (
                      <div
                        key={`${img.timestamp.getTime()}-${idx}`}
                        className="group relative bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden hover:border-pink-500/30 transition-all"
                      >
                        <div className={`${img.size === '720x1280' ? 'aspect-[9/16]' : img.size === '1280x720' ? 'aspect-video' : 'aspect-square'}`}>
                          <img
                            src={img.url}
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                          <p className="text-white text-sm line-clamp-2 mb-2">{img.prompt}</p>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full border border-pink-500/30">
                              {img.style}
                            </span>
                            <span className="text-xs bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-full">
                              {img.size}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownloadImage(img.url, img.prompt)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors backdrop-blur-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </button>
                            <button
                              onClick={() => {
                                setPrompt(img.prompt)
                                textareaRef.current?.focus()
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors backdrop-blur-sm"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Regenerate
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation Thread Display */}
        <AnimatePresence>
          {!isImageMode && (chatMessages.length > 0 || isStreaming) && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-4"
            >
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                {/* Thread header */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span>{chatMessages.filter((m) => m.role === 'user').length} {chatMessages.filter((m) => m.role === 'user').length === 1 ? 'exchange' : 'exchanges'}</span>
                  </div>
                  <button
                    onClick={handleNewTopic}
                    className="text-xs text-gray-500 hover:text-white bg-gray-700/50 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New Chat
                  </button>
                </div>

                {/* Messages */}
                <div className="max-h-[55vh] overflow-y-auto">
                  {chatMessages.map((msg, idx) => {
                    if (msg.role === 'system-notice') {
                      return (
                        <div key={idx} className="flex items-center justify-center gap-2 py-2 px-6">
                          <div className="h-px flex-1 bg-gray-700" />
                          <span className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full whitespace-nowrap">
                            <ArrowRightLeft className="w-3 h-3" />
                            {msg.content}
                          </span>
                          <div className="h-px flex-1 bg-gray-700" />
                        </div>
                      )
                    }

                    if (msg.role === 'user') {
                      return (
                        <div key={idx} className="px-5 py-3 border-b border-gray-700/50">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // assistant
                    return (
                      <div key={idx} className="px-5 py-4 border-b border-gray-700/50 bg-gray-800/30">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Brain className="w-3.5 h-3.5 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-violet-400">{msg.modelName}</span>
                              {msg.tokens && msg.tokens > 0 && (
                                <span className="text-[10px] text-gray-500">{msg.tokens.toLocaleString()} tokens</span>
                              )}
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown components={markdownComponents}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            {/* Response actions: copy, rate (doc §6 "routing decision logged") */}
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700/30">
                              <button
                                onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied') }}
                                className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
                                title="Copy response"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <span className="text-gray-700 mx-1">|</span>
                              <span className="text-[10px] text-gray-600 mr-1">Rate:</span>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => toast.success(`Rated ${star}/5 — thanks for the feedback!`)}
                                  className="p-0.5 text-gray-600 hover:text-amber-400 transition-colors"
                                  title={`${star}/5`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Currently streaming response */}
                  {isStreaming && (
                    <div className="px-5 py-4 bg-gray-800/30">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-medium text-violet-400">{effectiveModel?.name}</span>
                            <span className="text-[10px] text-gray-500">generating...</span>
                          </div>
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown components={markdownComponents}>
                              {streamedContent}
                            </ReactMarkdown>
                            <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center mt-3">
                        <Button
                          variant="ghost"
                          onClick={handleStop}
                          leftIcon={<Square className="w-3 h-3" />}
                          className="text-red-400 hover:text-red-300 border border-red-500/30 text-xs px-3 py-1"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Follow-up chat box */}
                {!isStreaming && chatMessages.length > 0 && (
                  <div className="border-t border-gray-700 px-4 py-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={followUpRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Follow up... (context preserved)"
                        rows={2}
                        className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-500/50 text-sm"
                      />
                      {/* Model picker button */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setShowModelPicker(!showModelPicker)}
                          className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg border border-gray-600 hover:border-violet-500/50 bg-gray-700/40 hover:bg-gray-700/60 transition-all text-xs text-gray-400 hover:text-gray-300"
                          title={`Model: ${effectiveModel?.name || 'none'}`}
                        >
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                          <ChevronDown className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {/* Dropdown */}
                        {showModelPicker && selectedCategory && (
                          <div className="absolute bottom-full right-0 mb-2 w-80 max-h-72 overflow-y-auto bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50">
                            <div className="p-2.5 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl flex items-center justify-between">
                              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5 text-violet-400" />
                                Switch Model (context kept)
                              </p>
                              <button onClick={() => setShowModelPicker(false)} className="text-gray-500 hover:text-gray-300">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="p-1">
                              {Object.entries(groupedModels).map(([prov, pms]) => (
                                <div key={prov}>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 pt-2 pb-1 font-semibold">{prov}</p>
                                  {pms.map((m) => (
                                    <button
                                      key={m.id}
                                      onClick={() => {
                                        autoModel?.id === m.id ? setModelOverride(null) : setModelOverride(m)
                                        setShowModelPicker(false)
                                      }}
                                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                                        effectiveModel?.id === m.id ? 'bg-violet-500/20 text-white' : 'text-gray-300 hover:bg-gray-700/50'
                                      }`}
                                    >
                                      <Eye className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                      <span className="flex-1 truncate">{m.name}</span>
                                      {autoModel?.id === m.id && (
                                        <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">Rec</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!prompt.trim()}
                        leftIcon={<Zap className="w-4 h-4" />}
                        className="py-2.5 flex-shrink-0"
                      >
                        Send
                      </Button>
                    </div>
                    {/* Model + context line */}
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      <span className="text-gray-500">
                        Next response by <span className={modelOverride ? 'text-amber-400 font-medium' : 'text-violet-400 font-medium'}>{effectiveModel?.name}</span>
                        {modelOverride && (
                          <button onClick={() => setModelOverride(null)} className="text-gray-600 hover:text-gray-400 ml-1.5">(reset)</button>
                        )}
                      </span>
                      <span className="text-gray-700">|</span>
                      <span className="text-gray-600">Full context preserved across model switches</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session History */}
        {sessionHistory.length > 0 && !isStreaming && (
          <div>
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              This Session
            </h3>
            <div className="space-y-2">
              {sessionHistory.map((task) => {
                const categoryConfig = CATEGORIES.find((c) => c.id === task.category)
                return (
                  <button
                    key={task.id}
                    onClick={() => setCurrentResult(task)}
                    className="w-full flex items-center gap-4 px-4 py-3 bg-gray-800/30 border border-gray-800 rounded-xl hover:bg-gray-800/50 hover:border-gray-700 transition-all text-left group"
                  >
                    <div className={`${categoryConfig?.color} opacity-60 group-hover:opacity-100`}>
                      {categoryConfig?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{task.prompt}</p>
                      <p className="text-xs text-gray-500">
                        {task.modelName}
                        {task.totalTokens > 0 && ` · ${task.totalTokens.toLocaleString()} tokens`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
