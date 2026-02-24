import { clsx, type ClassValue } from 'clsx'

// ============================================================================
// AICaffe Platform - Utility Functions
// ============================================================================

// ── Class Name Utility ─────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ── Formatting Utilities ───────────────────────────────────────────────────

export function formatNumber(num: number | undefined | null, decimals = 0): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0'
  }
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B'
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toFixed(decimals)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return (tokens / 1_000_000).toFixed(2) + 'M'
  }
  if (tokens >= 1_000) {
    return (tokens / 1_000).toFixed(1) + 'K'
  }
  return tokens.toString()
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${years}y ago`
}

// ── Model Utilities ────────────────────────────────────────────────────────

export function getModelTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    llm: 'Language Model',
    image_generation: 'Image Generation',
    image_editing: 'Image Editing',
    video_generation: 'Video Generation',
    audio_generation: 'Audio Generation',
    audio_transcription: 'Speech-to-Text',
    text_to_speech: 'Text-to-Speech',
    code_generation: 'Code Generation',
    embedding: 'Embeddings',
    multimodal: 'Multimodal',
    agent: 'AI Agent',
    search: 'AI Search',
    translation: 'Translation',
    summarization: 'Summarization',
    classification: 'Classification',
  }
  return labels[type] || type
}

export function getModelTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    llm: 'MessageSquare',
    image_generation: 'Image',
    image_editing: 'Paintbrush',
    video_generation: 'Video',
    audio_generation: 'Music',
    audio_transcription: 'Mic',
    text_to_speech: 'Volume2',
    code_generation: 'Code',
    embedding: 'Database',
    multimodal: 'Layers',
    agent: 'Bot',
    search: 'Search',
    translation: 'Languages',
    summarization: 'FileText',
    classification: 'Tags',
  }
  return icons[type] || 'Cpu'
}

export function getModelTypeColor(type: string): string {
  const colors: Record<string, string> = {
    llm: 'bg-blue-500/20 text-blue-400',
    image_generation: 'bg-purple-500/20 text-purple-400',
    image_editing: 'bg-pink-500/20 text-pink-400',
    video_generation: 'bg-red-500/20 text-red-400',
    audio_generation: 'bg-orange-500/20 text-orange-400',
    audio_transcription: 'bg-yellow-500/20 text-yellow-400',
    text_to_speech: 'bg-green-500/20 text-green-400',
    code_generation: 'bg-cyan-500/20 text-cyan-400',
    embedding: 'bg-indigo-500/20 text-indigo-400',
    multimodal: 'bg-violet-500/20 text-violet-400',
    agent: 'bg-emerald-500/20 text-emerald-400',
    search: 'bg-teal-500/20 text-teal-400',
  }
  return colors[type] || 'bg-gray-500/20 text-gray-400'
}

// ── Token Utilities ────────────────────────────────────────────────────────

export const TOKENS_PER_USD = 20000

export function tokensToUsd(tokens: number): number {
  return tokens / TOKENS_PER_USD
}

export function usdToTokens(usd: number): number {
  return Math.ceil(usd * TOKENS_PER_USD)
}

export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
  marginPercentage = 20
): { providerCost: number; margin: number; total: number; aicaffeTokens: number } {
  const inputCost = (inputTokens * inputPricePerMillion) / 1_000_000
  const outputCost = (outputTokens * outputPricePerMillion) / 1_000_000
  const providerCost = inputCost + outputCost
  const margin = providerCost * (marginPercentage / 100)
  const total = providerCost + margin
  const aicaffeTokens = Math.ceil(total * TOKENS_PER_USD)

  return { providerCost, margin, total, aicaffeTokens }
}

// ── Validation Utilities ───────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isStrongPassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ── Local Storage Utilities ────────────────────────────────────────────────

export function getStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue

  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setStoredValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.error('Failed to save to localStorage')
  }
}

// ── URL Utilities ──────────────────────────────────────────────────────────

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, v.toString()))
      } else {
        searchParams.append(key, value.toString())
      }
    }
  })

  return searchParams.toString()
}

// ── Debounce Utility ───────────────────────────────────────────────────────

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// ── Copy to Clipboard ──────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── Rating Utilities ───────────────────────────────────────────────────────

export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-400'
  if (rating >= 4.0) return 'text-lime-400'
  if (rating >= 3.5) return 'text-yellow-400'
  if (rating >= 3.0) return 'text-orange-400'
  return 'text-red-400'
}

export function getLatencyColor(latencyMs: number): string {
  if (latencyMs <= 200) return 'text-green-400'
  if (latencyMs <= 500) return 'text-lime-400'
  if (latencyMs <= 1000) return 'text-yellow-400'
  if (latencyMs <= 2000) return 'text-orange-400'
  return 'text-red-400'
}
