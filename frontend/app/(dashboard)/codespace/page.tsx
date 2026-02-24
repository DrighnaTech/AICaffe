'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Play, Square, Trash2, Plus, Github, GitBranch, Database,
  Server, Cpu, HardDrive, Clock, Coins, ExternalLink, Settings,
  RefreshCw, Loader2, FolderGit2, Search, Grid, List, MoreVertical,
  Zap, Box, FileCode, Layers, Brain, Terminal, ChevronRight, Star,
  Check, X, Copy, Eye, EyeOff, Plug2, AlertCircle
} from 'lucide-react'
import { ideApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime, formatNumber } from '@/lib/utils'

type ViewMode = 'grid' | 'list'
type Tab = 'projects' | 'databases' | 'templates' | 'github'

interface Project {
  id: string
  name: string
  slug: string
  description?: string
  status: 'creating' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  template_name?: string
  template_icon?: string
  preset_name?: string
  cpu_cores?: number
  memory_mb?: number
  tokens_per_hour?: number
  container_url?: string
  git_repo_url?: string
  tokens_consumed: number
  total_runtime_minutes: number
  last_accessed_at?: string
  created_at: string
}

interface Database {
  id: string
  name: string
  slug: string
  type_name: string
  engine: string
  icon?: string
  status: 'running' | 'stopped' | 'creating' | 'error'
  host?: string
  port?: number
  storage_gb: number
  tokens_consumed: number
}

interface Template {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  category?: string
  tags?: string[]
}

interface ResourcePreset {
  id: string
  name: string
  slug: string
  cpu_cores: number
  memory_mb: number
  storage_gb: number
  tokens_per_hour: number
  gpu_enabled: boolean
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500/20 text-green-400 border-green-500/30',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  stopping: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  creating: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'blank': <Box className="w-5 h-5" />,
  'python': <FileCode className="w-5 h-5" />,
  'nodejs': <Terminal className="w-5 h-5" />,
  'react': <Layers className="w-5 h-5" />,
  'nextjs': <Layers className="w-5 h-5" />,
  'fastapi': <Zap className="w-5 h-5" />,
  'go': <Terminal className="w-5 h-5" />,
  'rust': <Cpu className="w-5 h-5" />,
  'data-science': <Brain className="w-5 h-5" />,
  'ai-ml': <Brain className="w-5 h-5" />,
}

export default function CodespacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('projects')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDatabaseModal, setShowDatabaseModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const queryClient = useQueryClient()

  // Queries
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['ide', 'projects'],
    queryFn: () => ideApi.projects(),
  })

  const { data: databasesData, isLoading: databasesLoading } = useQuery({
    queryKey: ['ide', 'databases'],
    queryFn: () => ideApi.databases(),
  })

  const { data: templatesData } = useQuery({
    queryKey: ['ide', 'templates'],
    queryFn: () => ideApi.templates(),
  })

  const { data: presetsData } = useQuery({
    queryKey: ['ide', 'presets'],
    queryFn: () => ideApi.presets(),
  })

  const { data: dbTypesData } = useQuery({
    queryKey: ['ide', 'databaseTypes'],
    queryFn: () => ideApi.databaseTypes(),
  })

  const { data: gitConnectionsData } = useQuery({
    queryKey: ['ide', 'gitConnections'],
    queryFn: () => ideApi.gitConnections(),
  })

  const { data: usageData } = useQuery({
    queryKey: ['ide', 'usage'],
    queryFn: () => ideApi.usage(),
  })

  // Mutations
  const startProjectMutation = useMutation({
    mutationFn: (id: string) => ideApi.startProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ide', 'projects'] })
    },
  })

  const stopProjectMutation = useMutation({
    mutationFn: (id: string) => ideApi.stopProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ide', 'projects'] })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => ideApi.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ide', 'projects'] })
    },
  })

  const projects: Project[] = projectsData?.data?.projects || []
  const databases: Database[] = databasesData?.data?.databases || []
  const templates: Template[] = templatesData?.data?.templates || []
  const presets: ResourcePreset[] = presetsData?.data?.presets || []
  const dbTypes = dbTypesData?.data?.database_types || []
  const gitConnections = gitConnectionsData?.data?.connections || []
  const usage = usageData?.data || {}

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredDatabases = databases.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Auto-refresh running projects
  useEffect(() => {
    const hasRunning = projects.some(p => ['starting', 'stopping', 'creating'].includes(p.status))
    if (hasRunning) {
      const interval = setInterval(() => refetchProjects(), 3000)
      return () => clearInterval(interval)
    }
  }, [projects, refetchProjects])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Code2 className="w-7 h-7 text-cyan-400" />
            Cloud IDE
          </h1>
          <p className="text-gray-400 mt-1">Your cloud development environments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refetchProjects()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Projects</p>
                <p className="text-2xl font-bold text-white">
                  {projects.filter(p => p.status === 'running').length}
                </p>
              </div>
              <Server className="w-8 h-8 text-violet-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Runtime</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round((usage.totals?.total_minutes || 0) / 60)}h
                </p>
              </div>
              <Clock className="w-8 h-8 text-cyan-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Databases</p>
                <p className="text-2xl font-bold text-white">{databases.length}</p>
              </div>
              <Database className="w-8 h-8 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Tokens Used</p>
                <p className="text-2xl font-bold text-white">
                  {formatNumber(usage.totals?.total_tokens || 0)}
                </p>
              </div>
              <Coins className="w-8 h-8 text-orange-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-lg">
          {[
            { id: 'projects', label: 'Projects', icon: <Code2 className="w-4 h-4" /> },
            { id: 'databases', label: 'Databases', icon: <Database className="w-4 h-4" /> },
            { id: 'templates', label: 'Templates', icon: <Layers className="w-4 h-4" /> },
            { id: 'github', label: 'GitHub', icon: <Github className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'projects' && (
          <motion.div
            key="projects"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Code2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                  <p className="text-gray-400 mb-4">Create your first cloud development environment</p>
                  <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    viewMode={viewMode}
                    onStart={() => startProjectMutation.mutate(project.id)}
                    onStop={() => stopProjectMutation.mutate(project.id)}
                    onDelete={() => deleteProjectMutation.mutate(project.id)}
                    onSelect={() => setSelectedProject(project)}
                    isStarting={startProjectMutation.isPending}
                    isStopping={stopProjectMutation.isPending}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'databases' && (
          <motion.div
            key="databases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Your Databases</h2>
              <Button variant="outline" size="sm" onClick={() => setShowDatabaseModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Database
              </Button>
            </div>

            {databasesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              </div>
            ) : filteredDatabases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No databases yet</h3>
                  <p className="text-gray-400 mb-4">Provision a database for your projects</p>
                  <Button variant="primary" onClick={() => setShowDatabaseModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Database
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDatabases.map((database) => (
                  <DatabaseCard key={database.id} database={database} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => {
                    setShowCreateModal(true)
                    // Pre-select template
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'github' && (
          <motion.div
            key="github"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GitHubSection connections={gitConnections} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          templates={templates}
          presets={presets}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['ide', 'projects'] })
          }}
        />
      )}

      {/* Create Database Modal */}
      {showDatabaseModal && (
        <CreateDatabaseModal
          dbTypes={dbTypes}
          projects={projects}
          onClose={() => setShowDatabaseModal(false)}
          onCreated={() => {
            setShowDatabaseModal(false)
            queryClient.invalidateQueries({ queryKey: ['ide', 'databases'] })
          }}
        />
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ProjectCard({
  project,
  viewMode,
  onStart,
  onStop,
  onDelete,
  onSelect,
  isStarting,
  isStopping,
}: {
  project: Project
  viewMode: ViewMode
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  onSelect: () => void
  isStarting: boolean
  isStopping: boolean
}) {
  const isProcessing = ['starting', 'stopping', 'creating'].includes(project.status)

  if (viewMode === 'list') {
    return (
      <Card className="hover:border-gray-600 transition-colors">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                {TEMPLATE_ICONS[project.template_icon || 'blank'] || <Code2 className="w-5 h-5 text-violet-400" />}
              </div>
              <div>
                <h3 className="font-medium text-white">{project.name}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{project.template_name || 'Custom'}</span>
                  <span>{project.preset_name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className={STATUS_COLORS[project.status]}>
                {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {project.status}
              </Badge>
              <div className="flex items-center gap-2">
                {project.status === 'running' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => window.open(project.container_url, '_blank')}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={onStop} disabled={isStopping}>
                      <Square className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="primary" onClick={onStart} disabled={isStarting || isProcessing}>
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:border-gray-600 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
            {TEMPLATE_ICONS[project.template_icon || 'blank'] || <Code2 className="w-6 h-6 text-violet-400" />}
          </div>
          <Badge variant="outline" className={STATUS_COLORS[project.status]}>
            {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {project.status}
          </Badge>
        </div>

        <h3 className="font-semibold text-white mb-1">{project.name}</h3>
        <p className="text-sm text-gray-400 line-clamp-1 mb-3">
          {project.description || project.template_name || 'No description'}
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            {project.cpu_cores} CPU
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {project.memory_mb ? `${project.memory_mb / 1024}GB` : '-'}
          </span>
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {project.tokens_per_hour}/hr
          </span>
        </div>

        {project.git_repo_url && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <GitBranch className="w-3 h-3" />
            <span className="truncate">{project.git_repo_url.split('/').slice(-2).join('/')}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {project.status === 'running' ? (
            <>
              <Button
                className="flex-1"
                size="sm"
                variant="primary"
                onClick={() => window.open(project.container_url, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open IDE
              </Button>
              <Button size="sm" variant="outline" onClick={onStop} disabled={isStopping}>
                <Square className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                className="flex-1"
                size="sm"
                variant="primary"
                onClick={onStart}
                disabled={isStarting || isProcessing}
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Start
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>{formatRelativeTime(project.last_accessed_at || project.created_at)}</span>
          <span>{Math.round(project.total_runtime_minutes / 60)}h total</span>
        </div>
      </CardContent>
    </Card>
  )
}

function DatabaseCard({ database }: { database: Database }) {
  const [showCredentials, setShowCredentials] = useState(false)

  return (
    <Card className="hover:border-gray-600 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-green-400" />
          </div>
          <Badge variant="outline" className={STATUS_COLORS[database.status]}>
            {database.status}
          </Badge>
        </div>

        <h3 className="font-semibold text-white mb-1">{database.name}</h3>
        <p className="text-sm text-gray-400 mb-3">{database.type_name}</p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Host</span>
            <span className="text-gray-300 font-mono text-xs">{database.host || 'Not assigned'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Port</span>
            <span className="text-gray-300 font-mono text-xs">{database.port || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Storage</span>
            <span className="text-gray-300">{database.storage_gb} GB</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            className="flex-1"
            size="sm"
            variant="outline"
            onClick={() => setShowCredentials(!showCredentials)}
          >
            {showCredentials ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Credentials
          </Button>
          <Button size="sm" variant="outline">
            <Plug2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TemplateCard({ template, onClick }: { template: Template; onClick: () => void }) {
  return (
    <Card
      className="hover:border-violet-500/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
          {TEMPLATE_ICONS[template.slug] || <Code2 className="w-7 h-7 text-violet-400" />}
        </div>
        <h3 className="font-semibold text-white mb-1">{template.name}</h3>
        <p className="text-sm text-gray-400 line-clamp-2">{template.description}</p>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-3">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GitHubSection({ connections }: { connections: any[] }) {
  const queryClient = useQueryClient()
  const githubConnection = connections.find(c => c.provider === 'github')

  const connectGitHub = async () => {
    try {
      const response = await ideApi.getGitAuthUrl('github')
      if (response.data?.auth_url) {
        window.location.href = response.data.auth_url
      }
    } catch (error) {
      console.error('Failed to get GitHub auth URL:', error)
    }
  }

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ['ide', 'repos'],
    queryFn: () => ideApi.gitRepos(),
    enabled: !!githubConnection,
  })

  const repos = reposData?.data?.repositories || []

  if (!githubConnection) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Github className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect GitHub</h3>
          <p className="text-gray-400 mb-4">Import repositories and enable version control</p>
          <Button variant="primary" onClick={connectGitHub}>
            <Github className="w-4 h-4 mr-2" />
            Connect GitHub
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-gray-800/50 to-gray-900/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={githubConnection.provider_avatar_url}
                alt={githubConnection.provider_username}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-medium text-white">{githubConnection.provider_username}</p>
                <p className="text-sm text-gray-400">{githubConnection.provider_email}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              <Check className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold text-white">Your Repositories</h3>

      {reposLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {repos.slice(0, 12).map((repo: any) => (
            <Card key={repo.id} className="hover:border-gray-600 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderGit2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{repo.name}</p>
                      <p className="text-xs text-gray-500 truncate">{repo.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {repo.is_private && (
                      <Badge variant="secondary" className="text-xs">Private</Badge>
                    )}
                    <Button size="sm" variant="ghost">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateProjectModal({
  templates,
  presets,
  onClose,
  onCreated,
}: {
  templates: Template[]
  presets: ResourcePreset[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [selectedPreset, setSelectedPreset] = useState<string>('small')
  const [gitUrl, setGitUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await ideApi.createProject({
        name,
        description,
        template_slug: selectedTemplate,
        resource_preset_slug: selectedPreset,
        git_repo_url: gitUrl || undefined,
      })
      onCreated()
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-gray-900 rounded-xl border border-gray-800 shadow-2xl"
      >
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Create New Project</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded ${s <= step ? 'bg-violet-500' : 'bg-gray-700'}`}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-white mb-4">Choose a template</h3>
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.slug}
                    onClick={() => setSelectedTemplate(template.slug)}
                    className={`p-4 rounded-lg border text-center transition-all ${
                      selectedTemplate === template.slug
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center mx-auto mb-2">
                      {TEMPLATE_ICONS[template.slug] || <Code2 className="w-5 h-5 text-violet-400" />}
                    </div>
                    <p className="text-sm font-medium text-white">{template.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your project"
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Git Repository (optional)</label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-white mb-4">Select Resources</h3>
              <div className="grid grid-cols-2 gap-3">
                {presets.filter(p => !p.gpu_enabled).map((preset) => (
                  <button
                    key={preset.slug}
                    onClick={() => setSelectedPreset(preset.slug)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedPreset === preset.slug
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{preset.name}</span>
                      <Badge variant="outline" className="text-orange-400 border-orange-500/30">
                        {preset.tokens_per_hour} ACT/hr
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {preset.cpu_cores} CPU
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {preset.memory_mb / 1024}GB
                      </span>
                      <span className="flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        {preset.storage_gb}GB
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !name}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isCreating || !name}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function CreateDatabaseModal({
  dbTypes,
  projects,
  onClose,
  onCreated,
}: {
  dbTypes: any[]
  projects: Project[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [storageGb, setStorageGb] = useState(1)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await ideApi.createDatabase({
        name,
        database_type_slug: selectedType,
        project_id: selectedProject || undefined,
        storage_gb: storageGb,
      })
      onCreated()
    } catch (error) {
      console.error('Failed to create database:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-gray-900 rounded-xl border border-gray-800 shadow-2xl"
      >
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Create Database</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Database Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-database"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Database Type</label>
            <div className="grid grid-cols-2 gap-2">
              {dbTypes.map((type: any) => (
                <button
                  key={type.slug}
                  onClick={() => setSelectedType(type.slug)}
                  className={`p-3 rounded-lg border text-left ${
                    selectedType === type.slug
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-white">{type.name}</p>
                  <p className="text-xs text-gray-500">{type.engine} v{type.version}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Link to Project (optional)</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Storage: {storageGb} GB</label>
            <input
              type="range"
              min={1}
              max={50}
              value={storageGb}
              onChange={(e) => setStorageGb(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isCreating || !name || !selectedType}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Create Database
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
