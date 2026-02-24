# AICaffe Platform - Complete Architecture Document

## Executive Summary

AICaffe is a comprehensive AI Marketplace and Intelligence Platform that provides a unified interface for discovering, comparing, and using AI models from 22+ providers. The platform features universal token-based billing (20% margin), intelligent model recommendations, a unified chat assistant, and real-time AI news aggregation.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Marketplace│ │ Compare  │ │Assistant │ │   News   │ │  Tokens  │ │
│  │   Page    │ │   Page   │ │   Chat   │ │   Feed   │ │  Wallet  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                    State: Zustand | Data: React Query               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (FastAPI :8000)                      │
│              Rate Limiting | Auth | Routing | CORS                   │
└──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────────────┘
       │      │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│ Auth ││Model ││Token ││Recom-││ News ││  AI  ││Bill- │
│ Svc  ││Regis-││ Svc  ││mend ││Aggre-││Proxy ││ing   │
│:8001 ││try   ││:8003 ││Engine││gator ││ Svc  ││ Svc  │
│      ││:8002 ││      ││:8004 ││:8005 ││:8006 ││:8007 │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
   │       │       │       │       │       │       │
   └───────┴───────┴───────┴───────┴───────┴───┬───┘
                                               │
                       ┌───────────────────────┐│┌──────────────────┐
                       │   PostgreSQL 16       │││    Redis 7       │
                       │   (Primary DB)        │││  (Cache/Queue)   │
                       └───────────────────────┘│└──────────────────┘
                                               │
                    ┌──────────────────────────┐│
                    │    AI Provider APIs       ││
                    │  OpenAI | Anthropic |     ││
                    │  Google | Meta | Mistral  ││
                    │  + 17 more providers      ││
                    └──────────────────────────┘│
                                               │
                    ┌──────────────────────────┐│
                    │    Payment Gateway        ││
                    │    Stripe / Razorpay      ││
                    └──────────────────────────┘│
```

---

## Microservices Breakdown

### 1. API Gateway (Port 8000)
- Central routing and load balancing
- JWT authentication middleware
- Rate limiting and request tracking
- CORS management
- Health check aggregation

### 2. Auth Service (Port 8001)
- User registration and login (email/password + OAuth)
- JWT token generation and validation
- API key management for programmatic access
- Password management and profile updates
- Organization management

### 3. Model Registry (Port 8002)
- AI model catalog with 200+ models from 22+ providers
- Advanced filtering (type, price, speed, context window, benchmarks)
- Side-by-side model comparison (2-5 models)
- Model leaderboards by various metrics
- User reviews and ratings
- Pricing tiers and feature tracking

### 4. Token Service (Port 8003)
- Universal token wallet (AICaffe Tokens - ACT)
- Token packages and purchasing
- Real-time exchange rate calculation
- Token consumption and deduction
- Multi-model cost comparison
- Transaction history

### 5. Recommendation Engine (Port 8004)
- Intent detection from natural language
- Use case categorization (10 categories, 21+ use cases)
- Multi-factor scoring (quality, speed, cost, relevance)
- Priority-based recommendations (speed/quality/cost/balanced)
- Quick recommendation by purpose description
- Feedback loop for improving recommendations

### 6. News Aggregator (Port 8005)
- 12+ news source integration
- Category and tag-based filtering
- Breaking news and trending detection
- Daily digest generation
- Provider-specific news tracking
- Article bookmarking

### 7. AI Proxy Service (Port 8006)
- Unified API for 22+ AI providers
- Provider-specific adapters (OpenAI, Anthropic, Google, etc.)
- Automatic response normalization
- Conversation management with model switching
- Token billing integration
- Error handling and retry logic

### 8. Billing Service (Port 8007)
- Stripe checkout integration
- Usage analytics and spending reports
- Invoice generation
- Vendor settlement calculation (80/20 split)
- Revenue analytics dashboard

---

## Database Schema Overview

### Core Tables (11 groups, 25+ tables)

| Group | Tables | Purpose |
|-------|--------|---------|
| Users | organizations, users, api_keys | Authentication & access |
| Models | ai_providers, ai_models, model_features, model_pricing_tiers, model_comparisons | AI model catalog |
| Use Cases | use_case_categories, use_cases, model_use_case_scores, recommendations_log | Recommendation engine |
| Tokens | aicaffe_token_packages, token_wallets, token_purchases, token_exchange_rates, token_transactions | Universal billing |
| API Calls | api_calls | Usage tracking |
| Conversations | conversations, messages | AI Assistant |
| News | news_sources, news_articles, news_bookmarks | News aggregation |
| Reviews | model_reviews | User ratings |
| Credentials | provider_credentials | Provider API keys |
| Billing | vendor_settlements, invoices | Financial operations |
| Analytics | usage_analytics, platform_metrics | Business intelligence |

---

## Token Economics

### Exchange Rate
- **1 USD = 20,000 AICaffe Tokens (ACT)**
- **20% platform margin** on all AI vendor costs
- Transparent pricing visible to users

### Token Flow
```
User Purchases ACT → Wallet Balance Increases
    ↓
User Makes API Call → Token Service Calculates Cost
    ↓
Provider Cost × 1.20 (20% margin) → ACT Tokens Deducted
    ↓
80% goes to AI vendor → 20% platform revenue
```

### Token Packages
| Package | Tokens | Price | Per-Million Rate |
|---------|--------|-------|-----------------|
| Starter | 100K | $5 | $50.00 |
| Basic | 500K | $20 | $40.00 |
| Pro | 2M | $70 | $35.00 |
| Business | 10M | $300 | $30.00 |
| Enterprise | 50M | $1,200 | $24.00 |

---

## AI Providers (22+ Integrated)

| Provider | Slug | Models | Speciality |
|----------|------|--------|-----------|
| OpenAI | openai | GPT-4o, DALL-E 3, Whisper | General AI, Images |
| Anthropic | anthropic | Claude Opus/Sonnet/Haiku | Safety-focused LLM |
| Google DeepMind | google | Gemini 2.0, Imagen | Multimodal |
| Meta AI | meta | Llama 3.3 | Open Source LLM |
| Mistral AI | mistral | Mistral Large, Codestral | Efficient LLMs |
| Cohere | cohere | Command R+ | Enterprise NLP |
| Stability AI | stability | Stable Diffusion 3 | Image Generation |
| Hugging Face | huggingface | Open models | Model Hub |
| Amazon Bedrock | aws-bedrock | Multi-provider | Managed Service |
| Azure AI | azure-ai | GPT-4 via Azure | Enterprise |
| Perplexity | perplexity | Sonar | AI Search |
| xAI | xai | Grok-2 | Reasoning |
| Replicate | replicate | Open models | Cloud Inference |
| Together AI | together | Open models | Fast Inference |
| Groq | groq | LPU Inference | Ultra-fast |
| DeepSeek | deepseek | DeepSeek V3 | Efficient |
| AI21 Labs | ai21 | Jamba | Enterprise |
| Runway | runway | Gen-3 Alpha | Video Generation |
| ElevenLabs | elevenlabs | Voice AI | Speech Synthesis |
| Midjourney | midjourney | Midjourney v6 | Image Art |
| Suno | suno | Suno v4 | Music Generation |
| Qwen (Alibaba) | qwen | Qwen 2.5 | Chinese + English |

---

## Tech Stack

### Backend
- **Language**: Python 3.12
- **Framework**: FastAPI (async)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **ORM**: asyncpg (raw SQL for performance)
- **Auth**: JWT + bcrypt
- **HTTP Client**: httpx (async)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **State**: Zustand (global) + React Query (server)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **UI**: Radix UI primitives
- **Animations**: Framer Motion

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes-ready
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Payments**: Stripe

---

## API Endpoints Summary

### Auth (`/api/v1/auth/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /register | Create account |
| POST | /login | Authenticate |
| GET | /me | Current user |
| PUT | /me | Update profile |
| POST | /api-keys | Generate API key |
| GET | /api-keys | List API keys |

### Models (`/api/v1/models/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | List/filter models |
| GET | /{id} | Model details |
| POST | /compare | Compare 2-5 models |
| GET | /leaderboard | Rankings |
| GET | /{id}/reviews | Model reviews |
| POST | /{id}/reviews | Submit review |

### Tokens (`/api/v1/tokens/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /wallet | Wallet balance |
| GET | /packages | Token packages |
| POST | /purchase | Buy tokens |
| POST | /calculate | Cost calculator |
| POST | /compare-costs | Multi-model costs |
| GET | /transactions | History |

### Recommendations (`/api/v1/recommendations/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /use-cases | List use cases |
| POST | /recommend | Detailed recommendation |
| POST | /quick | Quick recommendation |

### Assistant (`/api/v1/assistant/` + `/api/v1/chat/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /chat/completions | Unified chat API |
| POST | /conversations | Create conversation |
| GET | /conversations | List conversations |
| GET | /conversations/{id} | Get with messages |
| PUT | /conversations/{id}/model | Switch model |

### News (`/api/v1/news/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /feed | News feed with filters |
| GET | /trending | Trending stories |
| GET | /breaking | Breaking news |
| GET | /daily-digest | AI digest |
| GET | /provider/{slug} | Provider news |

### Billing (`/api/v1/billing/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /usage | Spending summary |
| GET | /invoices | Invoice list |
| POST | /checkout | Stripe checkout |
| GET | /analytics/revenue | Revenue analytics |

---

## Getting Started

```bash
# 1. Clone and setup
git clone https://github.com/datacaffe/aicaffe-platform.git
cd aicaffe-platform

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start all services
cd docker
docker-compose up -d

# 4. Access the platform
# Frontend: http://localhost:3000
# API Gateway: http://localhost:8000
# API Docs: http://localhost:8000/docs
# PgAdmin: http://localhost:5050 (dev profile)
```

---

## Revenue Model

```
Revenue = Total API Calls × Average Cost × 20% Margin

Monthly projections (at scale):
- 1M API calls/day × avg $0.002/call = $2,000/day provider cost
- Platform revenue = $2,000 × 20% = $400/day
- Monthly revenue = ~$12,000/month at 1M calls/day
- At 10M calls/day = ~$120,000/month
```

---

*Built by DataCaffe.ai | AICaffe Platform v1.0.0*
