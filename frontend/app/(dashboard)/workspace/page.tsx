'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Settings, Trash2, Copy, Check, RefreshCw,
  MessageSquare, Bot, User, Sparkles, Loader2, X, Maximize2, Grid3X3,
  Image as ImageIcon, Music, Video, Code, FileText, Mic, Upload, Download,
  Wand2, Palette, Layers, Play, Terminal, FileCode, Presentation, FileSpreadsheet,
  Brush, Camera, Film, PenTool, Layout, Figma, Globe, Smartphone, Database,
  Server, GitBranch, Bug, TestTube, Rocket, BookOpen, Edit3, FileSearch,
  Newspaper, Mail, MessageCircle, TrendingUp, BarChart3, Target, Users,
  Heart, Zap, Coffee, ChevronDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { assistantApi, modelsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useWalletStore, useAuthStore } from '@/lib/store'
import { formatNumber, copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AIModel } from '@/lib/types'

// User Personas
type UserPersona = 'designer' | 'developer' | 'writer' | 'marketer' | 'researcher' | 'general'

interface PersonaConfig {
  id: UserPersona
  name: string
  icon: React.ReactNode
  color: string
  bgColor: string
  gradient: string
  description: string
  quickActions: { icon: React.ReactNode; label: string; prompt: string }[]
  defaultModels: string[]
  tools: { icon: React.ReactNode; label: string; mode: string }[]
  systemPrompt: string
}

const personaConfigs: Record<UserPersona, PersonaConfig> = {
  designer: {
    id: 'designer',
    name: 'Designer',
    icon: <Palette className="w-5 h-5" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    gradient: 'from-pink-500 to-rose-500',
    description: 'Create stunning visuals, UI designs, and brand assets',
    quickActions: [
      { icon: <ImageIcon />, label: 'Generate Image', prompt: 'Generate a high-quality image of...' },
      { icon: <Layout />, label: 'UI Design', prompt: 'Design a modern UI for...' },
      { icon: <PenTool />, label: 'Logo Design', prompt: 'Create a logo concept for...' },
      { icon: <Brush />, label: 'Color Palette', prompt: 'Suggest a color palette for...' },
      { icon: <Figma />, label: 'Wireframe', prompt: 'Create a wireframe for...' },
      { icon: <Smartphone />, label: 'App Design', prompt: 'Design a mobile app screen for...' },
    ],
    defaultModels: ['dall-e-3', 'midjourney', 'stable-diffusion-xl'],
    tools: [
      { icon: <ImageIcon />, label: 'Image Gen', mode: 'image' },
      { icon: <Brush />, label: 'Edit Image', mode: 'image-edit' },
      { icon: <Layout />, label: 'UI/UX', mode: 'ui-design' },
      { icon: <Palette />, label: 'Colors', mode: 'colors' },
    ],
    systemPrompt: 'You are an expert UI/UX designer and visual artist. Help create stunning designs, provide color theory advice, suggest modern design trends, and assist with visual branding. Always think visually and provide detailed design specifications.'
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    icon: <Code className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Write, debug, and optimize code across any language',
    quickActions: [
      { icon: <FileCode />, label: 'Write Code', prompt: 'Write a function that...' },
      { icon: <Bug />, label: 'Debug', prompt: 'Debug this code:\n```\n\n```' },
      { icon: <RefreshCw />, label: 'Refactor', prompt: 'Refactor this code for better performance:\n```\n\n```' },
      { icon: <TestTube />, label: 'Write Tests', prompt: 'Write unit tests for:\n```\n\n```' },
      { icon: <Database />, label: 'SQL Query', prompt: 'Write an optimized SQL query to...' },
      { icon: <Server />, label: 'API Design', prompt: 'Design a REST API for...' },
    ],
    defaultModels: ['claude-3-5-sonnet', 'gpt-4o', 'deepseek-coder', 'codestral'],
    tools: [
      { icon: <Terminal />, label: 'Code', mode: 'code' },
      { icon: <Bug />, label: 'Debug', mode: 'debug' },
      { icon: <GitBranch />, label: 'Git', mode: 'git' },
      { icon: <Database />, label: 'Database', mode: 'database' },
    ],
    systemPrompt: 'You are an expert software engineer. Write clean, efficient, well-documented code. Follow best practices, design patterns, and security guidelines. Provide explanations for complex logic and suggest optimizations.'
  },
  writer: {
    id: 'writer',
    name: 'Content Creator',
    icon: <Edit3 className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    gradient: 'from-amber-500 to-orange-500',
    description: 'Write compelling content, articles, and documents',
    quickActions: [
      { icon: <FileText />, label: 'Write Article', prompt: 'Write a comprehensive article about...' },
      { icon: <BookOpen />, label: 'Blog Post', prompt: 'Write an engaging blog post about...' },
      { icon: <Mail />, label: 'Email', prompt: 'Write a professional email for...' },
      { icon: <Presentation />, label: 'Presentation', prompt: 'Create a presentation outline for...' },
      { icon: <Newspaper />, label: 'Press Release', prompt: 'Write a press release for...' },
      { icon: <Edit3 />, label: 'Edit/Proofread', prompt: 'Edit and improve this text:\n\n' },
    ],
    defaultModels: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-2-pro'],
    tools: [
      { icon: <FileText />, label: 'Write', mode: 'write' },
      { icon: <Edit3 />, label: 'Edit', mode: 'edit' },
      { icon: <Presentation />, label: 'Present', mode: 'presentation' },
      { icon: <FileSpreadsheet />, label: 'Document', mode: 'document' },
    ],
    systemPrompt: 'You are an expert content writer and editor. Write engaging, clear, and compelling content. Adapt tone and style based on the audience. Ensure proper grammar, structure, and SEO optimization when relevant.'
  },
  marketer: {
    id: 'marketer',
    name: 'Marketer',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    gradient: 'from-violet-500 to-purple-500',
    description: 'Create marketing campaigns, ads, and growth strategies',
    quickActions: [
      { icon: <Target />, label: 'Ad Copy', prompt: 'Write compelling ad copy for...' },
      { icon: <MessageCircle />, label: 'Social Post', prompt: 'Create a viral social media post about...' },
      { icon: <Mail />, label: 'Email Campaign', prompt: 'Design an email marketing campaign for...' },
      { icon: <BarChart3 />, label: 'Strategy', prompt: 'Create a marketing strategy for...' },
      { icon: <Users />, label: 'Persona', prompt: 'Create a customer persona for...' },
      { icon: <Sparkles />, label: 'Tagline', prompt: 'Generate catchy taglines for...' },
    ],
    defaultModels: ['claude-3-5-sonnet', 'gpt-4o'],
    tools: [
      { icon: <Target />, label: 'Ads', mode: 'ads' },
      { icon: <MessageCircle />, label: 'Social', mode: 'social' },
      { icon: <Mail />, label: 'Email', mode: 'email' },
      { icon: <BarChart3 />, label: 'Analytics', mode: 'analytics' },
    ],
    systemPrompt: 'You are an expert digital marketer. Create compelling marketing content, analyze market trends, and provide data-driven strategies. Focus on engagement, conversion, and brand voice consistency.'
  },
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    icon: <FileSearch className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    gradient: 'from-cyan-500 to-blue-500',
    description: 'Research, analyze, and synthesize information',
    quickActions: [
      { icon: <FileSearch />, label: 'Research', prompt: 'Research and summarize information about...' },
      { icon: <BarChart3 />, label: 'Analyze Data', prompt: 'Analyze this data and provide insights:\n\n' },
      { icon: <BookOpen />, label: 'Literature Review', prompt: 'Create a literature review on...' },
      { icon: <Sparkles />, label: 'Key Insights', prompt: 'Extract key insights from:\n\n' },
      { icon: <Globe />, label: 'Market Research', prompt: 'Conduct market research for...' },
      { icon: <FileText />, label: 'Report', prompt: 'Create a comprehensive report on...' },
    ],
    defaultModels: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-2-pro', 'perplexity'],
    tools: [
      { icon: <Globe />, label: 'Search', mode: 'search' },
      { icon: <BarChart3 />, label: 'Analyze', mode: 'analyze' },
      { icon: <FileText />, label: 'Report', mode: 'report' },
      { icon: <BookOpen />, label: 'Learn', mode: 'learn' },
    ],
    systemPrompt: 'You are an expert researcher and analyst. Provide well-researched, fact-based information. Cite sources when possible, present multiple perspectives, and synthesize complex information clearly.'
  },
  general: {
    id: 'general',
    name: 'General Assistant',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    gradient: 'from-gray-500 to-slate-500',
    description: 'Your all-purpose AI assistant for any task',
    quickActions: [
      { icon: <MessageSquare />, label: 'Ask Anything', prompt: '' },
      { icon: <Sparkles />, label: 'Brainstorm', prompt: 'Help me brainstorm ideas for...' },
      { icon: <FileText />, label: 'Summarize', prompt: 'Summarize the following:\n\n' },
      { icon: <Wand2 />, label: 'Create', prompt: 'Create...' },
      { icon: <RefreshCw />, label: 'Translate', prompt: 'Translate to [language]:\n\n' },
      { icon: <BookOpen />, label: 'Explain', prompt: 'Explain this concept:\n\n' },
    ],
    defaultModels: ['claude-3-5-sonnet', 'gpt-4o'],
    tools: [
      { icon: <MessageSquare />, label: 'Chat', mode: 'chat' },
      { icon: <ImageIcon />, label: 'Image', mode: 'image' },
      { icon: <Code />, label: 'Code', mode: 'code' },
      { icon: <FileText />, label: 'Document', mode: 'document' },
    ],
    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and useful responses. Adapt your communication style to the user\'s needs.'
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    model?: string
    tokensUsed?: number
    latency?: number
    imageUrl?: string
  }
  createdAt: string
}

export default function PersonaWorkspace() {
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { user } = useAuthStore()
  const { deduct } = useWalletStore()

  // Detect initial persona from user preferences or default
  const [activePersona, setActivePersona] = useState<UserPersona>('general')
  const [showPersonaSelector, setShowPersonaSelector] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTool, setActiveTool] = useState('chat')

  const config = personaConfigs[activePersona]

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['workspace-models'],
    queryFn: () => modelsApi.list({ is_available: true, limit: 50 }),
  })

  const models: AIModel[] = modelsData?.data?.models || modelsData?.data?.items || (Array.isArray(modelsData?.data) ? modelsData.data : [])

  const modelOptions = models.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.provider_name})`
  }))

  // Set default model based on persona
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      const featured = models.find((m) => m.is_featured)
      setSelectedModelId(featured?.id || models[0].id)
    }
  }, [models, selectedModelId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  // Handle persona change
  const handlePersonaChange = (persona: UserPersona) => {
    setActivePersona(persona)
    setShowPersonaSelector(false)
    setMessages([])
    // Reset to first tool
    setActiveTool(personaConfigs[persona].tools[0]?.mode || 'chat')
  }

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isGenerating) return
    if (!selectedModelId) {
      toast.error('Please select a model')
      return
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsGenerating(true)

    try {
      const response = await assistantApi.chat({
        model_id: selectedModelId,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })

      const assistantMessage: Message = {
        id: response.data.id,
        role: 'assistant',
        content: response.data.message.content,
        metadata: {
          model: response.data.model,
          tokensUsed: response.data.aicaffe_tokens_charged,
          latency: response.data.latency_ms
        },
        createdAt: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])

      if (response.data.aicaffe_tokens_charged) {
        deduct(response.data.aicaffe_tokens_charged)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message')
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Apply quick action
  const applyQuickAction = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  // Clear conversation
  const clearConversation = () => {
    setMessages([])
  }

  const selectedModel = models.find(m => m.id === selectedModelId)

  // Persona Selection Screen
  if (showPersonaSelector) {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex flex-col items-center justify-center p-6 -m-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to AI Workspace</h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Choose your role to get a personalized AI experience tailored to your work
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
          {Object.values(personaConfigs).map((persona, index) => (
            <motion.button
              key={persona.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handlePersonaChange(persona.id)}
              className="group p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 hover:bg-gray-900 transition-all text-left"
            >
              <div className={`w-14 h-14 ${persona.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${persona.color}`}>
                {persona.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{persona.name}</h3>
              <p className="text-sm text-gray-400">{persona.description}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {persona.tools.slice(0, 3).map(tool => (
                  <span key={tool.mode} className="px-2 py-0.5 text-xs bg-gray-800 rounded-full text-gray-400">
                    {tool.label}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-sm text-gray-500 mt-8">
          You can switch personas anytime from the workspace header
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Left Panel - Tools & Quick Actions */}
      <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col">
        {/* Persona Header */}
        <div className={`p-4 bg-gradient-to-r ${config.gradient} bg-opacity-10`}>
          <button
            onClick={() => setShowPersonaSelector(true)}
            className="flex items-center gap-3 w-full"
          >
            <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center ${config.color}`}>
              {config.icon}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-white">{config.name}</h2>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-400">Click to switch</p>
            </div>
          </button>
        </div>

        {/* Tools */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-2 px-1">TOOLS</p>
          <div className="flex flex-wrap gap-2">
            {config.tools.map(tool => (
              <button
                key={tool.mode}
                onClick={() => setActiveTool(tool.mode)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeTool === tool.mode
                    ? `${config.bgColor} ${config.color}`
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-gray-500 mb-2 px-1">QUICK ACTIONS</p>
          <div className="space-y-1">
            {config.quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => applyQuickAction(action.prompt)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-gray-400 hover:bg-gray-800 hover:text-white transition-all group"
              >
                <span className={`${config.color} group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </span>
                <span className="text-sm">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* New Conversation */}
        <div className="p-3 border-t border-gray-800">
          <Button
            variant="outline"
            className="w-full"
            onClick={clearConversation}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Conversation
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <Select
              value={selectedModelId}
              onValueChange={setSelectedModelId}
              options={modelOptions}
              placeholder="Select model..."
              className="w-72"
            />
            {selectedModel && (
              <Badge variant="default" className="text-xs">
                {selectedModel.avg_latency_ms}ms avg
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className={`w-20 h-20 bg-gradient-to-br ${config.gradient} rounded-2xl flex items-center justify-center mb-6 text-white [&>svg]:w-10 [&>svg]:h-10`}>
                {config.icon}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {config.name} Workspace
              </h2>
              <p className="text-gray-400 max-w-md mb-8">
                {config.description}. I&apos;m here to help you with specialized assistance.
              </p>

              {/* Suggested prompts */}
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {config.quickActions.slice(0, 4).map((action, i) => (
                  <button
                    key={i}
                    onClick={() => applyQuickAction(action.prompt)}
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 transition-all text-left"
                  >
                    <span className={config.color}>{action.icon}</span>
                    <span className="text-sm">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  config={config}
                />
              ))}
              {isGenerating && (
                <div className="flex gap-4">
                  <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
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
                placeholder={`Ask your ${config.name.toLowerCase()} assistant anything...`}
                rows={3}
                className="w-full px-4 py-3 pr-32 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                disabled={isGenerating}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating}
                  isLoading={isGenerating}
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

function MessageBubble({ message, config }: { message: Message; config: PersonaConfig }) {
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
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-cyan-500/20' : config.bgColor
        }`}
      >
        {isUser ? (
          <User className="w-5 h-5 text-cyan-400" />
        ) : (
          <span className={config.color}>{config.icon}</span>
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

        {/* Metadata */}
        <div className={`flex items-center gap-3 mt-2 text-xs text-gray-500 ${isUser ? 'justify-end' : ''}`}>
          {message.metadata?.model && (
            <span>{message.metadata.model}</span>
          )}
          {message.metadata?.tokensUsed && (
            <span>{formatNumber(message.metadata.tokensUsed)} tokens</span>
          )}
          {message.metadata?.latency && (
            <span>{message.metadata.latency}ms</span>
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
