#!/bin/bash
# ============================================================================
# AICaffe Platform - Quick Start Script
# ============================================================================

set -e

echo "🚀 Starting AICaffe Platform..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required. Install from https://docker.com"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required."; exit 1; }

# Setup env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your API keys before using AI features."
fi

# Start services
echo "🐳 Starting Docker containers..."
cd docker
docker compose up -d

echo ""
echo "✅ AICaffe Platform is starting!"
echo ""
echo "🌐 Frontend:     http://localhost:3000"
echo "🔌 API Gateway:  http://localhost:8000"
echo "📖 API Docs:     http://localhost:8000/docs"
echo "🗄️  PgAdmin:      http://localhost:5050 (dev only: docker compose --profile dev up pgadmin)"
echo ""
echo "📊 Services:"
echo "   Auth:          http://localhost:8001/health"
echo "   Models:        http://localhost:8002/health"
echo "   Tokens:        http://localhost:8003/health"
echo "   Recommend:     http://localhost:8004/health"
echo "   News:          http://localhost:8005/health"
echo "   AI Proxy:      http://localhost:8006/health"
echo "   Billing:       http://localhost:8007/health"
echo ""
echo "To stop: cd docker && docker compose down"
