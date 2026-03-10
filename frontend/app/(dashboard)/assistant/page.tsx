'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Settings, Trash2, Copy, Check,
  MessageSquare, Bot, User, Sparkles, Loader2, Pin, Square,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { assistantApi, modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Conversation, Message, AIModel } from '@/lib/types'

function makeTitle(text: string) {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 60 ? t.slice(0, 57) + '…' : t
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function AssistantPage() {
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [input, setInput] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(searchParams.get('model') || '')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    temperature: 0.7,
    max_tokens: 4096,
    system_prompt: '',
  })

  const { token } = useAuthStore()
  const { deduct } = useWalletStore()

  // Fetch available models
  const { data: modelsData } = useQuery({
    queryKey: ['chat-models'],
    queryFn: () => modelsApi.list({ model_type: 'llm', is_available: true, limit: 50 }),
  })

  // Fetch conversations
  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => assistantApi.conversations({ limit: 50 }),
  })

  const models: AIModel[] =
    modelsData?.data?.models ||
    modelsData?.data?.items ||
    (Array.isArray(modelsData?.data) ? modelsData.data : [])

  const conversations: Conversation[] =
    conversationsData?.data?.conversations ||
    conversationsData?.data?.items ||
    (Array.isArray(conversationsData?.data) ? conversationsData.data : [])

  const modelOptions = models
    .filter((m) => m.id && m.id.trim() !== '')
    .map((m) => ({
      value: m.id,
      label: `${m.name} (${m.provider_name || m.provider_slug})`,
    }))

  // Set default model
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      const featured = models.find((m) => m.is_featured)
      setSelectedModelId(featured?.id || models[0].id)
    }
  }, [models, selectedModelId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Load conversation messages
  const loadConversation = async (conversationId: string) => {
    try {
      const response = await assistantApi.getConversation(conversationId)
      const data = response.data
      setActiveConversationId(conversationId)
      setMessages(data.messages || [])
      if (data.conversation?.model_id) setSelectedModelId(data.conversation.model_id)
      if (data.conversation?.system_prompt) {
        setSettings((prev) => ({ ...prev, system_prompt: data.conversation.system_prompt }))
      }
    } catch {
      toast.error('Failed to load conversation')
    }
  }

  // Stop current stream
  const handleStop = () => {
    abortRef.current?.abort()
  }

  // Send message with SSE streaming
  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || isSending) return
    if (!selectedModelId) {
      toast.error('Please select a model')
      return
    }

    setInput('')
    setIsSending(true)
    setStreamingContent('')

    // Optimistic user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    // Ensure conversation exists
    let conversationId = activeConversationId
    const isNewConversation = !conversationId
    try {
      if (!conversationId) {
        const convRes = await assistantApi.createConversation({
          title: makeTitle(content),
          model_id: selectedModelId,
          system_prompt: settings.system_prompt || undefined,
        })
        conversationId = convRes.data.id
        setActiveConversationId(conversationId)
        refetchConversations()
      }
    } catch {
      toast.error('Failed to create conversation')
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setIsSending(false)
      return
    }

    // Build message history for context
    const history = [
      ...(settings.system_prompt ? [{ role: 'system', content: settings.system_prompt }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    // Stream the response
    const controller = new AbortController()
    abortRef.current = controller
    let accumulated = ''
    let tokensCharged = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let latencyMs = 0
    const startTime = Date.now()

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: selectedModelId,
          messages: history,
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
          conversation_id: conversationId,
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
            if (chunk.error) throw new Error(chunk.error.message || 'Stream error')
            const delta = chunk.choices?.[0]?.delta?.content || ''
            if (delta) {
              accumulated += delta
              setStreamingContent(accumulated)
            }
            if (chunk.usage) {
              totalInputTokens = chunk.usage.prompt_tokens || chunk.usage.input_tokens || 0
              totalOutputTokens = chunk.usage.completion_tokens || chunk.usage.output_tokens || 0
            }
            if (chunk.aicaffe_tokens_charged) tokensCharged = chunk.aicaffe_tokens_charged
          } catch (parseErr: any) {
            if (parseErr.message?.includes('Stream error')) throw parseErr
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to get response')
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        setIsSending(false)
        setStreamingContent('')
        return
      }
      // AbortError — keep what accumulated so far
    }

    latencyMs = Date.now() - startTime

    // Add final assistant message to state
    if (accumulated) {
      const selectedModel = models.find((m) => m.id === selectedModelId)
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        conversation_id: conversationId!,
        role: 'assistant',
        content: accumulated,
        model_name: selectedModel?.name,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        aicaffe_tokens_charged: tokensCharged,
        latency_ms: latencyMs,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    }

    if (tokensCharged > 0) deduct(tokensCharged)
    setStreamingContent('')
    setIsSending(false)

    // Persist messages to DB (fire-and-forget — don't block UI)
    if (accumulated && conversationId) {
      assistantApi.saveMessages(conversationId, {
        user_content: content,
        assistant_content: accumulated,
        model_id: selectedModelId,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        aicaffe_tokens_charged: tokensCharged,
        latency_ms: latencyMs,
      }).catch(() => {}) // silent — messages are already in UI state
    }

    refetchConversations()
  }, [input, isSending, selectedModelId, activeConversationId, messages, settings, token, deduct, refetchConversations, models])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    abortRef.current?.abort()
    setActiveConversationId(null)
    setMessages([])
    setStreamingContent('')
    setIsSending(false)
    setSettings({ temperature: 0.7, max_tokens: 4096, system_prompt: '' })
    textareaRef.current?.focus()
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await assistantApi.deleteConversation(id)
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
      refetchConversations()
      toast.success('Conversation deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const selectedModel = models.find((m) => m.id === selectedModelId)

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Sidebar — Conversations */}
      <div className="w-72 bg-gray-900/50 border-r border-gray-800 flex flex-col">
        <div className="p-4">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleNewChat}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">No conversations yet</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors group ${
                    activeConversationId === conv.id
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{conv.title || 'New conversation'}</p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(conv.last_message_at || conv.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {conv.is_pinned && <Pin className="w-3 h-3 text-violet-400" />}
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Select
              value={selectedModelId}
              onValueChange={setSelectedModelId}
              options={modelOptions}
              placeholder="Select a model..."
              className="w-72"
            />
            {selectedModel?.avg_latency_ms && (
              <Badge variant="default">{selectedModel.avg_latency_ms}ms avg</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStop}
                leftIcon={<Square className="w-4 h-4" />}
                className="text-red-400 hover:text-red-300"
              >
                Stop
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              leftIcon={<Settings className="w-4 h-4" />}
            >
              Settings
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-gray-800 overflow-hidden flex-shrink-0"
            >
              <div className="p-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Temperature: {settings.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Max Tokens: {settings.max_tokens}
                  </label>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={settings.max_tokens}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, max_tokens: parseInt(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    System Prompt
                  </label>
                  <input
                    type="text"
                    value={settings.system_prompt}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, system_prompt: e.target.value }))
                    }
                    placeholder="You are a helpful assistant..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !isSending ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Start a new conversation</h2>
              <p className="text-gray-400 max-w-md">
                Select a model and start chatting. You can switch models mid-conversation and
                compare responses across different AI providers.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Streaming indicator */}
              {isSending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  {streamingContent ? (
                    /* Live streaming content */
                    <div className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl">
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-lg !bg-gray-900 !mt-2 !mb-2"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code
                                  className="bg-gray-700 px-1.5 py-0.5 rounded text-sm"
                                  {...props}
                                >
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                        {/* Blinking cursor */}
                        <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                      </div>
                    </div>
                  ) : (
                    /* Thinking state — waiting for first token */
                    <div className="flex items-center gap-2 text-gray-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-3 pr-24 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                style={{ minHeight: '48px', maxHeight: '200px' }}
                disabled={isSending}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                {input.length > 0 && (
                  <span className="text-xs text-gray-500">{input.length}</span>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  isLoading={isSending && !streamingContent}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-cyan-500/20' : 'bg-violet-500/20'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-cyan-400" />
        ) : (
          <Bot className="w-4 h-4 text-violet-400" />
        )}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block max-w-full text-left px-4 py-3 rounded-xl ${
            isUser
              ? 'bg-cyan-500/10 border border-cyan-500/20'
              : 'bg-gray-800/50 border border-gray-700'
          }`}
        >
          {isUser ? (
            <p className="text-white whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg !bg-gray-900 !mt-2 !mb-2"
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
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Message metadata */}
        <div
          className={`flex items-center gap-3 mt-1.5 text-xs text-gray-500 ${
            isUser ? 'justify-end' : ''
          }`}
        >
          {message.model_name && <span>{message.model_name}</span>}
          {message.aicaffe_tokens_charged ? (
            <span>{formatNumber(message.aicaffe_tokens_charged)} ACT</span>
          ) : null}
          {message.latency_ms ? <span>{message.latency_ms}ms</span> : null}
          <button onClick={handleCopy} className="p-1 hover:text-white transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
