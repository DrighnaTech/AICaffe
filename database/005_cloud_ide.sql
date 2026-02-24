-- ============================================================================
-- AICaffe Cloud IDE & DevSpace - Database Schema
-- Version: 1.0.0
-- Description: Cloud-based VS Code workspaces with database provisioning
-- ============================================================================

-- ============================================================================
-- 1. IDE PROJECT MANAGEMENT
-- ============================================================================

-- Available IDE templates (Node.js, Python, etc.)
CREATE TABLE ide_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    docker_image VARCHAR(500) NOT NULL,  -- e.g., 'codercom/code-server:latest'
    base_environment JSONB DEFAULT '{}',  -- default env vars
    default_extensions TEXT[] DEFAULT '{}',  -- VS Code extensions to pre-install
    default_settings JSONB DEFAULT '{}',  -- VS Code settings
    startup_script TEXT,  -- Script to run on container start
    resource_preset VARCHAR(50) DEFAULT 'small',  -- small, medium, large, xlarge
    category VARCHAR(100),  -- web, data-science, ai-ml, mobile, etc.
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource presets for IDE instances
CREATE TABLE ide_resource_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    cpu_cores DECIMAL(3,1) NOT NULL,  -- e.g., 0.5, 1.0, 2.0, 4.0
    memory_mb INTEGER NOT NULL,  -- e.g., 512, 1024, 2048, 4096
    storage_gb INTEGER NOT NULL,  -- e.g., 5, 10, 20, 50
    gpu_enabled BOOLEAN DEFAULT FALSE,
    gpu_type VARCHAR(100),  -- e.g., 'nvidia-t4', 'nvidia-a100'
    tokens_per_hour INTEGER NOT NULL,  -- ACT tokens charged per hour
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's IDE projects (codespaces)
CREATE TABLE ide_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    template_id UUID REFERENCES ide_templates(id) ON DELETE SET NULL,

    -- Project info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'folder',
    color VARCHAR(20) DEFAULT '#8B5CF6',

    -- Container configuration
    resource_preset_id UUID REFERENCES ide_resource_presets(id),
    custom_docker_image VARCHAR(500),
    environment_vars JSONB DEFAULT '{}',
    secrets JSONB DEFAULT '{}',  -- encrypted
    vscode_extensions TEXT[] DEFAULT '{}',
    vscode_settings JSONB DEFAULT '{}',
    startup_command TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN (
        'creating', 'starting', 'running', 'stopping', 'stopped',
        'hibernating', 'error', 'deleted'
    )),
    container_id VARCHAR(255),  -- Docker/K8s container ID
    container_url VARCHAR(500),  -- URL to access VS Code
    last_accessed_at TIMESTAMPTZ,
    auto_stop_minutes INTEGER DEFAULT 30,  -- Auto-stop after inactivity

    -- Git integration
    git_provider VARCHAR(50) CHECK (git_provider IN ('github', 'gitlab', 'bitbucket', 'azure')),
    git_repo_url VARCHAR(500),
    git_branch VARCHAR(255) DEFAULT 'main',
    git_auto_commit BOOLEAN DEFAULT FALSE,

    -- Billing
    tokens_consumed BIGINT DEFAULT 0,
    total_runtime_minutes INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, slug)
);

-- IDE session tracking for billing
CREATE TABLE ide_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES ide_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_preset_id UUID REFERENCES ide_resource_presets(id),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,

    -- Billing
    tokens_charged BIGINT DEFAULT 0,
    billing_status VARCHAR(50) DEFAULT 'pending' CHECK (billing_status IN ('pending', 'charged', 'failed', 'refunded')),

    -- Resource usage
    cpu_usage_avg DECIMAL(5,2),
    memory_usage_avg DECIMAL(5,2),
    network_in_mb DECIMAL(10,2),
    network_out_mb DECIMAL(10,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. DATABASE PROVISIONING
-- ============================================================================

-- Available database types
CREATE TABLE database_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    engine VARCHAR(50) NOT NULL,  -- postgres, mysql, mongodb, redis, etc.
    version VARCHAR(50) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    docker_image VARCHAR(500) NOT NULL,
    default_port INTEGER NOT NULL,
    connection_string_template VARCHAR(500),  -- with placeholders
    tokens_per_hour INTEGER NOT NULL,
    storage_tokens_per_gb INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's provisioned databases
CREATE TABLE provisioned_databases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES ide_projects(id) ON DELETE SET NULL,
    database_type_id UUID NOT NULL REFERENCES database_types(id),

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,

    -- Connection details
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,  -- encrypted
    connection_string_encrypted TEXT,  -- encrypted full connection string

    -- Container info
    container_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN (
        'creating', 'starting', 'running', 'stopping', 'stopped', 'error', 'deleted'
    )),

    -- Resources
    storage_gb INTEGER DEFAULT 1,
    max_connections INTEGER DEFAULT 20,

    -- Billing
    tokens_consumed BIGINT DEFAULT 0,
    total_runtime_minutes INTEGER DEFAULT 0,

    -- Backup
    auto_backup BOOLEAN DEFAULT TRUE,
    last_backup_at TIMESTAMPTZ,
    retention_days INTEGER DEFAULT 7,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, slug)
);

-- Database backups
CREATE TABLE database_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    database_id UUID NOT NULL REFERENCES provisioned_databases(id) ON DELETE CASCADE,

    backup_type VARCHAR(50) DEFAULT 'auto' CHECK (backup_type IN ('auto', 'manual', 'pre_delete')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    file_path TEXT,
    file_size_bytes BIGINT,

    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. GITHUB INTEGRATION
-- ============================================================================

-- User's connected Git accounts
CREATE TABLE git_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    provider VARCHAR(50) NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket', 'azure')),
    provider_user_id VARCHAR(255),
    provider_username VARCHAR(255),
    provider_email VARCHAR(255),
    provider_avatar_url TEXT,

    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT '{}',

    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, provider)
);

-- Cached repository list
CREATE TABLE git_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES git_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    provider_repo_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500) NOT NULL,  -- e.g., 'username/repo-name'
    description TEXT,
    url VARCHAR(500),
    clone_url VARCHAR(500),
    ssh_url VARCHAR(500),
    default_branch VARCHAR(255) DEFAULT 'main',

    is_private BOOLEAN DEFAULT FALSE,
    is_fork BOOLEAN DEFAULT FALSE,

    language VARCHAR(100),
    languages JSONB DEFAULT '{}',  -- {"Python": 50000, "JavaScript": 20000}

    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,

    last_push_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(connection_id, provider_repo_id)
);

-- ============================================================================
-- 4. IDE EXTENSIONS & MARKETPLACE
-- ============================================================================

-- VS Code extensions available in the platform
CREATE TABLE ide_extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extension_id VARCHAR(500) NOT NULL UNIQUE,  -- e.g., 'ms-python.python'
    name VARCHAR(255) NOT NULL,
    publisher VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    icon_url TEXT,

    category VARCHAR(100),  -- 'languages', 'themes', 'debuggers', 'formatters', etc.
    tags TEXT[] DEFAULT '{}',

    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),

    is_featured BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,

    marketplace_url VARCHAR(500),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's favorite/installed extensions
CREATE TABLE user_ide_extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extension_id UUID NOT NULL REFERENCES ide_extensions(id) ON DELETE CASCADE,

    is_favorite BOOLEAN DEFAULT FALSE,
    auto_install BOOLEAN DEFAULT TRUE,  -- Auto-install in new projects

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, extension_id)
);

-- ============================================================================
-- 5. COLLABORATION
-- ============================================================================

-- Project collaborators
CREATE TABLE ide_project_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES ide_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(id),

    role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),

    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,

    UNIQUE(project_id, user_id)
);

-- Live collaboration sessions
CREATE TABLE ide_collab_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES ide_projects(id) ON DELETE CASCADE,
    host_user_id UUID NOT NULL REFERENCES users(id),

    session_code VARCHAR(50) UNIQUE NOT NULL,  -- Short code for joining
    is_active BOOLEAN DEFAULT TRUE,

    max_participants INTEGER DEFAULT 5,
    current_participants INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ============================================================================
-- 6. INSERT DEFAULT DATA
-- ============================================================================

-- Insert resource presets
INSERT INTO ide_resource_presets (name, slug, description, cpu_cores, memory_mb, storage_gb, tokens_per_hour) VALUES
('Micro', 'micro', 'For light tasks and learning', 0.5, 512, 5, 10),
('Small', 'small', 'For small projects', 1.0, 1024, 10, 25),
('Medium', 'medium', 'For most development work', 2.0, 2048, 20, 50),
('Large', 'large', 'For heavy workloads', 4.0, 4096, 50, 100),
('XLarge', 'xlarge', 'For intensive tasks', 8.0, 8192, 100, 200),
('GPU Small', 'gpu-small', 'With NVIDIA T4 GPU', 4.0, 16384, 50, 500),
('GPU Large', 'gpu-large', 'With NVIDIA A100 GPU', 8.0, 32768, 100, 1000);

-- Update GPU presets
UPDATE ide_resource_presets SET gpu_enabled = TRUE, gpu_type = 'nvidia-t4' WHERE slug = 'gpu-small';
UPDATE ide_resource_presets SET gpu_enabled = TRUE, gpu_type = 'nvidia-a100' WHERE slug = 'gpu-large';

-- Insert IDE templates
INSERT INTO ide_templates (name, slug, description, icon, docker_image, default_extensions, category, tags) VALUES
('Blank', 'blank', 'Empty workspace - start from scratch', 'box', 'codercom/code-server:latest', '{}', 'general', '{"empty", "starter"}'),
('Python', 'python', 'Python development environment with pip and common packages', 'file-code', 'aicaffe/code-server-python:latest', '{"ms-python.python", "ms-python.pylint", "ms-toolsai.jupyter"}', 'data-science', '{"python", "data-science", "ai"}'),
('Node.js', 'nodejs', 'Node.js with npm/yarn and common tools', 'hexagon', 'aicaffe/code-server-node:latest', '{"dbaeumer.vscode-eslint", "esbenp.prettier-vscode"}', 'web', '{"javascript", "typescript", "node", "web"}'),
('React', 'react', 'React development with Vite and TypeScript', 'atom', 'aicaffe/code-server-react:latest', '{"dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "dsznajder.es7-react-js-snippets"}', 'web', '{"react", "typescript", "frontend"}'),
('Next.js', 'nextjs', 'Full-stack Next.js with TypeScript', 'layers', 'aicaffe/code-server-nextjs:latest', '{"dbaeumer.vscode-eslint", "bradlc.vscode-tailwindcss"}', 'web', '{"nextjs", "react", "fullstack"}'),
('FastAPI', 'fastapi', 'Python FastAPI backend development', 'zap', 'aicaffe/code-server-fastapi:latest', '{"ms-python.python", "rangav.vscode-thunder-client"}', 'backend', '{"python", "api", "backend"}'),
('Go', 'go', 'Go development environment', 'terminal', 'aicaffe/code-server-go:latest', '{"golang.go"}', 'backend', '{"go", "golang", "backend"}'),
('Rust', 'rust', 'Rust development with cargo', 'cpu', 'aicaffe/code-server-rust:latest', '{"rust-lang.rust-analyzer"}', 'systems', '{"rust", "systems"}'),
('Data Science', 'data-science', 'Jupyter, pandas, numpy, scikit-learn', 'bar-chart', 'aicaffe/code-server-datascience:latest', '{"ms-python.python", "ms-toolsai.jupyter", "ms-toolsai.vscode-jupyter-cell-tags"}', 'data-science', '{"python", "jupyter", "ml", "data"}'),
('AI/ML', 'ai-ml', 'PyTorch, TensorFlow, transformers', 'brain', 'aicaffe/code-server-aiml:latest', '{"ms-python.python", "ms-toolsai.jupyter"}', 'ai-ml', '{"python", "pytorch", "tensorflow", "ai"}');

-- Insert database types
INSERT INTO database_types (name, slug, engine, version, description, icon, docker_image, default_port, connection_string_template, tokens_per_hour, storage_tokens_per_gb) VALUES
('PostgreSQL 16', 'postgres-16', 'postgres', '16', 'Advanced open-source relational database', 'database', 'postgres:16-alpine', 5432, 'postgresql://{user}:{password}@{host}:{port}/{database}', 20, 5),
('PostgreSQL 15', 'postgres-15', 'postgres', '15', 'Stable PostgreSQL version', 'database', 'postgres:15-alpine', 5432, 'postgresql://{user}:{password}@{host}:{port}/{database}', 20, 5),
('MySQL 8', 'mysql-8', 'mysql', '8.0', 'Popular open-source relational database', 'database', 'mysql:8.0', 3306, 'mysql://{user}:{password}@{host}:{port}/{database}', 20, 5),
('MongoDB 7', 'mongodb-7', 'mongodb', '7.0', 'Document-oriented NoSQL database', 'database', 'mongo:7.0', 27017, 'mongodb://{user}:{password}@{host}:{port}/{database}', 25, 8),
('Redis 7', 'redis-7', 'redis', '7', 'In-memory data store', 'zap', 'redis:7-alpine', 6379, 'redis://{password}@{host}:{port}', 10, 10),
('SQLite', 'sqlite', 'sqlite', '3', 'Lightweight embedded database (file-based)', 'file', 'keinos/sqlite3:latest', 0, 'sqlite:///{database}.db', 0, 0);

-- Insert common IDE extensions
INSERT INTO ide_extensions (extension_id, name, publisher, description, category, is_featured, is_verified) VALUES
('ms-python.python', 'Python', 'Microsoft', 'IntelliSense, linting, debugging for Python', 'languages', TRUE, TRUE),
('ms-python.pylint', 'Pylint', 'Microsoft', 'Linting for Python', 'linters', FALSE, TRUE),
('ms-toolsai.jupyter', 'Jupyter', 'Microsoft', 'Jupyter notebook support', 'notebooks', TRUE, TRUE),
('dbaeumer.vscode-eslint', 'ESLint', 'Microsoft', 'JavaScript linting', 'linters', TRUE, TRUE),
('esbenp.prettier-vscode', 'Prettier', 'Prettier', 'Code formatter', 'formatters', TRUE, TRUE),
('bradlc.vscode-tailwindcss', 'Tailwind CSS IntelliSense', 'Tailwind Labs', 'Tailwind CSS tooling', 'css', TRUE, TRUE),
('golang.go', 'Go', 'Go Team at Google', 'Go language support', 'languages', TRUE, TRUE),
('rust-lang.rust-analyzer', 'rust-analyzer', 'rust-lang', 'Rust language support', 'languages', TRUE, TRUE),
('ms-vscode.cpptools', 'C/C++', 'Microsoft', 'C/C++ IntelliSense and debugging', 'languages', FALSE, TRUE),
('github.copilot', 'GitHub Copilot', 'GitHub', 'AI pair programmer', 'ai', TRUE, TRUE),
('eamodio.gitlens', 'GitLens', 'GitKraken', 'Git supercharged', 'git', TRUE, TRUE),
('rangav.vscode-thunder-client', 'Thunder Client', 'Ranga Vadhineni', 'REST API client', 'testing', TRUE, FALSE),
('ms-azuretools.vscode-docker', 'Docker', 'Microsoft', 'Docker support', 'devops', TRUE, TRUE),
('GitHub.github-vscode-theme', 'GitHub Theme', 'GitHub', 'GitHub themes for VS Code', 'themes', FALSE, TRUE),
('dracula-theme.theme-dracula', 'Dracula Official', 'Dracula Theme', 'Dark theme for VS Code', 'themes', TRUE, FALSE);

-- ============================================================================
-- 7. INDEXES
-- ============================================================================

CREATE INDEX idx_ide_projects_user ON ide_projects(user_id);
CREATE INDEX idx_ide_projects_status ON ide_projects(status);
CREATE INDEX idx_ide_projects_template ON ide_projects(template_id);
CREATE INDEX idx_ide_sessions_project ON ide_sessions(project_id);
CREATE INDEX idx_ide_sessions_user ON ide_sessions(user_id);
CREATE INDEX idx_provisioned_dbs_user ON provisioned_databases(user_id);
CREATE INDEX idx_provisioned_dbs_project ON provisioned_databases(project_id);
CREATE INDEX idx_git_connections_user ON git_connections(user_id);
CREATE INDEX idx_git_repos_user ON git_repositories(user_id);
CREATE INDEX idx_ide_extensions_category ON ide_extensions(category);
