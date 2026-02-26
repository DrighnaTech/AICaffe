# AiCaffe — Claude Code Context Document (CLAUDE.md)
## The Complete Project Reference for AI-Assisted Solutioning

**Generated:** February 26, 2026  
**Purpose:** This document synthesizes all 12 AiCaffe project documents into a single reference for Claude Code to use during development and solutioning.  
**Source Documents:** Strategic Product Doc, Product Vision, Solution Architecture, System Design, Database & Code Structure, Code & File Structure, Algorithms & Data Structures, Smart Routing & Workshop Solutioning, Idea-to-Deployment Pipeline (x2), Cursor Comparative Analysis, Free AI API Providers spreadsheet.

---

## 1. WHAT IS AICAFFE

AiCaffe is a **Marketplace-as-an-OS** — a unified AI gateway platform that aggregates 22+ AI model providers behind a single account, single wallet (ACT tokens), and single API. It is NOT just an aggregator; it is an intelligent orchestration layer with task-specific "Workshops" that adapt the UI to the user's task.

**One-line pitch:** "One Platform, All AI Models, Zero Friction."

### Core Value Proposition
- **Subscription Fragmentation Solved:** Users maintain 1 account instead of 5-15 separate AI subscriptions
- **Blank Screen Problem Solved:** Smart Router recommends the best model for each task
- **Zero Governance Solved:** Centralized control, audit trails, and budget guardrails for enterprises
- **Integration Tax Solved:** One unified API instead of 22+ separate integrations
- **Vendor Lock-In Solved:** Switch models seamlessly without rewriting integrations

### Product Identity
| Aspect | Description |
|--------|-------------|
| Access Model | SaaS for all — any paying user or enterprise |
| Administration | Company-exclusive — only creators hold the "Master Key" |
| Billing | Unified ACT Economy — users buy from company, company pays providers |
| End-User Goal | Frictionless Intelligence — use AI without understanding infrastructure |

---

## 2. TARGET PERSONAS

### The Developer (Efficiency Seeker)
- **Pain:** Maintaining 22+ separate API integrations
- **Promise:** "Integrate once, access all models forever"
- **Key Features:** Unified API, streaming, function calling, model fallback chains, dev dashboard

### The Enterprise/Business Leader (Governance Seeker)
- **Pain:** AI costs scattered across 15+ credit cards with zero visibility
- **Promise:** "The Finance Manager for AI"
- **Key Features:** Usage analytics, budget limits, team management, RBAC, audit trails

### The Power User (Discovery Seeker)
- **Pain:** Wanting to try new models without managing 20+ accounts
- **Promise:** "The AI Playground"
- **Key Features:** Model comparison, Workshops, smart routing, leaderboards

---

## 3. THE ACT TOKEN ECONOMY

ACT (AiCaffe Tokens) is the internal currency powering the platform.

### How It Works
1. Users purchase ACT tokens with real currency (USD, EUR, INR, etc.)
2. API calls/Workshop usage auto-deducts ACT based on model + tokens consumed
3. AiCaffe buys wholesale from providers, sells retail with ~20% margin
4. Users see a single transparent ACT cost — never the underlying provider cost

### Financial System Design
- **Double-entry ledger** — every operation creates immutable debit/credit entries
- **Concurrency control** — PostgreSQL `SELECT FOR UPDATE` with `SERIALIZABLE` transactions
- **Hold-Debit-Release pattern** — estimated hold before request, actual debit after, release difference
- **Nightly reconciliation** — 02:00 UTC job recalculates all balances from ledger, alerts on discrepancy > 0.000001 ACT
- **Optimistic reads, pessimistic writes** — Redis cache for fast balance checks, DB transactions for mutations

### Flywheel Effect
More users → Higher volume → Better wholesale rates → Better margins/lower prices → More users → Smarter routing data

---

## 4. ARCHITECTURE OVERVIEW

### Architecture Pattern: Modular Monolith
Single deployable unit, internally organized into strictly bounded modules. Each module owns its routes, services, types, and tests. Supports eventual microservice extraction.

### Technology Stack
- **Runtime:** Node.js + TypeScript (strict mode)
- **Framework:** Express/Fastify (API gateway)
- **Database:** PostgreSQL 16+ (source of truth for all financial/identity data)
- **Cache/Queue:** Redis (caching, rate limiting, BullMQ job queue)
- **ORM:** Prisma
- **Infrastructure:** Kubernetes, Docker, multi-cloud

### Layered Architecture
```
┌─────────────────────────────────────────────┐
│           CLIENT LAYER                       │
│  Web App / API Consumers / Workshop UIs      │
├─────────────────────────────────────────────┤
│           API GATEWAY                        │
│  Auth, Rate Limiting, Request Validation     │
├─────────────────────────────────────────────┤
│           BUSINESS LOGIC                     │
│  Smart Conductor │ ACT Economy │ Workshops   │
├─────────────────────────────────────────────┤
│     PROVIDER ABSTRACTION LAYER (PAL)         │
│  Unified interface to 22+ AI providers       │
├─────────────────────────────────────────────┤
│           DATA LAYER                         │
│  PostgreSQL │ Redis │ AiCaffe Drive          │
└─────────────────────────────────────────────┘
```

---

## 5. PROVIDER ABSTRACTION LAYER (PAL)

The foundation of the system. Normalizes 22+ provider APIs into one consistent interface.

### Design Principles
- **Interface Uniformity:** Every provider exposes identical methods with identical request/response shapes
- **Transparent Streaming:** Unified streaming via AsyncIterator (abstracts SSE, WebSocket, long-polling)
- **Fail-Safe Isolation:** Each adapter runs in isolation with independent error handling + circuit breakers
- **Hot-Swappable:** New providers added by implementing interface + registering in model registry

### Circuit Breaker Pattern (per adapter)
- **Closed:** Normal operation
- **Open:** 5+ consecutive failures → all requests redirected to fallback chain (30s cooldown)
- **Half-Open:** Single probe request after cooldown → success returns to Closed, failure returns to Open

### Provider Health: Exponential Moving Average (EMA)
- Real-time health score per provider
- Responsive to recent changes but not overly reactive to single anomalies
- Used by Conductor for routing + by circuit breaker for threshold detection

---

## 6. SMART ROUTER / CONDUCTOR

The intelligence layer that transforms AiCaffe from proxy to orchestrator.

### Routing Pipeline (under 200ms total)

**Stage 1: Task Classification**
- Tiered approach: Tier 1 (keyword trie, <1ms, handles 80%) → Tier 2 (pattern analysis, <3ms) → Tier 3 (LLM-based, 200-500ms, only when confidence < 0.6)
- ~15 categories: code generation, code review, creative writing, summarization, translation, Q&A, data analysis, image generation, multi-modal reasoning, research synthesis, math/logic, conversation, extraction, classification, agentic workflow
- Outputs: primary task type, complexity score (1-5), modality flags

**Stage 2: Candidate Filtering**
- Exclude models missing required modality, insufficient context window, compliance-restricted, or unhealthy
- Typically reduces 22+ → 3-7 viable candidates

**Stage 3: Scoring & Ranking (Weighted Linear Combination)**
- Quality Score (from Benchmark Matrix), Cost Score, Latency Score, Context Fit Score, Provider Health Score
- Weights adjustable per user tier

**Stage 4: Selection & Execution**
- Highest-scoring model selected
- Pre-computed fallback chain (max 3 attempts: primary + 2 fallbacks)
- Routing decision logged; Workshop-specific system prompts injected

### Benchmark Matrix (Core Proprietary Asset)
- 22+ models × 15 task types × 5 complexity levels = 1,650+ data points
- Updated via: automated monthly benchmarks, aggregated implicit feedback, quarterly expert evaluations

### Advanced Routing
- **Multi-Model Orchestration:** Chain models for complex tasks
- **A/B Routing:** 5-10% traffic to challengers, auto-update after N=1000
- **User Override:** Manual selection + "Why this model?" tooltip

---

## 7. WORKSHOP ENGINE

Task-specific UI environments — AiCaffe's key differentiator.

### Architecture: Shell + Panels (Plugin-based)
Built from shared component library (Atomic Design). New Workshops assembled in weeks.

### Core Workshops
1. **Code Studio** — File tree + code editor + chat/terminal. DeepSeek Coder → Claude Sonnet → GPT-4o
2. **Research Lab** — Research canvas + source cards + chat. Perplexity → GPT-4o → Claude Opus
3. **Content Forge** — Formatting toolbar + tone selector + version history
4. **Data Analyst** — Chart renderer + table views + query builder
5. **App Builder** — Full Idea-to-Deployment Pipeline interface

### Context Bridge
- Drive → Workshop (auto-load project context)
- Workshop → Conductor (task metadata informs routing)
- Conductor → Workshop (model capabilities inform UI features)

---

## 8. IDEA-TO-DEPLOYMENT PIPELINE (Flagship Feature)

### Six Phases
1. **Discovery & Scoping** — Smart questioning → PRD generation
2. **Architecture & Design** — System diagrams, ADRs, tech stack
3. **Development & Iteration** — Scaffolding → Data → API → Logic → Frontend → Integration + live preview
4. **Testing & QA** — Unit/integration/security tests, QA report
5. **Deployment & DevOps** — CI/CD generation, multi-target (Vercel, Railway, Render, AWS, GCP)
6. **Post-Launch & Evolution** — Monitoring, error triage, feature iteration

### Conversational Intelligence Engine
- Dynamic Question Tree (core IP) — each answer unlocks/modifies/eliminates subsequent questions
- Intent Analyzer: extracts app category, domain, complexity, implicit requirements
- Modeled after a senior tech lead, not a chatbot

### Multi-Model Orchestration Per Phase
Discovery uses reasoning models, code gen uses code-specialized models, testing uses analytical models, etc.

---

## 9. DATABASE SCHEMA (5 Domains)

**Identity:** `users`, `api_keys` (SHA-256 hashed), `sessions`, `teams`, `team_members`

**Financial (MOST CRITICAL):** `wallets`, `transactions` (immutable append-only), `pricing_rules`, `budget_limits`

**Model Registry:** `providers`, `models`, `provider_health_logs`

**Usage & Analytics:** `api_requests` (partitioned monthly), `usage_daily_rollups`, `routing_decisions`

**Drive:** `conversations`, `messages`, `drive_files`, `project_spaces`

### Key Decisions
- PostgreSQL 16+ with Row-Level Security (RLS) on all user tables
- Monthly partitioning on api_requests
- GIN indexes for full-text search; embedding similarity for context retrieval

---

## 10. FILE STRUCTURE

```
aicaffe/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # HTTP server + middleware
│   ├── config/               # Environment, constants, feature flags
│   ├── common/               # DB, cache, logging, errors, events, utils
│   ├── providers/            # PAL: interfaces, adapters, registry, health
│   ├── economy/              # Wallet, pricing, ledger, budget
│   ├── conductor/            # Classifier, scorer, router, feedback
│   ├── gateway/              # Middleware, routes, streaming
│   ├── auth/                 # JWT, API keys, OAuth/SSO, RBAC
│   ├── analytics/            # Usage logging, rollups, dashboards
│   ├── workshops/            # Engine + per-workshop modules
│   ├── drive/                # Persistence, search, context
│   └── workers/              # Background jobs
├── prisma/                   # Schema + migrations
├── tests/                    # Integration tests
├── scripts/                  # Utility scripts
├── docker/                   # Docker configs
├── .github/                  # CI/CD
├── config/task-keywords.json # Trie dictionary
├── package.json
├── tsconfig.json
└── .env.example
```

### Module Dependency DAG
`routes → services → common` | No circular dependencies allowed.

---

## 11. KEY ALGORITHMS

| Algorithm | Use | Performance |
|-----------|-----|-------------|
| Sliding Window Counter | Rate limiting | <2ms, Redis-backed |
| Weighted Keyword Trie | Task classification | <1ms, handles 80% of requests |
| Weighted Linear Combination | Model scoring | <3ms |
| Three-State Circuit Breaker | Provider resilience | Redis-backed, cross-pod |
| Optimistic Read / Pessimistic Write | Wallet operations | Reads <2ms, writes ACID |
| Exponential Moving Average | Provider health | Real-time, smoothed |
| Nightly Rollups | Analytics aggregation | Batch, incremental |
| PostgreSQL FTS + Embeddings | Drive search | GIN indexed |

---

## 12. SECURITY

- **Auth:** JWT (15min/7day), API keys (`aic_` prefix, bcrypt), OAuth 2.0 (SAML/OIDC)
- **RBAC:** Admin, Manager, User, Read-Only + department-level controls
- **Encryption:** AES-256-GCM at rest, TLS 1.3 in transit, secrets in KMS
- **Isolation:** PostgreSQL RLS on all user tables
- **Validation:** Zod schemas, CORS whitelisting, injection scanning

---

## 13. INFRASTRUCTURE

- Kubernetes auto-scaling (3-20 pods)
- PostgreSQL with read replicas (writes primary, reads replicas)
- Redis cluster (session cache separate from job queue)
- OpenTelemetry tracing, Grafana dashboards, PagerDuty alerts
- BullMQ event-driven architecture (analytics/audit never on hot path)

---

## 14. FREE PROVIDER STACK ($5 total initial cost)

**P0 Core (FREE):** Google AI Studio (Gemini 2.5 Pro/Flash), Groq (Llama 3.3/4), Mistral (Codestral)
**P1 Extended (FREE):** Cohere (RAG stack), OpenRouter (model comparison), Cerebras (fallback)
**P2 Trial Credits:** DeepSeek R1 (5M tokens), xAI Grok ($25/mo free), OpenAI ($5 credit), Anthropic ($5 credit)

---

## 15. COMPETITIVE POSITIONING (vs. Cursor)

**Adopt from Cursor:** Proprietary models, auto-routing default, speculative decoding, parallel tools, rules/memory, PLG, background agents.
**Don't copy:** Single-vertical focus, desktop-first, opaque pricing, 100% revenue on inference.
**AiCaffe advantages:** 22+ providers (vs ~5), multi-modal, non-dev audience, enterprise governance, transparent ACT pricing, API-first.

---

## 16. IMPLEMENTATION PRIORITIES FOR CLAUDE CODE

Build in this order:
1. Project scaffolding (dirs, tsconfig, package.json, Docker)
2. Common infrastructure (Prisma, Redis, logging, errors, events)
3. Provider Abstraction Layer (interface, 3 adapters, circuit breakers)
4. ACT Economy Engine (wallet, ledger, pricing, hold-debit-release)
5. API Gateway (auth, rate limiting, `/v1/chat/completions`)
6. Smart Conductor (trie classifier, scorer, router, fallbacks)
7. Workshop Engine (plugin architecture, Code Studio)
8. AiCaffe Drive (conversations, files, search)
9. Analytics (usage logging, rollups, dashboards)
10. Idea-to-Deployment Pipeline (Conversational Intelligence Engine, App Builder)

### Critical Rules
- All financial writes use DB transactions with row-level locking
- Redis is NEVER source of truth for financial/identity data
- Fail-open for rate limiting, fail-closed for budget guards
- No cache for transaction ledger (always fresh from PostgreSQL)
- Each provider adapter isolated with independent circuit breakers
- Streaming uses SSE with Hold → Debit → Release billing

---

## 17. CODE CONVENTIONS

- TypeScript strict mode, no `any` (except adapter boundaries)
- Constructor-based DI, JSDoc on public methods
- `AppError` subclasses, Zod env validation at startup
- No magic numbers (`config/constants.ts`)
- Pino structured JSON logging with requestId
- Git: `feature/`, `bugfix/`, `hotfix/` branches; conventional commits

---

*Place this file as `CLAUDE.md` in the project root. Update as new decisions are made.*
