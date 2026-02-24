-- ============================================================================
-- AICaffe Platform - Stripe Integration Migration
-- Version: 1.0.1
-- Description: Add Stripe payment fields for token purchases and subscriptions
-- ============================================================================

-- Add Stripe fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Create index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Payment sessions table to track Stripe checkout sessions
CREATE TABLE IF NOT EXISTS payment_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    type VARCHAR(50) NOT NULL CHECK (type IN ('token_purchase', 'subscription', 'one_time')),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    token_amount BIGINT,
    package_id UUID REFERENCES aicaffe_token_packages(id),
    plan VARCHAR(50),
    billing_cycle VARCHAR(20),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'refunded')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_user ON payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_stripe ON payment_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);

-- Add subscription_tokens column to track monthly token grants
ALTER TABLE token_transactions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);

-- Update token_transactions to support transfer types
ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;
ALTER TABLE token_transactions ADD CONSTRAINT token_transactions_transaction_type_check
    CHECK (transaction_type IN ('purchase', 'consumption', 'refund', 'bonus', 'transfer_in', 'transfer_out', 'expiry', 'subscription'));

-- Stripe webhook events log (for idempotency)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    payload JSONB NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_webhook_events(processed);

-- Subscription plans configuration table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    monthly_price_usd DECIMAL(10, 2) NOT NULL,
    yearly_price_usd DECIMAL(10, 2) NOT NULL,
    tokens_per_month BIGINT NOT NULL,
    stripe_price_monthly VARCHAR(255),
    stripe_price_yearly VARCHAR(255),
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed subscription plans
INSERT INTO subscription_plans (name, slug, description, monthly_price_usd, yearly_price_usd, tokens_per_month, features, sort_order) VALUES
('Starter', 'starter', 'Free tier for getting started', 0, 0, 10000,
 '["10K tokens/month", "Basic models", "Community support", "1 workspace"]'::jsonb, 1),
('Explorer', 'explorer', 'For individuals and small teams', 29, 290, 100000,
 '["100K tokens/month", "All models", "Priority support", "API access", "5 workspaces"]'::jsonb, 2),
('Builder', 'builder', 'For professional developers and teams', 99, 990, 500000,
 '["500K tokens/month", "All models", "24/7 support", "API access", "Unlimited workspaces", "Custom integrations"]'::jsonb, 3)
ON CONFLICT (slug) DO UPDATE SET
    monthly_price_usd = EXCLUDED.monthly_price_usd,
    yearly_price_usd = EXCLUDED.yearly_price_usd,
    tokens_per_month = EXCLUDED.tokens_per_month,
    features = EXCLUDED.features;

-- Payment history view
CREATE OR REPLACE VIEW payment_history AS
SELECT
    ps.id,
    ps.user_id,
    u.email as user_email,
    ps.type,
    ps.amount_cents / 100.0 as amount_usd,
    ps.token_amount,
    pkg.name as package_name,
    ps.plan,
    ps.status,
    ps.created_at,
    ps.completed_at
FROM payment_sessions ps
LEFT JOIN users u ON ps.user_id = u.id
LEFT JOIN aicaffe_token_packages pkg ON ps.package_id = pkg.id
ORDER BY ps.created_at DESC;
