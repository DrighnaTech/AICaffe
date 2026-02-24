-- ═══════════════════════════════════════════════════════════════════════════════
-- AICaffe Workspace & Agent Builder Schema
-- Stores user work organized by category + custom AI agents
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Task Categories ────────────────────────────────────────────────────────────
CREATE TYPE task_category AS ENUM (
    'content',      -- Writing, copywriting, blog posts
    'research',     -- Analysis, summarization, fact-finding
    'design',       -- Image generation, UI concepts
    'development',  -- Code generation, debugging
    'audio',        -- Voice, music, sound
    'video',        -- Video generation, editing
    'data',         -- Data analysis, visualization
    'translation',  -- Language translation
    'assistant',    -- General chat, Q&A
    'agent'         -- Custom agent tasks
);

-- ── Workspaces ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Workspace',
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_user ON workspaces(user_id);

-- ── Projects (folders within workspace) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category task_category NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#8B5CF6',
    icon VARCHAR(50) DEFAULT 'folder',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_workspace ON workspace_projects(workspace_id);
CREATE INDEX idx_projects_category ON workspace_projects(category);

-- ── AI Tasks (individual work items) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    project_id UUID REFERENCES workspace_projects(id) ON DELETE SET NULL,

    -- Task details
    title VARCHAR(500) NOT NULL,
    category task_category NOT NULL,
    subcategory VARCHAR(100),
    prompt TEXT NOT NULL,

    -- AI execution
    model_used VARCHAR(100),
    provider VARCHAR(50),
    model_config JSONB DEFAULT '{}',  -- temperature, max_tokens, etc.

    -- Results
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    result TEXT,
    result_type VARCHAR(50) DEFAULT 'text',  -- text, image, audio, video, code, json
    result_metadata JSONB DEFAULT '{}',  -- URLs, dimensions, duration, etc.

    -- Attachments (input files)
    attachments JSONB DEFAULT '[]',

    -- Output files (generated content)
    output_files JSONB DEFAULT '[]',

    -- Metrics
    tokens_input INT DEFAULT 0,
    tokens_output INT DEFAULT 0,
    tokens_total INT DEFAULT 0,
    cost_act DECIMAL(12, 4) DEFAULT 0,
    execution_time_ms INT DEFAULT 0,

    -- Ratings
    user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_user ON ai_tasks(user_id);
CREATE INDEX idx_tasks_workspace ON ai_tasks(workspace_id);
CREATE INDEX idx_tasks_project ON ai_tasks(project_id);
CREATE INDEX idx_tasks_category ON ai_tasks(category);
CREATE INDEX idx_tasks_status ON ai_tasks(status);
CREATE INDEX idx_tasks_created ON ai_tasks(created_at DESC);

-- ── Task Templates ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system template

    name VARCHAR(255) NOT NULL,
    description TEXT,
    category task_category NOT NULL,
    subcategory VARCHAR(100),

    prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',  -- [{name, type, required, default}]

    recommended_models JSONB DEFAULT '[]',
    default_config JSONB DEFAULT '{}',

    icon VARCHAR(50),
    color VARCHAR(7),

    is_public BOOLEAN DEFAULT FALSE,
    usage_count INT DEFAULT 0,
    avg_rating DECIMAL(2, 1) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON task_templates(category);
CREATE INDEX idx_templates_public ON task_templates(is_public) WHERE is_public = TRUE;

-- ══════════════════════════════════════════════════════════════════════════════
-- AGENT BUILDER
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Custom Agents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url TEXT,

    -- Agent type
    agent_type VARCHAR(50) NOT NULL DEFAULT 'assistant',  -- assistant, workflow, specialist

    -- System configuration
    system_prompt TEXT NOT NULL,
    personality JSONB DEFAULT '{}',  -- tone, style, expertise

    -- Model configuration
    primary_model VARCHAR(100) NOT NULL DEFAULT 'claude-3-5-sonnet',
    fallback_models JSONB DEFAULT '[]',
    model_config JSONB DEFAULT '{
        "temperature": 0.7,
        "max_tokens": 4096,
        "top_p": 1
    }',

    -- Capabilities
    capabilities JSONB DEFAULT '[]',  -- ["web_search", "code_execution", "image_gen"]
    tools JSONB DEFAULT '[]',  -- MCP tools, function calls

    -- Knowledge base
    knowledge_sources JSONB DEFAULT '[]',  -- URLs, documents, embeddings

    -- Workflow (for workflow agents)
    workflow_config JSONB DEFAULT NULL,  -- n8n/langchain workflow definition

    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Stats
    total_conversations INT DEFAULT 0,
    total_messages INT DEFAULT 0,
    avg_rating DECIMAL(2, 1) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON custom_agents(user_id);
CREATE INDEX idx_agents_type ON custom_agents(agent_type);
CREATE INDEX idx_agents_public ON custom_agents(is_public) WHERE is_public = TRUE;

-- ── Agent Tools ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- search, code, image, data, integration

    -- Tool definition
    tool_type VARCHAR(50) NOT NULL,  -- function, mcp, api, workflow
    definition JSONB NOT NULL,  -- OpenAI function schema / MCP config

    -- Provider info
    provider VARCHAR(100),
    requires_api_key BOOLEAN DEFAULT FALSE,
    api_key_env_var VARCHAR(100),

    -- Permissions
    is_system BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT TRUE,

    icon VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Agent Conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES custom_agents(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,

    title VARCHAR(500),
    summary TEXT,

    -- Context
    context JSONB DEFAULT '{}',

    -- Stats
    message_count INT DEFAULT 0,
    tokens_used INT DEFAULT 0,

    is_archived BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_convos_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_convos_agent ON agent_conversations(agent_id);

-- ── Agent Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,  -- user, assistant, system, tool
    content TEXT NOT NULL,

    -- Tool usage
    tool_calls JSONB DEFAULT NULL,
    tool_results JSONB DEFAULT NULL,

    -- Attachments
    attachments JSONB DEFAULT '[]',

    -- Metrics
    tokens INT DEFAULT 0,
    model_used VARCHAR(100),
    latency_ms INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_msgs_convo ON agent_messages(conversation_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- AI MODEL ROUTER CONFIG
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Category to Model Mapping ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_model_routing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category task_category NOT NULL,
    subcategory VARCHAR(100),

    -- Primary model selection
    primary_model VARCHAR(100) NOT NULL,
    primary_provider VARCHAR(50) NOT NULL,

    -- Fallback chain
    fallback_models JSONB DEFAULT '[]',

    -- Selection criteria
    priority INT DEFAULT 0,  -- Higher = preferred
    min_context_window INT DEFAULT 0,
    max_cost_per_1k DECIMAL(10, 6),

    -- Conditions
    conditions JSONB DEFAULT '{}',  -- {"requires_vision": true, "min_speed": "fast"}

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(category, subcategory, priority)
);

-- ── Insert Default Routing Rules ───────────────────────────────────────────────
INSERT INTO category_model_routing (category, subcategory, primary_model, primary_provider, fallback_models, priority) VALUES
-- Content Creation
('content', 'blog', 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "gemini-2.0-flash"]', 10),
('content', 'copywriting', 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022", "mistral-large"]', 10),
('content', 'creative', 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o"]', 10),
('content', NULL, 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "gemini-1.5-pro"]', 1),

-- Research
('research', 'web_search', 'sonar-pro', 'perplexity', '["gpt-4o", "gemini-2.0-flash"]', 10),
('research', 'analysis', 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "gemini-1.5-pro"]', 10),
('research', 'summarization', 'gemini-2.0-flash', 'google', '["claude-3-5-sonnet-20241022", "gpt-4o-mini"]', 10),
('research', NULL, 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "sonar-pro"]', 1),

-- Design
('design', 'image_generation', 'flux-pro', 'replicate', '["dall-e-3", "sd3.5-large"]', 10),
('design', 'ui_mockup', 'dall-e-3', 'openai', '["flux-pro", "midjourney"]', 10),
('design', 'logo', 'ideogram', 'ideogram', '["dall-e-3", "flux-pro"]', 10),
('design', NULL, 'dall-e-3', 'openai', '["flux-pro", "sd3.5-large"]', 1),

-- Development
('development', 'code_generation', 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "deepseek-coder"]', 10),
('development', 'debugging', 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o"]', 10),
('development', 'code_review', 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022"]', 10),
('development', 'fast_code', 'deepseek-coder', 'deepseek', '["llama-3.3-70b-groq", "codestral"]', 10),
('development', NULL, 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "deepseek-coder"]', 1),

-- Audio
('audio', 'tts', 'eleven_turbo_v2_5', 'elevenlabs', '["openai-tts-1", "cartesia-sonic"]', 10),
('audio', 'stt', 'whisper-large-v3', 'openai', '["deepgram-nova-2", "assemblyai"]', 10),
('audio', 'music', 'suno-v3', 'suno', '["udio", "stable-audio"]', 10),
('audio', 'voice_clone', 'eleven_multilingual_v2', 'elevenlabs', '["resemble", "playht"]', 10),
('audio', NULL, 'eleven_turbo_v2_5', 'elevenlabs', '["openai-tts-1"]', 1),

-- Video
('video', 'generation', 'gen-3-alpha', 'runway', '["pika", "luma-dream-machine"]', 10),
('video', 'avatar', 'heygen', 'heygen', '["synthesia", "d-id"]', 10),
('video', NULL, 'gen-3-alpha', 'runway', '["pika", "kling"]', 1),

-- Data
('data', 'analysis', 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022"]', 10),
('data', 'visualization', 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022"]', 10),
('data', NULL, 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022"]', 1),

-- Translation
('translation', NULL, 'gpt-4o', 'openai', '["claude-3-5-sonnet-20241022", "deepl"]', 1),

-- Assistant (General)
('assistant', 'fast', 'gemini-2.0-flash', 'google', '["gpt-4o-mini", "llama-3.3-70b-groq"]', 10),
('assistant', 'reasoning', 'o1-preview', 'openai', '["deepseek-r1", "claude-3-opus"]', 10),
('assistant', NULL, 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o", "gemini-2.0-flash"]', 1),

-- Agent
('agent', NULL, 'claude-3-5-sonnet-20241022', 'anthropic', '["gpt-4o"]', 1)

ON CONFLICT DO NOTHING;

-- ── Insert Default System Tools ────────────────────────────────────────────────
INSERT INTO agent_tools (name, display_name, description, category, tool_type, definition, provider, requires_api_key, api_key_env_var, icon) VALUES
('web_search', 'Web Search', 'Search the web for current information', 'search', 'function',
 '{"name": "web_search", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}',
 'perplexity', true, 'PERPLEXITY_API_KEY', 'search'),

('code_interpreter', 'Code Interpreter', 'Execute Python code in a sandbox', 'code', 'function',
 '{"name": "code_interpreter", "parameters": {"type": "object", "properties": {"code": {"type": "string"}, "language": {"type": "string", "enum": ["python", "javascript"]}}, "required": ["code"]}}',
 NULL, false, NULL, 'code'),

('image_generation', 'Image Generation', 'Generate images from text descriptions', 'image', 'function',
 '{"name": "image_generation", "parameters": {"type": "object", "properties": {"prompt": {"type": "string"}, "style": {"type": "string"}, "size": {"type": "string"}}, "required": ["prompt"]}}',
 'openai', true, 'OPENAI_API_KEY', 'image'),

('document_reader', 'Document Reader', 'Read and extract content from documents', 'data', 'function',
 '{"name": "document_reader", "parameters": {"type": "object", "properties": {"file_url": {"type": "string"}, "extract_type": {"type": "string", "enum": ["text", "tables", "images"]}}, "required": ["file_url"]}}',
 NULL, false, NULL, 'file-text'),

('calculator', 'Calculator', 'Perform mathematical calculations', 'utility', 'function',
 '{"name": "calculator", "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}',
 NULL, false, NULL, 'calculator'),

('url_reader', 'URL Reader', 'Fetch and read content from URLs', 'data', 'function',
 '{"name": "url_reader", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}',
 NULL, false, NULL, 'link'),

('n8n_workflow', 'n8n Workflow', 'Execute n8n automation workflows', 'integration', 'workflow',
 '{"name": "n8n_workflow", "parameters": {"type": "object", "properties": {"workflow_id": {"type": "string"}, "input_data": {"type": "object"}}, "required": ["workflow_id"]}}',
 'n8n', true, 'N8N_API_KEY', 'workflow'),

('database_query', 'Database Query', 'Query structured databases', 'data', 'function',
 '{"name": "database_query", "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "database": {"type": "string"}}, "required": ["query"]}}',
 NULL, false, NULL, 'database'),

('email_sender', 'Email Sender', 'Send emails programmatically', 'integration', 'function',
 '{"name": "email_sender", "parameters": {"type": "object", "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}}, "required": ["to", "subject", "body"]}}',
 NULL, true, 'SMTP_PASSWORD', 'mail'),

('file_manager', 'File Manager', 'Manage files in workspace storage', 'utility', 'function',
 '{"name": "file_manager", "parameters": {"type": "object", "properties": {"action": {"type": "string", "enum": ["read", "write", "delete", "list"]}, "path": {"type": "string"}, "content": {"type": "string"}}, "required": ["action", "path"]}}',
 NULL, false, NULL, 'folder')

ON CONFLICT (name) DO NOTHING;

-- ── Create default workspace for existing users ────────────────────────────────
INSERT INTO workspaces (user_id, name, is_default)
SELECT id, 'My Workspace', TRUE
FROM users
WHERE id NOT IN (SELECT user_id FROM workspaces WHERE is_default = TRUE)
ON CONFLICT DO NOTHING;

-- ── Insert Default Task Templates ──────────────────────────────────────────────
INSERT INTO task_templates (name, description, category, subcategory, prompt_template, variables, recommended_models, icon, color, is_public) VALUES
('Blog Post Writer', 'Generate engaging blog posts on any topic', 'content', 'blog',
 'Write a comprehensive blog post about {{topic}}. Target audience: {{audience}}. Tone: {{tone}}. Include: introduction, main points, conclusion, and a call to action.',
 '[{"name": "topic", "type": "string", "required": true}, {"name": "audience", "type": "string", "required": false, "default": "general"}, {"name": "tone", "type": "string", "required": false, "default": "professional"}]',
 '["claude-3-5-sonnet", "gpt-4o"]', 'file-text', '#8B5CF6', true),

('Code Generator', 'Generate code in any programming language', 'development', 'code_generation',
 'Write {{language}} code that {{description}}. Requirements:\n{{requirements}}\n\nInclude comments and follow best practices.',
 '[{"name": "language", "type": "string", "required": true}, {"name": "description", "type": "string", "required": true}, {"name": "requirements", "type": "string", "required": false}]',
 '["claude-3-5-sonnet", "deepseek-coder", "gpt-4o"]', 'code', '#06B6D4', true),

('Research Assistant', 'Deep research on any topic with citations', 'research', 'analysis',
 'Conduct comprehensive research on: {{topic}}\n\nFocus areas: {{focus}}\n\nProvide: key findings, analysis, and actionable insights with sources.',
 '[{"name": "topic", "type": "string", "required": true}, {"name": "focus", "type": "string", "required": false}]',
 '["sonar-pro", "claude-3-5-sonnet", "gpt-4o"]', 'search', '#10B981', true),

('Image Creator', 'Generate stunning images from descriptions', 'design', 'image_generation',
 '{{description}}\n\nStyle: {{style}}\nMood: {{mood}}',
 '[{"name": "description", "type": "string", "required": true}, {"name": "style", "type": "string", "required": false, "default": "photorealistic"}, {"name": "mood", "type": "string", "required": false}]',
 '["dall-e-3", "flux-pro", "midjourney"]', 'image', '#EC4899', true),

('Data Analyzer', 'Analyze data and generate insights', 'data', 'analysis',
 'Analyze the following data:\n{{data}}\n\nProvide: summary statistics, key patterns, anomalies, and actionable recommendations.',
 '[{"name": "data", "type": "string", "required": true}]',
 '["gpt-4o", "claude-3-5-sonnet"]', 'bar-chart', '#F59E0B', true),

('Translator', 'Translate text between languages', 'translation', NULL,
 'Translate the following from {{source_language}} to {{target_language}}:\n\n{{text}}\n\nPreserve tone and meaning.',
 '[{"name": "text", "type": "string", "required": true}, {"name": "source_language", "type": "string", "required": true}, {"name": "target_language", "type": "string", "required": true}]',
 '["gpt-4o", "claude-3-5-sonnet", "deepl"]', 'languages', '#3B82F6', true),

('Voice Generator', 'Convert text to natural speech', 'audio', 'tts',
 '{{text}}',
 '[{"name": "text", "type": "string", "required": true}, {"name": "voice", "type": "string", "required": false}, {"name": "speed", "type": "number", "required": false, "default": 1.0}]',
 '["elevenlabs", "openai-tts"]', 'mic', '#A855F7', true),

('Video Script', 'Generate video scripts with scenes and narration', 'video', 'generation',
 'Create a video script about: {{topic}}\n\nDuration: {{duration}}\nStyle: {{style}}\n\nInclude: scenes, visuals, narration, and transitions.',
 '[{"name": "topic", "type": "string", "required": true}, {"name": "duration", "type": "string", "required": false, "default": "60 seconds"}, {"name": "style", "type": "string", "required": false}]',
 '["claude-3-5-sonnet", "gpt-4o"]', 'video', '#EF4444', true)

ON CONFLICT DO NOTHING;
