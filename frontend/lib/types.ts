// ============================================================================
// AICaffe Platform - TypeScript Type Definitions
// ============================================================================

// ── User & Authentication ──────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'admin' | 'org_admin' | 'user' | 'developer'
  organization_id?: string
  organization_name?: string
  is_active: boolean
  is_verified: boolean
  preferences: UserPreferences
  created_at: string
  last_login_at?: string
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  notifications: boolean
  default_model?: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at?: string
  expires_at?: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// ── AI Models & Providers ──────────────────────────────────────────────────

export interface AIProvider {
  id: string
  name: string
  slug: string
  logo_url?: string
  website?: string
  description?: string
  headquarters?: string
  founded_year?: number
  status: 'active' | 'beta' | 'deprecated' | 'inactive'
  model_count?: number
}

export interface AIModel {
  id: string
  provider_id: string
  provider_name?: string
  provider_slug?: string
  name: string
  slug: string
  version?: string
  model_identifier: string
  description?: string
  short_description?: string
  logo_url?: string
  model_type: ModelType
  capabilities: ModelCapabilities
  context_window?: number
  max_output_tokens?: number
  training_cutoff?: string
  parameters_count?: string
  input_price_per_million?: number
  output_price_per_million?: number
  image_price_per_unit?: number
  audio_price_per_minute?: number
  video_price_per_second?: number
  is_available: boolean
  is_featured: boolean
  is_open_source: boolean
  license_type?: string
  avg_rating: number
  total_ratings: number
  total_api_calls: number
  avg_latency_ms?: number
  avg_tokens_per_second?: number
  uptime_percentage: number
  benchmarks: ModelBenchmarks
  status: 'active' | 'beta' | 'deprecated' | 'inactive'
  released_at?: string
  features?: ModelFeature[]
  pricing_tiers?: ModelPricingTier[]
}

export type ModelType =
  | 'llm'
  | 'image_generation'
  | 'image_editing'
  | 'video_generation'
  | 'audio_generation'
  | 'audio_transcription'
  | 'text_to_speech'
  | 'code_generation'
  | 'embedding'
  | 'multimodal'
  | 'agent'
  | 'search'
  | 'translation'
  | 'summarization'
  | 'classification'

export interface ModelCapabilities {
  text?: boolean
  vision?: boolean
  audio?: boolean
  video?: boolean
  function_calling?: boolean
  streaming?: boolean
  json_mode?: boolean
  reasoning?: boolean
  computer_use?: boolean
  multilingual?: boolean
  code?: boolean
  rag?: boolean
  search?: boolean
  citations?: boolean
}

export interface ModelBenchmarks {
  mmlu?: number
  humaneval?: number
  gsm8k?: number
  gpqa?: number
  math?: number
  hellaswag?: number
  mteb?: number
  aime?: number
  mbpp?: number
  mmmu?: number
}

export interface ModelFeature {
  id: string
  feature_name: string
  feature_category: string
  feature_value?: string
  is_supported: boolean
  notes?: string
}

export interface ModelPricingTier {
  id: string
  tier_name: string
  input_price_per_million?: number
  output_price_per_million?: number
  cached_input_price?: number
  rate_limit_rpm?: number
  rate_limit_tpm?: number
  rate_limit_rpd?: number
  min_spend?: number
  notes?: string
  effective_from: string
  effective_until?: string
}

export interface ModelReview {
  id: string
  user_id: string
  user_name: string
  user_avatar?: string
  rating: number
  title?: string
  review_text?: string
  use_case?: string
  pros: string[]
  cons: string[]
  is_verified: boolean
  helpful_count: number
  created_at: string
}

export interface ModelComparison {
  models: AIModel[]
  metrics: ComparisonMetric[]
}

export interface ComparisonMetric {
  name: string
  values: (string | number | null)[]
  unit?: string
  higher_is_better?: boolean
}

// ── Token System ───────────────────────────────────────────────────────────

export interface TokenWallet {
  id: string
  balance: number
  balance_usd: number
  total_purchased: number
  total_consumed: number
  total_refunded: number
  currency: string
}

export interface TokenPackage {
  id: string
  name: string
  description?: string
  token_amount: number
  price_usd: number
  bonus_percentage: number
  total_tokens: number
  is_active: boolean
  is_featured: boolean
  valid_days: number
}

export interface TokenTransaction {
  id: string
  transaction_type: 'purchase' | 'consumption' | 'refund' | 'bonus' | 'transfer' | 'expiry'
  token_amount: number
  balance_before: number
  balance_after: number
  model_name?: string
  provider_cost_usd?: number
  margin_usd?: number
  description?: string
  created_at: string
}

export interface TokenCostEstimate {
  model_id: string
  model_name: string
  input_tokens: number
  output_tokens: number
  aicaffe_tokens: number
  provider_cost_usd: number
  margin_usd: number
  total_cost_usd: number
}

// ── Recommendations ────────────────────────────────────────────────────────

export interface UseCaseCategory {
  id: string
  name: string
  slug: string
  icon?: string
  description?: string
  use_cases: UseCase[]
}

export interface UseCase {
  id: string
  category_id: string
  name: string
  slug: string
  description?: string
  typical_input_types: string[]
  typical_output_types: string[]
  complexity_level: 'basic' | 'medium' | 'advanced' | 'expert'
  example_prompts?: string[]
}

export interface Recommendation {
  model: AIModel
  score: number
  relevance_score: number
  quality_score: number
  speed_score: number
  cost_efficiency_score: number
  estimated_cost_per_1k: number
  reasons: string[]
}

export interface RecommendationRequest {
  use_case_id?: string
  input_description?: string
  input_modalities?: string[]
  output_modalities?: string[]
  budget_constraint?: number
  priority?: 'speed' | 'quality' | 'cost' | 'balanced'
  context_window_needed?: number
  prefer_open_source?: boolean
}

// ── Conversations & Chat ───────────────────────────────────────────────────

export interface Conversation {
  id: string
  title?: string
  model_id?: string
  model_name?: string
  use_case_id?: string
  system_prompt?: string
  settings: ConversationSettings
  is_archived: boolean
  is_pinned: boolean
  total_messages: number
  total_tokens_used: number
  last_message_at?: string
  created_at: string
}

export interface ConversationSettings {
  temperature: number
  max_tokens: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  model_id?: string
  model_name?: string
  input_tokens?: number
  output_tokens?: number
  aicaffe_tokens_charged?: number
  attachments?: Attachment[]
  tool_calls?: ToolCall[]
  tool_results?: ToolResult[]
  rating?: number
  feedback_text?: string
  latency_ms?: number
  created_at: string
}

export interface Attachment {
  type: 'image' | 'file' | 'audio'
  url: string
  name: string
  size?: number
  mime_type?: string
}

export interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  tool_call_id: string
  output: string
}

export interface ChatCompletionRequest {
  model_id: string
  messages: { role: string; content: string }[]
  conversation_id?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  message: {
    role: string
    content: string
  }
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  aicaffe_tokens_charged: number
  latency_ms: number
}

// ── News ───────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string
  source_name: string
  source_logo?: string
  title: string
  slug: string
  summary?: string
  content?: string
  original_url: string
  author?: string
  image_url?: string
  categories: string[]
  tags: string[]
  mentioned_providers: string[]
  mentioned_models: string[]
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
  view_count: number
  share_count: number
  bookmark_count: number
  is_featured: boolean
  is_breaking: boolean
  is_bookmarked?: boolean
  published_at: string
  created_at: string
}

export interface NewsSource {
  id: string
  name: string
  slug: string
  website_url: string
  category?: string
  reliability_score: number
  is_active: boolean
}

// ── Billing & Invoices ─────────────────────────────────────────────────────

export interface UsageSummary {
  period_start: string
  period_end: string
  total_api_calls: number
  total_tokens_used: number
  total_aicaffe_tokens: number
  total_cost_usd: number
  by_model: ModelUsage[]
  by_day: DailyUsage[]
}

export interface ModelUsage {
  model_id: string
  model_name: string
  provider_name: string
  api_calls: number
  input_tokens: number
  output_tokens: number
  aicaffe_tokens: number
  cost_usd: number
}

export interface DailyUsage {
  date: string
  api_calls: number
  tokens: number
  cost_usd: number
}

export interface Invoice {
  id: string
  invoice_number: string
  period_start: string
  period_end: string
  subtotal_usd: number
  tax_usd: number
  total_usd: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  line_items: InvoiceLineItem[]
  payment_url?: string
  due_date?: string
  paid_at?: string
  created_at: string
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

// ── Admin ──────────────────────────────────────────────────────────────────

export interface PlatformMetrics {
  date: string
  total_users: number
  active_users: number
  new_signups: number
  total_api_calls: number
  total_revenue_usd: number
  total_provider_costs_usd: number
  gross_margin_usd: number
  top_models: { model_id: string; name: string; calls: number }[]
  top_use_cases: { use_case_id: string; name: string; calls: number }[]
}

export interface VendorSettlement {
  id: string
  provider_id: string
  provider_name: string
  period_start: string
  period_end: string
  total_api_calls: number
  total_provider_cost_usd: number
  total_revenue_usd: number
  margin_usd: number
  margin_percentage: number
  amount_due_to_provider: number
  status: 'pending' | 'calculated' | 'approved' | 'paid' | 'disputed'
  payment_reference?: string
  paid_at?: string
  created_at: string
}

// ── API Response Types ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  detail: string
  status_code?: number
  errors?: Record<string, string[]>
}
