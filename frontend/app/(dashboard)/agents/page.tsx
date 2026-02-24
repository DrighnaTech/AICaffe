'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Bot, Wand2, Settings2, Trash2, MessageSquare, MoreVertical,
  Sparkles, Code2, Search, Globe, FileText, Calculator, Mail, Database,
  Workflow, Play, CheckCircle2, X, ChevronRight, Loader2, Edit3, Copy
} from 'lucide-react'
import { agentsApi, agentToolsApi, conversationsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

// Tool icons mapping
const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search className="w-4 h-4" />,
  code_interpreter: <Code2 className="w-4 h-4" />,
  image_generation: <Sparkles className="w-4 h-4" />,
  document_reader: <FileText className="w-4 h-4" />,
  calculator: <Calculator className="w-4 h-4" />,
  url_reader: <Globe className="w-4 h-4" />,
  n8n_workflow: <Workflow className="w-4 h-4" />,
  database_query: <Database className="w-4 h-4" />,
  email_sender: <Mail className="w-4 h-4" />,
}

// Preset agent templates
const AGENT_TEMPLATES = [
  {
    name: 'Research Assistant',
    description: 'Expert at finding and synthesizing information from the web',
    system_prompt: 'You are a research assistant. You excel at finding accurate information, analyzing sources, and synthesizing findings into clear summaries. Always cite your sources and present balanced perspectives.',
    primary_model: 'claude-3-5-sonnet-20241022',
    capabilities: ['web_search', 'url_reader', 'document_reader'],
    icon: <Search className="w-6 h-6" />,
    color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  {
    name: 'Code Buddy',
    description: 'Helps write, debug, and review code in any language',
    system_prompt: 'You are an expert programmer. You write clean, efficient, well-documented code. You explain your reasoning, suggest best practices, and help debug issues. Support all major programming languages.',
    primary_model: 'claude-3-5-sonnet-20241022',
    capabilities: ['code_interpreter', 'url_reader'],
    icon: <Code2 className="w-6 h-6" />,
    color: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  },
  {
    name: 'Creative Writer',
    description: 'Helps with creative writing, storytelling, and content creation',
    system_prompt: 'You are a creative writing assistant with expertise in storytelling, poetry, and engaging content. You adapt your style to match the genre and tone requested. You provide constructive feedback and help overcome creative blocks.',
    primary_model: 'claude-3-5-sonnet-20241022',
    capabilities: ['document_reader'],
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  },
  {
    name: 'Data Analyst',
    description: 'Analyzes data, creates visualizations, and generates insights',
    system_prompt: 'You are a data analyst expert. You analyze datasets, identify patterns and trends, create visualizations, and provide actionable insights. You explain statistical concepts clearly and help with data-driven decision making.',
    primary_model: 'gpt-4o',
    capabilities: ['code_interpreter', 'calculator', 'database_query'],
    icon: <Database className="w-6 h-6" />,
    color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  {
    name: 'Automation Agent',
    description: 'Creates and manages automated workflows with n8n',
    system_prompt: 'You are an automation specialist. You help design, build, and optimize automated workflows using n8n and other automation tools. You understand APIs, webhooks, and data transformations.',
    primary_model: 'claude-3-5-sonnet-20241022',
    capabilities: ['n8n_workflow', 'url_reader', 'code_interpreter'],
    icon: <Workflow className="w-6 h-6" />,
    color: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
  },
]

// Available models
const AVAILABLE_MODELS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder', provider: 'DeepSeek' },
  { value: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'Meta/Groq' },
  { value: 'o1-preview', label: 'o1-preview (Reasoning)', provider: 'OpenAI' },
]

export default function AgentsPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    primary_model: 'claude-3-5-sonnet-20241022',
    capabilities: [] as string[],
    is_public: false,
  })

  // Fetch agents
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(true),
  })

  // Fetch available tools
  const { data: toolsData } = useQuery({
    queryKey: ['agent-tools'],
    queryFn: () => agentToolsApi.list(),
  })

  const agents = agentsData?.data?.agents || []
  const tools = toolsData?.data?.tools || []

  // Create agent mutation
  const createAgent = useMutation({
    mutationFn: (data: any) => agentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setShowCreateModal(false)
      resetForm()
      toast.success('Agent created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create agent')
    },
  })

  // Delete agent mutation
  const deleteAgent = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agent deleted')
    },
    onError: () => {
      toast.error('Failed to delete agent')
    },
  })

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let convoId = conversationId
      if (!convoId && selectedAgent) {
        const convoRes = await agentsApi.createConversation(selectedAgent.id)
        convoId = convoRes.data.id
        setConversationId(convoId)
      }
      return conversationsApi.sendMessage(convoId!, content)
    },
    onSuccess: (response) => {
      setChatMessages((prev) => [
        ...prev,
        response.data.user_message,
        response.data.assistant_message,
      ])
    },
    onError: () => {
      toast.error('Failed to send message')
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      primary_model: 'claude-3-5-sonnet-20241022',
      capabilities: [],
      is_public: false,
    })
  }

  const handleTemplateSelect = (template: typeof AGENT_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      system_prompt: template.system_prompt,
      primary_model: template.primary_model,
      capabilities: template.capabilities,
      is_public: false,
    })
  }

  const handleCreateAgent = () => {
    if (!formData.name || !formData.system_prompt) {
      toast.error('Please fill in required fields')
      return
    }
    createAgent.mutate({
      ...formData,
      tools: formData.capabilities,
    })
  }

  const handleStartChat = (agent: any) => {
    setSelectedAgent(agent)
    setChatMessages([])
    setConversationId(null)
    setShowChatModal(true)
  }

  const handleSendChat = () => {
    if (!chatInput.trim() || sendMessage.isPending) return
    setChatMessages((prev) => [...prev, { role: 'user', content: chatInput }])
    sendMessage.mutate(chatInput)
    setChatInput('')
  }

  const toggleCapability = (toolName: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(toolName)
        ? prev.capabilities.filter((c) => c !== toolName)
        : [...prev.capabilities, toolName],
    }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wand2 className="w-7 h-7 text-violet-400" />
            Agent Builder
          </h1>
          <p className="text-gray-400 mt-1">
            Create custom AI agents with specific capabilities and personalities
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Agent
        </Button>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20">
          <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No agents yet</h3>
          <p className="text-gray-400 mb-6">Create your first custom AI agent to get started</p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Create Your First Agent
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.primary_model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {agent.is_public && (
                    <Badge variant="success" className="text-xs">Public</Badge>
                  )}
                  <button
                    onClick={() => deleteAgent.mutate(agent.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {agent.description || 'No description'}
              </p>

              {/* Capabilities */}
              {agent.tools && JSON.parse(agent.tools).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {JSON.parse(agent.tools).slice(0, 4).map((tool: string) => (
                    <span
                      key={tool}
                      className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300 flex items-center gap-1"
                    >
                      {TOOL_ICONS[tool] || <Settings2 className="w-3 h-3" />}
                      {tool.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span>{agent.total_conversations || 0} conversations</span>
                <span>{agent.total_messages || 0} messages</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Play className="w-4 h-4" />}
                  onClick={() => handleStartChat(agent)}
                >
                  Chat
                </Button>
                <Button variant="outline" size="sm">
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Create New Agent</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Templates */}
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Start from a template</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {AGENT_TEMPLATES.map((template) => (
                      <button
                        key={template.name}
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${template.color}`}
                      >
                        <div className="mb-2">{template.icon}</div>
                        <h4 className="font-medium text-white text-sm">{template.name}</h4>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1">{template.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-4">Or customize your agent</h3>

                  {/* Name & Description */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Agent Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="My Custom Agent"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Model</label>
                      <select
                        value={formData.primary_model}
                        onChange={(e) => setFormData((p) => ({ ...p, primary_model: e.target.value }))}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        {AVAILABLE_MODELS.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label} ({model.provider})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="What does this agent do?"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* System Prompt */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">System Prompt *</label>
                    <textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData((p) => ({ ...p, system_prompt: e.target.value }))}
                      placeholder="You are a helpful assistant that..."
                      rows={4}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>

                  {/* Tools/Capabilities */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Capabilities</label>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool: any) => (
                        <button
                          key={tool.name}
                          onClick={() => toggleCapability(tool.name)}
                          className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all ${
                            formData.capabilities.includes(tool.name)
                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {TOOL_ICONS[tool.name] || <Settings2 className="w-4 h-4" />}
                          {tool.display_name}
                          {formData.capabilities.includes(tool.name) && (
                            <CheckCircle2 className="w-4 h-4 text-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Public toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setFormData((p) => ({ ...p, is_public: !p.is_public }))}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        formData.is_public ? 'bg-violet-500' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                          formData.is_public ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-400">Make this agent public</span>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateAgent}
                  isLoading={createAgent.isPending}
                >
                  Create Agent
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {showChatModal && selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowChatModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{selectedAgent.name}</h3>
                    <p className="text-xs text-gray-500">{selectedAgent.primary_model}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChatModal(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Start a conversation with {selectedAgent.name}</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-xl ${
                          msg.role === 'user'
                            ? 'bg-violet-500/20 border border-violet-500/30'
                            : 'bg-gray-800 border border-gray-700'
                        }`}
                      >
                        <p className="text-white text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {sendMessage.isPending && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    disabled={sendMessage.isPending}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || sendMessage.isPending}
                    isLoading={sendMessage.isPending}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
