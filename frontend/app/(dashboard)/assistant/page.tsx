'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Settings, Trash2, ChevronDown, Copy, Check, RefreshCw,
  MessageSquare, Bot, User, Sparkles, Loader2, Archive, Pin, MoreVertical
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { assistantApi, modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { useChatStore, useWalletStore } from '@/lib/store'
import { formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Conversation, Message, AIModel, ChatCompletionResponse } from '@/lib/types'

export default function AssistantPage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [input, setInput] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(searchParams.get('model') || '')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    temperature: 0.7,
    max_tokens: 4096,
    system_prompt: '',
  })

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

  const models: AIModel[] = modelsData?.data?.models || modelsData?.data?.items || (Array.isArray(modelsData?.data) ? modelsData.data : [])
  const conversations: Conversation[] = conversationsData?.data?.conversations || conversationsData?.data?.items || (Array.isArray(conversationsData?.data) ? conversationsData.data : [])

  const modelOptions = models
    .filter((m) => m.id && m.id.trim() !== '')
    .map((m) => ({
      value: m.id,
      label: `${m.name} (${m.provider_name})`,
    }))

  // Set default model
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      const featured = models.find((m) => m.is_featured)
      setSelectedModelId(featured?.id || models[0].id)
    }
  }, [models, selectedModelId])

  // Load conversation messages
  const loadConversation = async (conversationId: string) => {
    try {
      const response = await assistantApi.getConversation(conversationId)
      const data = response.data
      setActiveConversationId(conversationId)
      setMessages(data.messages || [])
      if (data.model_id) {
        setSelectedModelId(data.model_id)
      }
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }))
      }
      if (data.system_prompt) {
        setSettings((prev) => ({ ...prev, system_prompt: data.system_prompt }))
      }
    } catch (error) {
      toast.error('Failed to load conversation')
    }
  }

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: (data: { model_id: string; system_prompt?: string }) =>
      assistantApi.createConversation(data),
    onSuccess: (response) => {
      const newConversation = response.data
      setActiveConversationId(newConversation.id)
      setMessages([])
      refetchConversations()
    },
    onError: () => {
      toast.error('Failed to create conversation')
    },
  })

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedModelId) {
        throw new Error('Please select a model')
      }

      // Create conversation if none active
      let conversationId = activeConversationId
      if (!conversationId) {
        const convResponse = await assistantApi.createConversation({
          model_id: selectedModelId,
          system_prompt: settings.system_prompt || undefined,
        })
        conversationId = convResponse.data.id
        setActiveConversationId(conversationId)
        refetchConversations()
      }

      // Add user message to UI immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsTyping(true)

      // Send to API
      const response = await assistantApi.chat({
        model_id: selectedModelId,
        conversation_id: conversationId,
        messages: [
          ...(settings.system_prompt ? [{ role: 'system', content: settings.system_prompt }] : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content },
        ],
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
      })

      return response.data as ChatCompletionResponse
    },
    onSuccess: (response) => {
      const assistantMessage: Message = {
        id: response.id,
        conversation_id: activeConversationId!,
        role: 'assistant',
        content: response.message.content,
        model_name: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        aicaffe_tokens_charged: response.aicaffe_tokens_charged,
        latency_ms: response.latency_ms,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)

      // Deduct tokens from wallet
      if (response.aicaffe_tokens_charged) {
        deduct(response.aicaffe_tokens_charged)
      }

      refetchConversations()
    },
    onError: (error: any) => {
      setIsTyping(false)
      const message = error.response?.data?.detail || error.message || 'Failed to send message'
      toast.error(message)
      // Remove the optimistic user message
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
    },
  })

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: (id: string) => assistantApi.deleteConversation(id),
    onSuccess: () => {
      if (activeConversationId) {
        setActiveConversationId(null)
        setMessages([])
      }
      refetchConversations()
      toast.success('Conversation deleted')
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Handle send
  const handleSend = () => {
    const content = input.trim()
    if (!content || sendMessage.isPending) return
    setInput('')
    sendMessage.mutate(content)
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // New chat
  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setSettings({ temperature: 0.7, max_tokens: 4096, system_prompt: '' })
    textareaRef.current?.focus()
  }

  const selectedModel = models.find((m) => m.id === selectedModelId)

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Sidebar - Conversations */}
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

        <div className="flex-1 overflow-y-auto px-2">
          {conversations.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No conversations yet</p>
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
                    <p className="text-sm truncate">
                      {conv.title || 'New conversation'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(conv.last_message_at || conv.created_at)}
                    </p>
                  </div>
                  {conv.is_pinned && <Pin className="w-3 h-3 text-violet-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <Select
              value={selectedModelId}
              onValueChange={setSelectedModelId}
              options={modelOptions}
              placeholder="Select a model..."
              className="w-72"
            />
            {selectedModel && (
              <Badge variant="default">
                {selectedModel.avg_latency_ms}ms avg
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            leftIcon={<Settings className="w-4 h-4" />}
          >
            Settings
          </Button>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-gray-800 overflow-hidden"
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
                    onChange={(e) => setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
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
                    onChange={(e) => setSettings((s) => ({ ...s, max_tokens: parseInt(e.target.value) }))}
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
                    onChange={(e) => setSettings((s) => ({ ...s, system_prompt: e.target.value }))}
                    placeholder="You are a helpful assistant..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Start a new conversation
              </h2>
              <p className="text-gray-400 max-w-md">
                Select a model and start chatting. You can switch models mid-conversation
                and compare responses across different AI providers.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isTyping && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
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
                style={{
                  minHeight: '48px',
                  maxHeight: '200px',
                }}
                disabled={sendMessage.isPending}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {input.length > 0 && `${input.length} chars`}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || sendMessage.isPending}
                  isLoading={sendMessage.isPending}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

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

      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
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

        {/* Message Metadata */}
        <div className={`flex items-center gap-3 mt-2 text-xs text-gray-500 ${isUser ? 'justify-end' : ''}`}>
          {message.model_name && (
            <span>{message.model_name}</span>
          )}
          {message.aicaffe_tokens_charged && (
            <span>{formatNumber(message.aicaffe_tokens_charged)} tokens</span>
          )}
          {message.latency_ms && (
            <span>{message.latency_ms}ms</span>
          )}
          <button
            onClick={handleCopy}
            className="p-1 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
