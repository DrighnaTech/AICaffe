'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Loader2, FileText, Search, Palette, Code2,
  Mic, Video, Database, Languages, Bot, Wand2, Clock, Star,
  ChevronRight, Zap, Image, Music, BookOpen, Lightbulb, CheckCircle2
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { tasksApi, templatesApi, routingApi, type TaskCategory } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

// Category configuration
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
      { id: 'web_search', name: 'Web Search' },
      { id: 'analysis', name: 'Analysis' },
      { id: 'summarization', name: 'Summarization' },
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
      { id: 'image_generation', name: 'Image Generation' },
      { id: 'ui_mockup', name: 'UI Mockups' },
      { id: 'logo', name: 'Logo Design' },
      { id: 'illustration', name: 'Illustrations' },
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
      { id: 'fast_code', name: 'Fast Code' },
    ],
  },
  {
    id: 'audio',
    name: 'Audio',
    description: 'Voice, music, sound',
    icon: <Mic className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20',
    subcategories: [
      { id: 'tts', name: 'Text to Speech' },
      { id: 'stt', name: 'Speech to Text' },
      { id: 'music', name: 'Music Generation' },
      { id: 'voice_clone', name: 'Voice Cloning' },
    ],
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Video generation, editing',
    icon: <Video className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
    subcategories: [
      { id: 'generation', name: 'Video Generation' },
      { id: 'avatar', name: 'AI Avatars' },
    ],
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Data analysis, visualization',
    icon: <Database className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
    subcategories: [
      { id: 'analysis', name: 'Data Analysis' },
      { id: 'visualization', name: 'Visualization' },
    ],
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

// Quick Templates
const QUICK_TEMPLATES = [
  { icon: <FileText className="w-4 h-4" />, label: 'Write a blog post', category: 'content' as TaskCategory, subcategory: 'blog' },
  { icon: <Code2 className="w-4 h-4" />, label: 'Generate code', category: 'development' as TaskCategory, subcategory: 'code_generation' },
  { icon: <Search className="w-4 h-4" />, label: 'Research a topic', category: 'research' as TaskCategory, subcategory: 'web_search' },
  { icon: <Image className="w-4 h-4" />, label: 'Create an image', category: 'design' as TaskCategory, subcategory: 'image_generation' },
  { icon: <Lightbulb className="w-4 h-4" />, label: 'Brainstorm ideas', category: 'assistant' as TaskCategory },
  { icon: <BookOpen className="w-4 h-4" />, label: 'Summarize text', category: 'research' as TaskCategory, subcategory: 'summarization' },
]

export default function AIHubPage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [showResult, setShowResult] = useState(false)

  // Fetch recent tasks
  const { data: recentTasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn: () => tasksApi.list({ limit: 10 }),
  })

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: () => templatesApi.list(selectedCategory || undefined),
    enabled: !!selectedCategory,
  })

  const recentTasks = recentTasksData?.data?.tasks || []
  const templates = templatesData?.data?.templates || []

  // Execute task mutation
  const executeTask = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) throw new Error('Please enter a prompt')
      if (!selectedCategory) throw new Error('Please select a category')

      return tasksApi.create({
        title: prompt.slice(0, 100),
        category: selectedCategory,
        subcategory: selectedSubcategory || undefined,
        prompt: prompt,
      })
    },
    onSuccess: (response) => {
      setResult(response.data)
      setShowResult(true)
      refetchTasks()
      toast.success('Task completed!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.message || 'Task failed')
    },
  })

  const handleCategorySelect = (category: TaskCategory) => {
    setSelectedCategory(category)
    setSelectedSubcategory(null)
    textareaRef.current?.focus()
  }

  const handleQuickTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    setSelectedCategory(template.category)
    setSelectedSubcategory(template.subcategory || null)
    setPrompt(template.label + ': ')
    textareaRef.current?.focus()
  }

  const handleSubmit = () => {
    if (!prompt.trim() || executeTask.isPending) return
    if (!selectedCategory) {
      toast.error('Please select a category first')
      return
    }
    executeTask.mutate()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const selectedCategoryConfig = CATEGORIES.find((c) => c.id === selectedCategory)

  return (
    <div className="min-h-[calc(100vh-7rem)] -m-6 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            AI-Powered Workspace
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            What would you like to create?
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Select a category and describe your task. Our AI engine automatically picks the best model for optimal results.
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                selectedCategory === category.id
                  ? `${category.bgColor} border-2 ring-2 ring-offset-2 ring-offset-gray-900 ring-${category.color.split('-')[1]}-500/50`
                  : `${category.bgColor} border-gray-700/50`
              }`}
            >
              <div className={category.color}>{category.icon}</div>
              <span className="text-sm font-medium text-white">{category.name}</span>
            </button>
          ))}
        </div>

        {/* Subcategory Pills */}
        <AnimatePresence>
          {selectedCategoryConfig?.subcategories && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-wrap gap-2 justify-center mb-8"
            >
              <span className="text-gray-500 text-sm mr-2">Subcategory:</span>
              {selectedCategoryConfig.subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(selectedSubcategory === sub.id ? null : sub.id)}
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

        {/* Input Area */}
        <div className="relative mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-1">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedCategory
                  ? `Describe your ${selectedCategoryConfig?.name.toLowerCase()} task...`
                  : 'Select a category above, then describe your task...'
              }
              rows={4}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
              disabled={executeTask.isPending}
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700/50">
              <div className="flex items-center gap-3">
                {selectedCategory && (
                  <Badge className={selectedCategoryConfig?.bgColor}>
                    <span className={selectedCategoryConfig?.color}>{selectedCategoryConfig?.icon}</span>
                    <span className="ml-1">{selectedCategoryConfig?.name}</span>
                    {selectedSubcategory && (
                      <span className="text-gray-400"> / {selectedCategoryConfig?.subcategories?.find((s) => s.id === selectedSubcategory)?.name}</span>
                    )}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{prompt.length} chars</span>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || !selectedCategory || executeTask.isPending}
                  isLoading={executeTask.isPending}
                  leftIcon={executeTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                >
                  {executeTask.isPending ? 'Processing...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Templates */}
        {!selectedCategory && (
          <div className="mb-10">
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Quick Start
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

        {/* Result Display */}
        <AnimatePresence>
          {showResult && result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-10"
            >
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-medium text-white">{result.title}</span>
                    <Badge variant="success">{result.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Model: {result.model_used}</span>
                    <span>{result.tokens_total?.toLocaleString()} tokens</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
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
                      }}
                    >
                      {result.result || 'No result'}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <div>
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Tasks
            </h3>
            <div className="space-y-2">
              {recentTasks.slice(0, 5).map((task: any) => {
                const categoryConfig = CATEGORIES.find((c) => c.id === task.category)
                return (
                  <button
                    key={task.id}
                    onClick={() => {
                      setResult(task)
                      setShowResult(true)
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 bg-gray-800/30 border border-gray-800 rounded-xl hover:bg-gray-800/50 hover:border-gray-700 transition-all text-left group"
                  >
                    <div className={`${categoryConfig?.color} opacity-60 group-hover:opacity-100`}>
                      {categoryConfig?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        {task.model_used} - {task.tokens_total?.toLocaleString()} tokens
                      </p>
                    </div>
                    <Badge
                      variant={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : 'warning'}
                    >
                      {task.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Templates Section */}
        {selectedCategory && templates.length > 0 && (
          <div className="mt-10">
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Templates for {selectedCategoryConfig?.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.slice(0, 6).map((template: any) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setPrompt(template.prompt_template)
                    textareaRef.current?.focus()
                  }}
                  className="p-4 bg-gray-800/30 border border-gray-800 rounded-xl hover:bg-gray-800/50 hover:border-gray-700 transition-all text-left"
                >
                  <h4 className="font-medium text-white mb-1">{template.name}</h4>
                  <p className="text-sm text-gray-400 line-clamp-2">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
