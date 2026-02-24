-- ============================================================================
-- AICaffe Platform - Complete PostgreSQL Database Schema
-- Version: 1.0.0
-- Description: Comprehensive AI Marketplace & Intelligence Platform
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. CORE USER & ORGANIZATION TABLES
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    website VARCHAR(500),
    plan_type VARCHAR(50) DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise')),
    billing_email VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'org_admin', 'user', 'developer')),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google', 'github', 'microsoft')),
    auth_provider_id VARCHAR(255),
    preferences JSONB DEFAULT '{"theme": "dark", "notifications": true, "default_model": null}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    scopes JSONB DEFAULT '["read"]',
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. AI PROVIDER & MODEL REGISTRY
-- ============================================================================

CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    logo_url TEXT,
    website VARCHAR(500),
    description TEXT,
    headquarters VARCHAR(255),
    founded_year INTEGER,
    api_base_url VARCHAR(500),
    auth_type VARCHAR(50) DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'bearer', 'custom')),
    documentation_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'inactive')),
    supported_regions TEXT[] DEFAULT '{}',
    compliance_certifications TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    model_identifier VARCHAR(500) NOT NULL,  -- actual API model name e.g. "gpt-4o"
    description TEXT,
    short_description VARCHAR(500),
    logo_url TEXT,

    -- Classification
    model_type VARCHAR(100) NOT NULL CHECK (model_type IN (
        'llm', 'image_generation', 'image_editing', 'video_generation',
        'audio_generation', 'audio_transcription', 'text_to_speech',
        'code_generation', 'embedding', 'multimodal', 'agent',
        'search', 'translation', 'summarization', 'classification'
    )),

    -- Capabilities
    capabilities JSONB DEFAULT '{}',
    -- e.g. {"text": true, "vision": true, "function_calling": true, "streaming": true}

    -- Technical specs
    context_window INTEGER,
    max_output_tokens INTEGER,
    training_cutoff DATE,
    parameters_count VARCHAR(50),  -- e.g. "175B", "70B"
    architecture VARCHAR(255),

    -- Performance benchmarks
    benchmarks JSONB DEFAULT '{}',
    -- e.g. {"mmlu": 86.5, "humaneval": 92.1, "gsm8k": 95.0, "hellaswag": 91.2}

    -- Pricing (per 1M tokens in USD)
    input_price_per_million DECIMAL(10, 4),
    output_price_per_million DECIMAL(10, 4),
    image_price_per_unit DECIMAL(10, 4),
    audio_price_per_minute DECIMAL(10, 4),
    video_price_per_second DECIMAL(10, 4),

    -- Availability
    is_available BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_open_source BOOLEAN DEFAULT FALSE,
    license_type VARCHAR(100),

    -- Ratings
    avg_rating DECIMAL(3, 2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    total_api_calls BIGINT DEFAULT 0,

    -- Speed metrics
    avg_latency_ms INTEGER,
    avg_tokens_per_second INTEGER,
    uptime_percentage DECIMAL(5, 2) DEFAULT 99.9,

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'inactive')),
    released_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(provider_id, model_identifier)
);

CREATE TABLE model_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    feature_name VARCHAR(255) NOT NULL,
    feature_category VARCHAR(100) NOT NULL CHECK (feature_category IN (
        'input_modality', 'output_modality', 'capability',
        'integration', 'safety', 'performance', 'language_support'
    )),
    feature_value TEXT,
    is_supported BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE model_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    tier_name VARCHAR(100) NOT NULL,  -- 'free', 'standard', 'batch', 'realtime'
    input_price_per_million DECIMAL(10, 6),
    output_price_per_million DECIMAL(10, 6),
    cached_input_price DECIMAL(10, 6),
    rate_limit_rpm INTEGER,
    rate_limit_tpm INTEGER,
    rate_limit_rpd INTEGER,
    min_spend DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE model_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_a_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    model_b_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    comparison_type VARCHAR(100) NOT NULL,  -- 'benchmark', 'price', 'speed', 'quality'
    comparison_data JSONB NOT NULL,
    generated_by VARCHAR(50) DEFAULT 'system',  -- 'system', 'user', 'community'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. USE CASES & RECOMMENDATION ENGINE
-- ============================================================================

CREATE TABLE use_case_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    icon VARCHAR(100),
    description TEXT,
    parent_id UUID REFERENCES use_case_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE use_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES use_case_categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    typical_input_types TEXT[] DEFAULT '{}',  -- ['text', 'image', 'audio', 'video', 'code']
    typical_output_types TEXT[] DEFAULT '{}',
    complexity_level VARCHAR(50) DEFAULT 'medium' CHECK (complexity_level IN ('basic', 'medium', 'advanced', 'expert')),
    example_prompts JSONB DEFAULT '[]',
    requirements JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE model_use_case_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    use_case_id UUID NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
    relevance_score DECIMAL(5, 2) NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
    quality_score DECIMAL(5, 2) CHECK (quality_score BETWEEN 0 AND 100),
    speed_score DECIMAL(5, 2) CHECK (speed_score BETWEEN 0 AND 100),
    cost_efficiency_score DECIMAL(5, 2) CHECK (cost_efficiency_score BETWEEN 0 AND 100),
    overall_recommendation_score DECIMAL(5, 2) GENERATED ALWAYS AS (
        (relevance_score * 0.35 + COALESCE(quality_score, 0) * 0.30 +
         COALESCE(speed_score, 0) * 0.15 + COALESCE(cost_efficiency_score, 0) * 0.20)
    ) STORED,
    is_recommended BOOLEAN DEFAULT FALSE,
    notes TEXT,
    last_evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, use_case_id)
);

CREATE TABLE recommendations_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id UUID,
    use_case_id UUID REFERENCES use_cases(id),
    input_description TEXT,
    input_modalities TEXT[],
    output_modalities TEXT[],
    budget_constraint DECIMAL(10, 2),
    speed_priority VARCHAR(20) DEFAULT 'balanced',
    recommended_models JSONB NOT NULL,
    selected_model_id UUID REFERENCES ai_models(id),
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. UNIVERSAL TOKEN SYSTEM
-- ============================================================================

CREATE TABLE aicaffe_token_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    token_amount BIGINT NOT NULL,
    price_usd DECIMAL(10, 2) NOT NULL,
    bonus_percentage DECIMAL(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    valid_days INTEGER DEFAULT 365,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    balance BIGINT DEFAULT 0 CHECK (balance >= 0),
    total_purchased BIGINT DEFAULT 0,
    total_consumed BIGINT DEFAULT 0,
    total_refunded BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'ACT',  -- AICaffe Token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT wallet_owner CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR
        (user_id IS NULL AND organization_id IS NOT NULL)
    )
);

CREATE TABLE token_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES token_wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    package_id UUID REFERENCES aicaffe_token_packages(id),
    token_amount BIGINT NOT NULL,
    amount_paid_usd DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),  -- 'stripe', 'razorpay', 'paypal'
    payment_reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL CHECK (token_type IN ('input', 'output', 'image', 'audio_minute', 'video_second')),
    aicaffe_tokens_per_unit DECIMAL(12, 6) NOT NULL,
    provider_cost_per_unit DECIMAL(12, 8) NOT NULL,
    margin_percentage DECIMAL(5, 2) DEFAULT 20.00,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES token_wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'purchase', 'consumption', 'refund', 'bonus', 'transfer', 'expiry'
    )),
    token_amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,

    -- For consumption transactions
    model_id UUID REFERENCES ai_models(id),
    api_call_id UUID,
    provider_tokens_used JSONB,  -- {"input_tokens": 1500, "output_tokens": 500}
    provider_cost_usd DECIMAL(10, 6),
    margin_usd DECIMAL(10, 6),

    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. AI PROXY / UNIFIED API CALLS
-- ============================================================================

CREATE TABLE api_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    api_key_id UUID REFERENCES api_keys(id),

    -- Request details
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'chat', 'completion', 'embedding', 'image_generation',
        'audio_transcription', 'text_to_speech', 'video_generation',
        'code_generation', 'search', 'agent'
    )),
    request_payload JSONB,
    request_tokens INTEGER,

    -- Response details
    response_tokens INTEGER,
    total_tokens INTEGER,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,

    -- Cost tracking
    aicaffe_tokens_charged BIGINT,
    provider_cost_usd DECIMAL(10, 6),
    margin_usd DECIMAL(10, 6),

    -- Streaming
    is_streaming BOOLEAN DEFAULT FALSE,

    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 6. AI ASSISTANT / CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    model_id UUID REFERENCES ai_models(id),
    use_case_id UUID REFERENCES use_cases(id),
    system_prompt TEXT,
    settings JSONB DEFAULT '{"temperature": 0.7, "max_tokens": 4096}',
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    total_messages INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    model_id UUID REFERENCES ai_models(id),

    -- Token usage
    input_tokens INTEGER,
    output_tokens INTEGER,
    aicaffe_tokens_charged BIGINT,

    -- Attachments
    attachments JSONB DEFAULT '[]',
    -- [{"type": "image", "url": "...", "name": "..."}]

    -- Tool calls
    tool_calls JSONB DEFAULT '[]',
    tool_results JSONB DEFAULT '[]',

    -- Feedback
    rating INTEGER CHECK (rating BETWEEN -1 AND 1),
    feedback_text TEXT,

    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. NEWS AGGREGATION & CONTENT
-- ============================================================================

CREATE TABLE news_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    website_url VARCHAR(500) NOT NULL,
    feed_url VARCHAR(500),
    scrape_selector JSONB,
    source_type VARCHAR(50) CHECK (source_type IN ('rss', 'api', 'scrape', 'manual')),
    category VARCHAR(100),
    reliability_score DECIMAL(3, 2) DEFAULT 0.80,
    is_active BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMPTZ,
    scrape_interval_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES news_sources(id),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT,
    original_url VARCHAR(1000) NOT NULL,
    author VARCHAR(255),
    image_url TEXT,

    -- Classification
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    mentioned_providers UUID[] DEFAULT '{}',
    mentioned_models UUID[] DEFAULT '{}',
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),

    -- Engagement
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,

    is_featured BOOLEAN DEFAULT FALSE,
    is_breaking BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, article_id)
);

-- ============================================================================
-- 8. REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE model_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    review_text TEXT,
    use_case_id UUID REFERENCES use_cases(id),
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden', 'flagged')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, model_id)
);

-- ============================================================================
-- 9. PROVIDER API CREDENTIALS (encrypted)
-- ============================================================================

CREATE TABLE provider_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES ai_providers(id),
    encrypted_api_key TEXT NOT NULL,
    key_name VARCHAR(255) DEFAULT 'default',
    is_active BOOLEAN DEFAULT TRUE,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. BILLING & VENDOR SETTLEMENTS
-- ============================================================================

CREATE TABLE vendor_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES ai_providers(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_api_calls BIGINT DEFAULT 0,
    total_provider_cost_usd DECIMAL(12, 4) DEFAULT 0,
    total_revenue_usd DECIMAL(12, 4) DEFAULT 0,
    margin_usd DECIMAL(12, 4) DEFAULT 0,
    margin_percentage DECIMAL(5, 2) DEFAULT 20.00,
    amount_due_to_provider DECIMAL(12, 4) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'approved', 'paid', 'disputed')),
    payment_reference VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    subtotal_usd DECIMAL(10, 2) NOT NULL,
    tax_usd DECIMAL(10, 2) DEFAULT 0,
    total_usd DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    line_items JSONB DEFAULT '[]',
    payment_url VARCHAR(500),
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. ANALYTICS & USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    model_id UUID REFERENCES ai_models(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    api_calls_count INTEGER DEFAULT 0,
    input_tokens_total BIGINT DEFAULT 0,
    output_tokens_total BIGINT DEFAULT 0,
    aicaffe_tokens_spent BIGINT DEFAULT 0,
    cost_usd DECIMAL(10, 4) DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, model_id, date)
);

CREATE TABLE platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_signups INTEGER DEFAULT 0,
    total_api_calls BIGINT DEFAULT 0,
    total_revenue_usd DECIMAL(12, 2) DEFAULT 0,
    total_provider_costs_usd DECIMAL(12, 2) DEFAULT 0,
    gross_margin_usd DECIMAL(12, 2) DEFAULT 0,
    top_models JSONB DEFAULT '[]',
    top_use_cases JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users & Auth
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- Models
CREATE INDEX idx_models_provider ON ai_models(provider_id);
CREATE INDEX idx_models_type ON ai_models(model_type);
CREATE INDEX idx_models_slug ON ai_models(slug);
CREATE INDEX idx_models_featured ON ai_models(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_model_features_model ON model_features(model_id);
CREATE INDEX idx_model_pricing_model ON model_pricing_tiers(model_id);

-- Use cases & Recommendations
CREATE INDEX idx_use_cases_category ON use_cases(category_id);
CREATE INDEX idx_model_scores_model ON model_use_case_scores(model_id);
CREATE INDEX idx_model_scores_usecase ON model_use_case_scores(use_case_id);
CREATE INDEX idx_model_scores_recommended ON model_use_case_scores(is_recommended) WHERE is_recommended = TRUE;

-- Tokens & Transactions
CREATE INDEX idx_wallets_user ON token_wallets(user_id);
CREATE INDEX idx_wallets_org ON token_wallets(organization_id);
CREATE INDEX idx_transactions_wallet ON token_transactions(wallet_id);
CREATE INDEX idx_transactions_created ON token_transactions(created_at);
CREATE INDEX idx_exchange_rates_model ON token_exchange_rates(model_id);

-- API Calls
CREATE INDEX idx_api_calls_user ON api_calls(user_id);
CREATE INDEX idx_api_calls_model ON api_calls(model_id);
CREATE INDEX idx_api_calls_created ON api_calls(created_at);

-- Conversations
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- News
CREATE INDEX idx_articles_source ON news_articles(source_id);
CREATE INDEX idx_articles_published ON news_articles(published_at DESC);
CREATE INDEX idx_articles_tags ON news_articles USING GIN(tags);
CREATE INDEX idx_articles_search ON news_articles USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, '')));

-- Analytics
CREATE INDEX idx_usage_user_date ON usage_analytics(user_id, date);
CREATE INDEX idx_usage_model_date ON usage_analytics(model_id, date);

-- ============================================================================
-- SEED DATA: AI PROVIDERS
-- ============================================================================

INSERT INTO ai_providers (name, slug, website, description, headquarters, founded_year, api_base_url, documentation_url) VALUES
('OpenAI', 'openai', 'https://openai.com', 'Creator of GPT-4, DALL-E, Whisper, and Sora', 'San Francisco, CA', 2015, 'https://api.openai.com/v1', 'https://platform.openai.com/docs'),
('Anthropic', 'anthropic', 'https://anthropic.com', 'Creator of Claude, focused on AI safety', 'San Francisco, CA', 2021, 'https://api.anthropic.com/v1', 'https://docs.anthropic.com'),
('Google DeepMind', 'google', 'https://deepmind.google', 'Creator of Gemini, PaLM, and Imagen', 'Mountain View, CA', 2010, 'https://generativelanguage.googleapis.com/v1beta', 'https://ai.google.dev/docs'),
('Meta AI', 'meta', 'https://ai.meta.com', 'Creator of LLaMA, open-source AI research', 'Menlo Park, CA', 2013, 'https://api.together.xyz/v1', 'https://ai.meta.com/llama'),
('Mistral AI', 'mistral', 'https://mistral.ai', 'European AI lab creating efficient open models', 'Paris, France', 2023, 'https://api.mistral.ai/v1', 'https://docs.mistral.ai'),
('Cohere', 'cohere', 'https://cohere.com', 'Enterprise NLP and RAG solutions', 'Toronto, Canada', 2019, 'https://api.cohere.ai/v1', 'https://docs.cohere.com'),
('Stability AI', 'stability', 'https://stability.ai', 'Creator of Stable Diffusion image generation', 'London, UK', 2019, 'https://api.stability.ai/v1', 'https://platform.stability.ai/docs'),
('Hugging Face', 'huggingface', 'https://huggingface.co', 'Open-source ML platform and model hub', 'New York, NY', 2016, 'https://api-inference.huggingface.co', 'https://huggingface.co/docs'),
('Amazon Bedrock', 'aws-bedrock', 'https://aws.amazon.com/bedrock', 'Managed service for foundation models', 'Seattle, WA', 2023, 'https://bedrock-runtime.amazonaws.com', 'https://docs.aws.amazon.com/bedrock'),
('Azure AI', 'azure-ai', 'https://azure.microsoft.com/ai', 'Microsoft Azure AI services and OpenAI integration', 'Redmond, WA', 2018, 'https://openai.azure.com', 'https://learn.microsoft.com/azure/ai-services'),
('Perplexity', 'perplexity', 'https://perplexity.ai', 'AI-powered search and answer engine', 'San Francisco, CA', 2022, 'https://api.perplexity.ai', 'https://docs.perplexity.ai'),
('xAI', 'xai', 'https://x.ai', 'Creator of Grok AI models', 'Austin, TX', 2023, 'https://api.x.ai/v1', 'https://docs.x.ai'),
('Replicate', 'replicate', 'https://replicate.com', 'Run ML models in the cloud via API', 'San Francisco, CA', 2019, 'https://api.replicate.com/v1', 'https://replicate.com/docs'),
('Together AI', 'together', 'https://together.ai', 'Fast inference for open-source models', 'San Francisco, CA', 2022, 'https://api.together.xyz/v1', 'https://docs.together.ai'),
('Groq', 'groq', 'https://groq.com', 'Ultra-fast LPU inference engine', 'Mountain View, CA', 2016, 'https://api.groq.com/openai/v1', 'https://console.groq.com/docs'),
('DeepSeek', 'deepseek', 'https://deepseek.com', 'Chinese AI lab with efficient open models', 'Hangzhou, China', 2023, 'https://api.deepseek.com/v1', 'https://platform.deepseek.com/docs'),
('AI21 Labs', 'ai21', 'https://ai21.com', 'Creator of Jamba and Jurassic models', 'Tel Aviv, Israel', 2017, 'https://api.ai21.com/studio/v1', 'https://docs.ai21.com'),
('Runway', 'runway', 'https://runway.ml', 'AI-powered video generation and editing', 'New York, NY', 2018, 'https://api.runway.ml/v1', 'https://docs.runway.ml'),
('ElevenLabs', 'elevenlabs', 'https://elevenlabs.io', 'AI voice synthesis and cloning', 'New York, NY', 2022, 'https://api.elevenlabs.io/v1', 'https://docs.elevenlabs.io'),
('Midjourney', 'midjourney', 'https://midjourney.com', 'AI image generation through Discord and web', 'San Francisco, CA', 2021, NULL, 'https://docs.midjourney.com'),
('Suno', 'suno', 'https://suno.ai', 'AI music and audio generation', 'Cambridge, MA', 2023, 'https://api.suno.ai/v1', 'https://docs.suno.ai'),
('Alibaba Cloud (Qwen)', 'qwen', 'https://qwenlm.github.io', 'Qwen series of large language models', 'Hangzhou, China', 2023, 'https://dashscope.aliyuncs.com/api/v1', 'https://help.aliyun.com/zh/dashscope');

-- ============================================================================
-- SEED DATA: USE CASE CATEGORIES
-- ============================================================================

INSERT INTO use_case_categories (name, slug, icon, description) VALUES
('Text & Writing', 'text-writing', 'pencil', 'Content creation, editing, summarization, and translation'),
('Code & Development', 'code-development', 'code', 'Code generation, debugging, review, and documentation'),
('Image & Design', 'image-design', 'image', 'Image generation, editing, and visual design'),
('Audio & Voice', 'audio-voice', 'headphones', 'Speech synthesis, transcription, and audio processing'),
('Video & Animation', 'video-animation', 'video', 'Video generation, editing, and animation'),
('Research & Analysis', 'research-analysis', 'search', 'Data analysis, research synthesis, and insights'),
('Business & Enterprise', 'business-enterprise', 'briefcase', 'Business automation, CRM, and enterprise workflows'),
('Education & Training', 'education-training', 'book', 'Learning, tutoring, and educational content'),
('Creative & Art', 'creative-art', 'palette', 'Creative writing, music, and artistic expression'),
('Data & Analytics', 'data-analytics', 'chart', 'Data processing, visualization, and predictive analytics');

-- ============================================================================
-- SEED DATA: USE CASES
-- ============================================================================

INSERT INTO use_cases (category_id, name, slug, description, typical_input_types, typical_output_types) VALUES
((SELECT id FROM use_case_categories WHERE slug = 'text-writing'), 'Blog Writing', 'blog-writing', 'Generate long-form blog posts and articles', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'text-writing'), 'Email Drafting', 'email-drafting', 'Compose professional emails', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'text-writing'), 'Translation', 'translation', 'Translate text between languages', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'text-writing'), 'Summarization', 'summarization', 'Summarize long documents', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'code-development'), 'Code Generation', 'code-generation', 'Generate code from descriptions', '{"text"}', '{"code"}'),
((SELECT id FROM use_case_categories WHERE slug = 'code-development'), 'Code Review', 'code-review', 'Analyze and review code quality', '{"code"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'code-development'), 'Bug Fixing', 'bug-fixing', 'Identify and fix bugs in code', '{"code"}', '{"code"}'),
((SELECT id FROM use_case_categories WHERE slug = 'code-development'), 'API Development', 'api-development', 'Design and build APIs', '{"text"}', '{"code"}'),
((SELECT id FROM use_case_categories WHERE slug = 'image-design'), 'Image Generation', 'image-generation', 'Create images from text prompts', '{"text"}', '{"image"}'),
((SELECT id FROM use_case_categories WHERE slug = 'image-design'), 'Image Editing', 'image-editing', 'Edit and enhance existing images', '{"image", "text"}', '{"image"}'),
((SELECT id FROM use_case_categories WHERE slug = 'image-design'), 'Logo Design', 'logo-design', 'Create logos and brand assets', '{"text"}', '{"image"}'),
((SELECT id FROM use_case_categories WHERE slug = 'audio-voice'), 'Text to Speech', 'text-to-speech', 'Convert text to natural speech', '{"text"}', '{"audio"}'),
((SELECT id FROM use_case_categories WHERE slug = 'audio-voice'), 'Speech to Text', 'speech-to-text', 'Transcribe audio to text', '{"audio"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'audio-voice'), 'Voice Cloning', 'voice-cloning', 'Clone and synthesize voices', '{"audio"}', '{"audio"}'),
((SELECT id FROM use_case_categories WHERE slug = 'video-animation'), 'Video Generation', 'video-generation', 'Generate videos from text or images', '{"text", "image"}', '{"video"}'),
((SELECT id FROM use_case_categories WHERE slug = 'video-animation'), 'Video Editing', 'video-editing', 'AI-powered video editing', '{"video"}', '{"video"}'),
((SELECT id FROM use_case_categories WHERE slug = 'research-analysis'), 'Market Research', 'market-research', 'Analyze markets and competitors', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'research-analysis'), 'Document Analysis', 'document-analysis', 'Extract insights from documents', '{"text", "image"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'research-analysis'), 'Scientific Research', 'scientific-research', 'Assist with scientific literature review', '{"text"}', '{"text"}'),
((SELECT id FROM use_case_categories WHERE slug = 'data-analytics'), 'Data Visualization', 'data-visualization', 'Create charts and dashboards', '{"text"}', '{"image", "code"}'),
((SELECT id FROM use_case_categories WHERE slug = 'data-analytics'), 'Predictive Analytics', 'predictive-analytics', 'Build prediction models', '{"text"}', '{"text", "code"}');

-- ============================================================================
-- SEED DATA: TOKEN PACKAGES
-- ============================================================================

INSERT INTO aicaffe_token_packages (name, description, token_amount, price_usd, bonus_percentage, is_featured) VALUES
('Starter', 'Perfect for trying out AI models', 100000, 5.00, 0, FALSE),
('Basic', 'For regular individual use', 500000, 20.00, 5, FALSE),
('Pro', 'Best value for professionals', 2000000, 70.00, 10, TRUE),
('Business', 'For teams and businesses', 10000000, 300.00, 15, FALSE),
('Enterprise', 'Custom enterprise package', 50000000, 1200.00, 20, FALSE);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON token_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate token exchange for a model usage
CREATE OR REPLACE FUNCTION calculate_token_cost(
    p_model_id UUID,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER
) RETURNS TABLE (
    aicaffe_tokens_needed BIGINT,
    provider_cost_usd DECIMAL,
    margin_usd DECIMAL,
    total_cost_usd DECIMAL
) AS $$
DECLARE
    v_input_rate DECIMAL;
    v_output_rate DECIMAL;
    v_input_cost DECIMAL;
    v_output_cost DECIMAL;
    v_margin DECIMAL;
BEGIN
    SELECT input_price_per_million, output_price_per_million
    INTO v_input_cost, v_output_cost
    FROM ai_models WHERE id = p_model_id;

    provider_cost_usd := (p_input_tokens * v_input_cost / 1000000.0) + (p_output_tokens * v_output_cost / 1000000.0);
    margin_usd := provider_cost_usd * 0.20;
    total_cost_usd := provider_cost_usd + margin_usd;
    aicaffe_tokens_needed := CEIL(total_cost_usd * 20000);  -- 1 USD = 20000 ACT tokens

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- View: Model leaderboard
CREATE OR REPLACE VIEW model_leaderboard AS
SELECT
    m.id,
    m.name AS model_name,
    p.name AS provider_name,
    m.model_type,
    m.context_window,
    m.input_price_per_million,
    m.output_price_per_million,
    m.avg_rating,
    m.total_ratings,
    m.total_api_calls,
    m.avg_latency_ms,
    m.is_open_source,
    m.benchmarks,
    m.status
FROM ai_models m
JOIN ai_providers p ON m.provider_id = p.id
WHERE m.status = 'active'
ORDER BY m.avg_rating DESC, m.total_api_calls DESC;
