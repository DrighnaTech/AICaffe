'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Send, Square, Loader2, Bot, User, Copy, Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { modelsApi } from '@/lib/api'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AIModel } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Model selection ─────────────────────────────────────────────────────────
const REASONING_PATTERNS = ['reasoner', 'deepseek-r1', 'o1-preview', 'o1-mini', '-r1']

function pickModel(models: AIModel[], priority: string[]): AIModel | null {
  const llms = models.filter((m) => m.model_type === 'llm' && m.status === 'active')
  for (const slug of priority) {
    const match = llms.find(
      (m) => m.provider_slug === slug &&
        !REASONING_PATTERNS.some((p) => m.model_identifier.toLowerCase().includes(p))
    )
    if (match) return match
  }
  for (const slug of priority) {
    const match = llms.find((m) => m.provider_slug === slug)
    if (match) return match
  }
  return llms[0] || null
}

// ── Types ───────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Accent color maps ───────────────────────────────────────────────────────
const ACCENT = {
  violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', cursor: 'bg-violet-400', ring: 'focus:ring-violet-500', btn: 'bg-violet-600 hover:bg-violet-500' },
  cyan:   { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   cursor: 'bg-cyan-400',   ring: 'focus:ring-cyan-500',   btn: 'bg-cyan-600 hover:bg-cyan-500' },
  pink:   { bg: 'bg-pink-500/20',   text: 'text-pink-400',   cursor: 'bg-pink-400',   ring: 'focus:ring-pink-500',   btn: 'bg-pink-600 hover:bg-pink-500' },
  amber:  { bg: 'bg-amber-500/20',  text: 'text-amber-400',  cursor: 'bg-amber-400',  ring: 'focus:ring-amber-500',  btn: 'bg-amber-600 hover:bg-amber-500' },
  emerald:{ bg: 'bg-emerald-500/20',text: 'text-emerald-400',cursor: 'bg-emerald-400',ring: 'focus:ring-emerald-500',btn: 'bg-emerald-600 hover:bg-emerald-500' },
} as const

type AccentColor = keyof typeof ACCENT

// ── Props ───────────────────────────────────────────────────────────────────
interface WorkshopChatProps {
  /** Dynamic system prompt — rebuilt on each send to include latest context */
  systemPrompt: string
  /** Label shown at top of chat (e.g. "Context: index.ts") */
  contextLabel: string
  /** Provider slugs in priority order for auto model selection */
  providerPriority: string[]
  /** Accent color theme */
  accentColor: AccentColor
  /** Optional callback fired with each new assistant response */
  onResponse?: (content: string) => void
  /** Query key suffix so multiple workshops don't collide in react-query cache */
  queryKeySuffix?: string
}

// ── Component ───────────────────────────────────────────────────────────────
export function WorkshopChat({
  systemPrompt,
  contextLabel,
  providerPriority,
  accentColor,
  onResponse,
  queryKeySuffix = 'default',
}: WorkshopChatProps) {
  const { token } = useAuthStore()
  const { deduct } = useWalletStore()
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const accent = ACCENT[accentColor]

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['workshop-models', queryKeySuffix],
    queryFn: () => modelsApi.list({ model_type: 'llm', is_available: true, limit: 50 }),
    staleTime: 60_000,
  })
  const models: AIModel[] =
    modelsData?.data?.models ||
    modelsData?.data?.items ||
    (Array.isArray(modelsData?.data) ? modelsData.data : [])
  const autoModel = pickModel(models, providerPriority)

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Stop stream
  const handleStop = () => abortRef.current?.abort()

  // Send message
  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || isSending) return
    if (!autoModel) { toast.error('Models still loading…'); return }

    setInput('')
    setIsSending(true)
    setStreamingContent('')

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content }
    setMessages((prev) => [...prev, userMsg])

    const history = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    const controller = new AbortController()
    abortRef.current = controller
    let accumulated = ''
    let tokensCharged = 0

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: autoModel.id,
          messages: history,
          temperature: 0.4,
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || err?.detail || `HTTP ${response.status}`)
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
            if (chunk.error) throw new Error(chunk.error.message || 'Stream error')
            const delta = chunk.choices?.[0]?.delta?.content || ''
            if (delta) { accumulated += delta; setStreamingContent(accumulated) }
            if (chunk.aicaffe_tokens_charged) tokensCharged = chunk.aicaffe_tokens_charged
          } catch (e: any) {
            if (e.message?.includes('Stream error')) throw e
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Request failed')
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        setIsSending(false)
        setStreamingContent('')
        return
      }
    }

    if (accumulated) {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: accumulated },
      ])
      onResponse?.(accumulated)
    }
    if (tokensCharged > 0) deduct(tokensCharged)
    setStreamingContent('')
    setIsSending(false)
  }, [input, isSending, autoModel, messages, systemPrompt, token, deduct, onResponse])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleCopy = async (id: string, text: string) => {
    await copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-300">AI Assistant</p>
          <p className="text-[10px] text-gray-600 truncate max-w-[180px]">{contextLabel}</p>
        </div>
        {isSending && (
          <button onClick={handleStop} className="p-1 rounded hover:bg-gray-800 text-red-400 hover:text-red-300">
            <Square className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Model info */}
      {autoModel && (
        <div className="px-4 py-1.5 border-b border-gray-800/50 flex-shrink-0">
          <p className="text-[10px] text-gray-600">
            {autoModel.name} <span className="text-gray-700">· {autoModel.provider_name || autoModel.provider_slug}</span>
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && !isSending ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="w-8 h-8 text-gray-700 mb-3" />
            <p className="text-xs text-gray-500 leading-relaxed px-2">
              Ask questions about your work. The AI has full context of what you&apos;re working on.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-cyan-500/20' : accent.bg
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-3 h-3 text-cyan-400" />
                    : <Bot className={`w-3 h-3 ${accent.text}`} />
                  }
                </div>
                <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block max-w-full text-left text-xs rounded-xl px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/10 border border-cyan-500/20 text-gray-200'
                      : 'bg-gray-800/60 border border-gray-700 text-gray-200'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded !text-[10px] !mt-1 !mb-1"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className="bg-gray-700 px-1 py-0.5 rounded text-[10px]" {...props}>
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="mt-1 text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-green-400" />
                        : <Copy className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isSending && (
              <div className="flex gap-2">
                <div className={`w-6 h-6 rounded-md ${accent.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Bot className={`w-3 h-3 ${accent.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {streamingContent ? (
                    <div className="text-xs rounded-xl px-3 py-2 bg-gray-800/60 border border-gray-700 text-gray-200">
                      <div className="prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded !text-[10px] !mt-1 !mb-1"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className="bg-gray-700 px-1 py-0.5 rounded text-[10px]" {...props}>
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                        <span className={`inline-block w-1.5 h-3 ${accent.cursor} animate-pulse ml-0.5 align-middle rounded-sm`} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500 py-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Thinking…</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex-shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your work…"
            rows={2}
            disabled={isSending}
            className={`w-full px-3 py-2 pr-10 text-xs bg-gray-800/60 border border-gray-700 rounded-xl text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 ${accent.ring}`}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={`absolute right-2 bottom-2 p-1.5 rounded-lg ${accent.btn} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
