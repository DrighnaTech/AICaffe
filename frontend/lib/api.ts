import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aicaffe_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth ────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/me', data),
}

// ── Models ──────────────────────────────────────────────────────

export const modelsApi = {
  list: (params?: Record<string, any>) => api.get('/models', { params }),
  get: (id: string) => api.get(`/models/${id}`),
  compare: (modelIds: string[]) => api.post('/models/compare', { model_ids: modelIds }),
  leaderboard: (params?: Record<string, any>) => api.get('/models/leaderboard', { params }),
  reviews: (modelId: string, params?: any) => api.get(`/models/${modelId}/reviews`, { params }),
  submitReview: (modelId: string, data: any) => api.post(`/models/${modelId}/reviews`, data),
}

// ── Providers ───────────────────────────────────────────────────

export const providersApi = {
  list: (params?: any) => api.get('/providers', { params }),
  get: (slug: string) => api.get(`/providers/${slug}`),
}

// ── Tokens ──────────────────────────────────────────────────────

export const tokensApi = {
  wallet: () => api.get('/tokens/wallet', { params: { user_id: 'current' } }),
  packages: () => api.get('/tokens/packages'),
  purchase: (data: any) => api.post('/tokens/purchase', data),
  calculate: (data: any) => api.post('/tokens/calculate', data),
  compareCosts: (data: any) => api.post('/tokens/compare-costs', data),
  transactions: (params?: any) => api.get('/tokens/transactions', { params }),
}

// ── Recommendations ─────────────────────────────────────────────

export const recommendApi = {
  useCases: () => api.get('/recommendations/use-cases'),
  recommend: (data: any) => api.post('/recommendations/recommend', data),
  quick: (data: { purpose: string; priority?: string }) =>
    api.post('/recommendations/quick', data),
}

// ── News ────────────────────────────────────────────────────────

export const newsApi = {
  feed: (params?: any) => api.get('/news/feed', { params }),
  trending: () => api.get('/news/trending'),
  breaking: () => api.get('/news/breaking'),
  article: (id: string) => api.get(`/news/${id}`),
  bookmark: (id: string) => api.post(`/news/${id}/bookmark`),
  digest: () => api.get('/news/daily-digest'),
}

// ── Assistant ───────────────────────────────────────────────────

export const assistantApi = {
  conversations: (params?: any) => api.get('/assistant/conversations', { params }),
  getConversation: (id: string) => api.get(`/assistant/conversations/${id}`),
  createConversation: (data: any) => api.post('/assistant/conversations', data),
  deleteConversation: (id: string) => api.delete(`/assistant/conversations/${id}`),
  switchModel: (conversationId: string, modelId: string) =>
    api.put(`/assistant/conversations/${conversationId}/model`, null, { params: { model_id: modelId } }),
  chat: (data: any) => api.post('/chat/completions', data),
}

// ── Billing ─────────────────────────────────────────────────────

export const billingApi = {
  usage: (params?: any) => api.get('/billing/usage', { params }),
  invoices: (params?: any) => api.get('/billing/invoices', { params }),
  checkout: (data: any) => api.post('/billing/checkout', data),
  subscriptionCheckout: (data: { plan: string; billing_cycle?: string }) =>
    api.post('/billing/checkout/subscription', data),
  verifyPayment: (sessionId: string) => api.get(`/billing/verify/${sessionId}`),
  customerPortal: (data?: { return_url?: string }) => api.post('/billing/portal', data || {}),
  plans: () => api.get('/billing/plans'),
}

// ── Workspaces ─────────────────────────────────────────────────────

export const workspaceApi = {
  list: () => api.get('/workspaces/'),
  get: (id: string) => api.get(`/workspaces/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/workspaces/', data),
  update: (id: string, data: any) => api.put(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
  // Projects
  projects: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/projects`),
  createProject: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/projects`, data),
}

// ── AI Tasks ────────────────────────────────────────────────────────

export type TaskCategory = 'content' | 'research' | 'design' | 'development' | 'audio' | 'video' | 'data' | 'translation' | 'assistant' | 'agent'

export const tasksApi = {
  list: (params?: { category?: TaskCategory; workspace_id?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/tasks/', { params }),
  get: (id: string) => api.get(`/tasks/${id}`),
  create: (data: {
    title: string;
    category: TaskCategory;
    prompt: string;
    subcategory?: string;
    workspace_id?: string;
    project_id?: string;
    model_override?: string;
  }) => api.post('/tasks/', data),
  execute: (data: { prompt: string; category: TaskCategory; subcategory?: string; model_override?: string }) =>
    api.post('/tasks/execute', data),
  rate: (id: string, rating: number, feedback?: string) =>
    api.post(`/tasks/${id}/rate`, null, { params: { rating, feedback } }),
}

// ── Templates ───────────────────────────────────────────────────────

export const templatesApi = {
  list: (category?: TaskCategory) => api.get('/templates/', { params: { category } }),
  get: (id: string) => api.get(`/templates/${id}`),
}

// ── AI Routing ──────────────────────────────────────────────────────

export const routingApi = {
  rules: () => api.get('/routing/'),
  recommend: (category: TaskCategory, subcategory?: string) =>
    api.get('/routing/recommend', { params: { category, subcategory } }),
}

// ── Custom Agents ───────────────────────────────────────────────────

export const agentsApi = {
  list: (includePublic?: boolean) => api.get('/agents/', { params: { include_public: includePublic } }),
  get: (id: string) => api.get(`/agents/${id}`),
  create: (data: {
    name: string;
    description?: string;
    agent_type?: string;
    system_prompt: string;
    primary_model?: string;
    capabilities?: string[];
    tools?: string[];
    is_public?: boolean;
  }) => api.post('/agents/', data),
  update: (id: string, data: any) => api.put(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  // Conversations
  conversations: (agentId: string) => api.get(`/agents/${agentId}/conversations`),
  createConversation: (agentId: string) => api.post(`/agents/${agentId}/conversations`, {}),
}

// ── Agent Tools ─────────────────────────────────────────────────────

export const agentToolsApi = {
  list: (category?: string) => api.get('/agent-tools/', { params: { category } }),
}

// ── Agent Conversations ─────────────────────────────────────────────

export const conversationsApi = {
  get: (id: string) => api.get(`/conversations/${id}`),
  sendMessage: (id: string, content: string, attachments?: any[]) =>
    api.post(`/conversations/${id}/messages`, { content, attachments }),
}

// ── Orchestrator (Meta-Agent) ──────────────────────────────────────

export type TaskType = 'simple' | 'parallel' | 'sequential' | 'debate' | 'consensus' | 'expert_panel'
export type AgentRole = 'researcher' | 'analyst' | 'writer' | 'critic' | 'synthesizer' | 'fact_checker' | 'creative' | 'technical'

export const orchestratorApi = {
  // Main orchestration - coordinate multiple agents
  orchestrate: (data: {
    query: string;
    task_type?: TaskType;
    agents?: AgentRole[];
    context?: Record<string, any>;
    max_iterations?: number;
    quality_threshold?: number;
  }) => api.post('/orchestrate', data),

  // Smart query - auto-determines best approach
  smartQuery: (data: {
    query: string;
    context?: Record<string, any>;
    prefer_speed?: boolean;
    prefer_quality?: boolean;
  }) => api.post('/smart-query', data),

  // Custom multi-agent workflows
  workflow: (data: {
    name: string;
    steps: Array<{
      agent: AgentRole;
      task: string;
      depends_on?: string[];
    }>;
    context?: Record<string, any>;
  }) => api.post('/workflow', data),

  // List available expert agents
  expertAgents: () => api.get('/expert-agents'),

  // Compare responses from multiple agents
  compareAgents: (data: {
    query: string;
    agents: AgentRole[];
  }) => api.post('/compare-agents', data),

  // Fact-check content
  factCheck: (data: {
    content: string;
    sources?: string[];
  }) => api.post('/fact-check', data),

  // Improve content using expert agents
  improveContent: (data: {
    content: string;
    improvement_type: 'clarity' | 'accuracy' | 'engagement' | 'seo' | 'technical' | 'creative';
    context?: string;
  }) => api.post('/improve-content', data),
}

// ── Cloud IDE (Codespace) ──────────────────────────────────────────

export const ideApi = {
  // Templates & Presets (public)
  templates: () => api.get('/ide/templates'),
  presets: () => api.get('/ide/presets'),
  databaseTypes: () => api.get('/ide/database-types'),

  // Projects (authenticated)
  projects: () => api.get('/ide/projects'),
  getProject: (id: string) => api.get(`/ide/projects/${id}`),
  createProject: (data: {
    name: string;
    description?: string;
    template_id?: string;
    preset_id?: string;
    git_repo_url?: string;
  }) => api.post('/ide/projects', data),
  updateProject: (id: string, data: any) => api.put(`/ide/projects/${id}`, data),
  deleteProject: (id: string) => api.delete(`/ide/projects/${id}`),
  startProject: (id: string) => api.post(`/ide/projects/${id}/start`),
  stopProject: (id: string) => api.post(`/ide/projects/${id}/stop`),

  // Databases (authenticated)
  databases: () => api.get('/ide/databases'),
  getDatabase: (id: string) => api.get(`/ide/databases/${id}`),
  createDatabase: (data: {
    name: string;
    db_type_id: string;
    project_id?: string;
    storage_gb?: number;
  }) => api.post('/ide/databases', data),
  deleteDatabase: (id: string) => api.delete(`/ide/databases/${id}`),
  startDatabase: (id: string) => api.post(`/ide/databases/${id}/start`),
  stopDatabase: (id: string) => api.post(`/ide/databases/${id}/stop`),
  getDatabaseCredentials: (id: string) => api.get(`/ide/databases/${id}/credentials`),

  // Git Integration (authenticated)
  gitConnections: () => api.get('/ide/git/connections'),
  getGitAuthUrl: (provider: string) => api.get(`/ide/git/auth-url?provider=${provider}`),
  connectGit: (data: { provider: string; code: string; state?: string }) =>
    api.post('/ide/git/connect', data),
  disconnectGit: (connectionId: string) => api.delete(`/ide/git/connections/${connectionId}`),
  gitRepos: () => api.get('/ide/git/repos'),
  cloneRepo: (projectId: string, repoUrl: string) =>
    api.post(`/ide/projects/${projectId}/clone`, { repo_url: repoUrl }),

  // Extensions
  extensions: () => api.get('/ide/extensions'),
  userExtensions: () => api.get('/ide/extensions/user'),
  installExtension: (extensionId: string) => api.post(`/ide/extensions/${extensionId}/install`),
  uninstallExtension: (extensionId: string) => api.delete(`/ide/extensions/${extensionId}/install`),

  // Usage & Billing
  usage: () => api.get('/ide/usage'),
}
