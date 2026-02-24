# AICaffe - AI Marketplace Platform

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python" alt="Python" />
</div>

<br/>

**AICaffe** is a comprehensive SaaS platform that provides unified access to 100+ AI models from leading providers including OpenAI, Anthropic, Google, Meta, Mistral, and more. Built with a microservices architecture, it offers a seamless experience for both consumers and enterprise users.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Services Overview](#services-overview)
- [API Documentation](#api-documentation)
- [User Roles](#user-roles)
- [Token System](#token-system)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### For Consumers
- **AI Hub** - Unified interface to chat with any AI model
- **Smart Query** - Intelligent routing to the best model for your task
- **AI Assistant** - Persistent conversation history with multiple models
- **Model Explorer** - Browse, compare, and discover AI models
- **Recommendations** - AI-powered model suggestions based on your needs
- **CaffeSpace Storage** - Cloud storage for files, images, and documents
- **News Feed** - Latest AI industry news and updates
- **Token Wallet** - Pay-as-you-go with AICaffe Tokens (ACT)

### For Administrators
- **Admin Panel** - Complete platform management
- **Model Registry** - Add, configure, and manage AI models
- **User Management** - User administration and role assignment
- **Billing & Analytics** - Usage tracking, revenue analytics
- **API Key Management** - Generate and manage API keys
- **Agent Builder** - Create custom AI agents and workflows
- **AI Workspace** - Advanced development environment
- **Codespace** - Cloud-based IDE for AI development

### Platform Features
- **10+ AI Providers** - OpenAI, Anthropic, Google, Meta, Mistral, Cohere, AI21, Stability AI, Replicate, Hugging Face
- **100+ Models** - LLMs, Image Generation, Audio, Video, Embeddings, Code
- **Role-Based Access Control** - Consumer vs Admin experiences
- **Real-time Streaming** - Server-sent events for chat responses
- **Usage Metering** - Granular token tracking and billing
- **Multi-tenancy** - Organization and team support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard │ │ AI Hub   │ │ Models   │ │ Storage  │ │  Admin   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY (Port 8000)                        │
│              Authentication, Rate Limiting, Routing                  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│ Auth Service  │        │ Model Registry│        │ Token Service │
│  (Port 8001)  │        │  (Port 8002)  │        │  (Port 8003)  │
└───────────────┘        └───────────────┘        └───────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│ Recommendation│        │ News Aggregator│       │  AI Proxy     │
│  (Port 8004)  │        │  (Port 8005)  │        │  (Port 8006)  │
└───────────────┘        └───────────────┘        └───────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│Billing Service│        │Storage Service│        │  Workspace    │
│  (Port 8007)  │        │  (Port 8008)  │        │  (Port 8009)  │
└───────────────┘        └───────────────┘        └───────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│  Orchestrator │        │   Cloud IDE   │        │               │
│  (Port 8010)  │        │  (Port 8011)  │        │               │
└───────────────┘        └───────────────┘        └───────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │   PostgreSQL Database   │
                    │       (Port 5432)       │
                    └─────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 | React framework with App Router |
| TypeScript | Type-safe JavaScript |
| Tailwind CSS | Utility-first CSS framework |
| Framer Motion | Animation library |
| TanStack Query | Data fetching and caching |
| Zustand | State management |
| Lucide Icons | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | High-performance Python API framework |
| asyncpg | Async PostgreSQL driver |
| Pydantic | Data validation |
| JWT | Authentication tokens |
| bcrypt | Password hashing |
| httpx | Async HTTP client |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL 15+ | Primary database |
| UUID | Primary key generation |
| JSONB | Flexible data storage |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |

---

## Project Structure

```
AICaffe/
├── frontend/                    # Next.js 14 Frontend
│   ├── app/                     # App Router pages
│   │   ├── (auth)/              # Authentication pages
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/         # Protected dashboard pages
│   │   │   ├── admin/           # Admin-only pages
│   │   │   ├── agents/          # Agent builder
│   │   │   ├── ai-hub/          # Unified AI interface
│   │   │   ├── assistant/       # Chat assistant
│   │   │   ├── billing/         # Usage & billing
│   │   │   ├── codespace/       # Cloud IDE
│   │   │   ├── compare/         # Model comparison
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── models/          # Model catalog
│   │   │   ├── news/            # AI news feed
│   │   │   ├── recommendations/ # Model recommendations
│   │   │   ├── settings/        # User settings
│   │   │   ├── smart-query/     # Intelligent routing
│   │   │   ├── storage/         # CaffeSpace storage
│   │   │   ├── tokens/          # Token wallet
│   │   │   └── workspace/       # AI workspace
│   │   └── (public)/            # Public landing page
│   ├── components/              # React components
│   │   ├── layout/              # Layout components
│   │   ├── models/              # Model-related components
│   │   └── ui/                  # UI primitives
│   └── lib/                     # Utilities & API
│       ├── api.ts               # API client
│       ├── store.ts             # Zustand stores
│       ├── types.ts             # TypeScript types
│       └── utils.ts             # Helper functions
│
├── services/                    # Backend Microservices
│   ├── api-gateway/             # API Gateway (8000)
│   ├── auth-service/            # Authentication (8001)
│   ├── model-registry/          # Model catalog (8002)
│   ├── token-service/           # Token wallet (8003)
│   ├── recommendation-engine/   # AI recommendations (8004)
│   ├── news-aggregator/         # News feed (8005)
│   ├── ai-proxy-service/        # AI provider proxy (8006)
│   ├── billing-service/         # Usage & billing (8007)
│   ├── storage-service/         # File storage (8008)
│   ├── workspace-service/       # AI workspace (8009)
│   ├── orchestrator-service/    # Workflow orchestration (8010)
│   ├── cloud-ide/               # Cloud IDE (8011)
│   ├── shared/                  # Shared utilities
│   │   ├── config.py            # Configuration
│   │   └── database.py          # Database utilities
│   └── requirements.txt         # Python dependencies
│
├── database/                    # Database migrations
│   ├── 001_schema.sql           # Core schema
│   ├── 002_seed_models.sql      # AI models seed data
│   ├── 003_stripe_integration.sql
│   ├── 004_workspace_and_agents.sql
│   └── 005_cloud_ide.sql
│
├── docker/                      # Docker configuration
│   ├── Dockerfile.frontend
│   ├── Dockerfile.python
│   ├── docker-compose.yml
│   └── docker-compose.production.yml
│
├── scripts/                     # Utility scripts
│   └── start.sh                 # Start all services
│
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── ARCHITECTURE.md              # Architecture details
└── README.md                    # This file
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 15+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/AiCaffe.git
   cd AiCaffe
   ```

2. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb aicaffe

   # Run migrations
   psql aicaffe < database/001_schema.sql
   psql aicaffe < database/002_seed_models.sql
   psql aicaffe < database/003_stripe_integration.sql
   psql aicaffe < database/004_workspace_and_agents.sql
   psql aicaffe < database/005_cloud_ide.sql
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

5. **Install backend dependencies**
   ```bash
   cd services
   pip install -r requirements.txt
   ```

6. **Start the services**
   ```bash
   # Start all backend services
   ./scripts/start.sh

   # Start frontend (in a new terminal)
   cd frontend
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8000
   - API Docs: http://localhost:8000/docs

---

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **API Gateway** | 8000 | Central entry point, authentication, routing |
| **Auth Service** | 8001 | User authentication, JWT tokens, sessions |
| **Model Registry** | 8002 | AI model catalog, search, comparison |
| **Token Service** | 8003 | Token wallet, purchases, transactions |
| **Recommendation Engine** | 8004 | AI-powered model recommendations |
| **News Aggregator** | 8005 | AI news feed aggregation |
| **AI Proxy** | 8006 | Proxies requests to AI providers |
| **Billing Service** | 8007 | Usage tracking, invoices, analytics |
| **Storage Service** | 8008 | CaffeSpace file storage |
| **Workspace Service** | 8009 | AI workspace management |
| **Orchestrator** | 8010 | Workflow orchestration, agents |
| **Cloud IDE** | 8011 | Browser-based development environment |

---

## API Documentation

Each service provides OpenAPI documentation:

- API Gateway: http://localhost:8000/docs
- Auth Service: http://localhost:8001/docs
- Model Registry: http://localhost:8002/docs
- Token Service: http://localhost:8003/docs
- And so on...

### Key API Endpoints

#### Authentication
```
POST /api/v1/auth/register    # Register new user
POST /api/v1/auth/login       # Login and get JWT
GET  /api/v1/auth/me          # Get current user
POST /api/v1/auth/logout      # Logout
```

#### Models
```
GET  /api/v1/models           # List all models
GET  /api/v1/models/{id}      # Get model details
GET  /api/v1/models/leaderboard  # Model rankings
POST /api/v1/models/compare   # Compare models
```

#### Tokens
```
GET  /api/v1/tokens/wallet    # Get wallet balance
POST /api/v1/tokens/purchase  # Buy tokens
GET  /api/v1/tokens/transactions  # Transaction history
```

#### AI Chat
```
POST /api/v1/assistant/chat           # Send message
GET  /api/v1/assistant/conversations  # List conversations
POST /api/v1/ai/chat                  # Direct AI chat
POST /api/v1/smart-query              # Smart model routing
```

---

## User Roles

### Consumer (Regular User)
- Access to AI Hub, Assistant, Models, Storage
- Token wallet for pay-as-you-go usage
- Personal settings and preferences
- Cannot access admin features

### Admin
- Full access to all features
- Admin Panel for platform management
- API Key management
- Billing and analytics dashboard
- Agent Builder and Workspace
- User management

### Role Assignment
```sql
-- Promote user to admin
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

---

## Token System

AICaffe uses **AICaffe Tokens (ACT)** as the platform currency.

### Token Pricing
- **1 ACT = $0.001 USD**
- Minimum purchase: 1,000 ACT ($1.00)
- Bulk discounts available

### Token Consumption
Different models have different token costs based on:
- Provider pricing (OpenAI, Anthropic, etc.)
- Model capability (GPT-4 vs GPT-3.5)
- Input/output tokens used
- Platform markup (configurable)

### Example Rates
| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|-----------------|
| GPT-4 Turbo | 10,000 ACT | 30,000 ACT |
| Claude 3 Opus | 15,000 ACT | 75,000 ACT |
| Gemini Pro | 500 ACT | 1,500 ACT |

---

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=aicaffe

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage
STORAGE_PATH=/data/caffespace
MAX_FILE_SIZE_MB=100

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `organizations` - Multi-tenant organizations
- `ai_providers` - AI provider configurations
- `ai_models` - AI model catalog
- `token_wallets` - User token balances
- `token_transactions` - Transaction history
- `conversations` - Chat conversations
- `messages` - Chat messages
- `api_usage_logs` - API call tracking

### Key Relationships
```
users ─┬─► token_wallets (1:1)
       ├─► conversations (1:N)
       ├─► api_keys (1:N)
       └─► organizations (N:M)

ai_providers ─► ai_models (1:N)

conversations ─► messages (1:N)
```

---

## Deployment

### Docker Compose (Development)
```bash
cd docker
docker-compose up -d
```

### Docker Compose (Production)
```bash
cd docker
docker-compose -f docker-compose.production.yml up -d
```

### Manual Deployment
1. Set up PostgreSQL database
2. Run database migrations
3. Configure environment variables
4. Start each service with process manager (PM2, systemd)
5. Set up reverse proxy (nginx)
6. Configure SSL certificates

---

## Test Accounts

### Consumer Account
- **Email:** user@aicaffe.com
- **Password:** User@123456
- **Role:** user

### Admin Account
- **Email:** admin@aicaffe.com
- **Password:** Admin@123456
- **Role:** admin

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Support

For support, email support@aicaffe.com or join our Discord community.

---

<div align="center">
  <strong>Built with ❤️ by AICaffe Team</strong>
  <br/>
  <sub>Powered by Claude AI</sub>
</div>
