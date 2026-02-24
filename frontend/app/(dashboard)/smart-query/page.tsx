'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Sparkles, Users, Zap, MessageSquare, CheckCircle2,
  Loader2, ChevronDown, Copy, ThumbsUp, ThumbsDown, RefreshCw,
  Target, Scale, Lightbulb, FileCheck, Wand2, Network
} from 'lucide-react'
import { orchestratorApi, AgentRole, TaskType } from '@/lib/api'

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

export default function SmartQueryPage() {
  const [query, setQuery] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('parallel')
  const [selectedAgents, setSelectedAgents] = useState<AgentRole[]>(['researcher', 'analyst', 'writer'])
  const [useSmartMode, setUseSmartMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleAgent = (agent: AgentRole) => {
    if (selectedAgents.includes(agent)) {
      setSelectedAgents(selectedAgents.filter(a => a !== agent))
    } else {
      setSelectedAgents([...selectedAgents, agent])
    }
  }

  const handleSubmit = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let response
      if (useSmartMode) {
        response = await orchestratorApi.smartQuery({
          query: query.trim(),
          prefer_quality: true,
        })
      } else {
        response = await orchestratorApi.orchestrate({
          query: query.trim(),
          task_type: taskType,
          agents: selectedAgents,
          quality_threshold: 0.7,
        })
      }
      setResult(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process query')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Smart Query</h1>
              <p className="text-gray-400">Meta-Agent Orchestrator - Multiple AI agents working together</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Query Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* Smart Mode Toggle */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <span className="font-medium text-white">Smart Mode</span>
                </div>
                <button
                  onClick={() => setUseSmartMode(!useSmartMode)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    useSmartMode ? 'bg-violet-500' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    useSmartMode ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <p className="text-sm text-gray-400">
                {useSmartMode
                  ? 'AI automatically selects the best agents and orchestration strategy'
                  : 'Manually configure agents and task type'}
              </p>
            </div>

            {/* Query Input */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Your Query</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything... Multiple expert agents will collaborate to give you the best answer."
                className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <div className="mt-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">{query.length} characters</span>
                <button
                  onClick={handleSubmit}
                  disabled={!query.trim() || loading}
                  className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Run Smart Query
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Manual Configuration */}
            {!useSmartMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                {/* Task Type */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <label className="block text-sm font-medium text-gray-300 mb-3">Orchestration Mode</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {TASK_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setTaskType(type.id as TaskType)}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          taskType === type.id
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <type.icon className={`w-5 h-5 mb-1 ${taskType === type.id ? 'text-violet-400' : 'text-gray-400'}`} />
                        <div className={`text-sm font-medium ${taskType === type.id ? 'text-white' : 'text-gray-300'}`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{type.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agent Selection */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Expert Agents ({selectedAgents.length} selected)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {EXPERT_AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          selectedAgents.includes(agent.id)
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <agent.icon className={`w-5 h-5 mb-1 ${selectedAgents.includes(agent.id) ? agent.color : 'text-gray-400'}`} />
                        <div className={`text-sm font-medium ${selectedAgents.includes(agent.id) ? 'text-white' : 'text-gray-300'}`}>
                          {agent.name}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{agent.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                >
                  {/* Result Header */}
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">Response Generated</h3>
                        <p className="text-xs text-gray-400">
                          Task: {result.task_type || 'Smart Query'} •
                          Agents: {result.agents_used?.length || result.analysis?.recommended_agents?.length || 0} •
                          Quality: {Math.round((result.quality_score || result.confidence || 0.85) * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.synthesized_response || result.response)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Response */}
                  <div className="p-4">
                    <div className="prose prose-invert max-w-none">
                      <p className="text-gray-200 whitespace-pre-wrap">
                        {result.synthesized_response || result.response}
                      </p>
                    </div>
                  </div>

                  {/* Agent Responses */}
                  {result.agent_responses && result.agent_responses.length > 0 && (
                    <div className="border-t border-gray-800">
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full p-4 flex items-center justify-between text-sm text-gray-400 hover:bg-gray-800/50"
                      >
                        <span>View Individual Agent Responses ({result.agent_responses.length})</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 space-y-3">
                              {result.agent_responses.map((agentResp: any, idx: number) => (
                                <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                                      agentResp.agent === 'researcher' ? 'bg-blue-500/20 text-blue-400' :
                                      agentResp.agent === 'analyst' ? 'bg-green-500/20 text-green-400' :
                                      agentResp.agent === 'writer' ? 'bg-purple-500/20 text-purple-400' :
                                      agentResp.agent === 'critic' ? 'bg-red-500/20 text-red-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      <Brain className="w-3 h-3" />
                                    </div>
                                    <span className="font-medium text-white capitalize">{agentResp.agent}</span>
                                    {agentResp.quality_score && (
                                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                        {Math.round(agentResp.quality_score * 100)}% quality
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-300 line-clamp-4">
                                    {agentResp.response}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Was this helpful?</span>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg">
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* How It Works */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                How Smart Query Works
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">1</span>
                  </div>
                  <p className="text-gray-400">Your query is analyzed to determine the best approach</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">2</span>
                  </div>
                  <p className="text-gray-400">Multiple expert agents work in parallel or sequence</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">3</span>
                  </div>
                  <p className="text-gray-400">Responses are synthesized into a comprehensive answer</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">4</span>
                  </div>
                  <p className="text-gray-400">Quality scoring ensures accuracy and completeness</p>
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3">Best For</h3>
              <div className="space-y-2">
                {[
                  'Research & Analysis',
                  'Content Creation',
                  'Technical Documentation',
                  'Business Strategy',
                  'Fact Checking',
                  'Creative Writing',
                ].map((useCase) => (
                  <div key={useCase} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    {useCase}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setQuery('Research the latest trends in AI and provide a comprehensive analysis')
                    setUseSmartMode(true)
                  }}
                  className="w-full text-left p-2 text-sm text-gray-400 hover:bg-gray-800 rounded-lg"
                >
                  📊 AI Trends Analysis
                </button>
                <button
                  onClick={() => {
                    setQuery('Write a professional blog post about the future of remote work')
                    setUseSmartMode(true)
                  }}
                  className="w-full text-left p-2 text-sm text-gray-400 hover:bg-gray-800 rounded-lg"
                >
                  ✍️ Blog Post Writing
                </button>
                <button
                  onClick={() => {
                    setQuery('Compare and contrast different cloud providers (AWS, GCP, Azure)')
                    setUseSmartMode(false)
                    setTaskType('debate')
                  }}
                  className="w-full text-left p-2 text-sm text-gray-400 hover:bg-gray-800 rounded-lg"
                >
                  ⚖️ Comparison Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
