"""
AICaffe Billing Service - Payment processing, invoicing, and vendor settlements
Stripe integration for token purchases and subscription management
20% margin on all AI vendor costs
"""
from fastapi import FastAPI, HTTPException, Request, Header, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import os
import uuid
import json
import stripe

app = FastAPI(title="AICaffe Billing Service", version="1.0.0")

MARGIN_PERCENTAGE = Decimal("20.00")
TOKENS_PER_USD = int(os.getenv("TOKENS_PER_USD", "20000"))

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ── Schemas ────────────────────────────────────────────────────────

class CreateCheckoutRequest(BaseModel):
    package_id: Optional[str] = None
    custom_token_amount: Optional[int] = None
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class SubscriptionCheckoutRequest(BaseModel):
    plan: str  # 'starter', 'explorer', 'builder'
    billing_cycle: str = "monthly"  # 'monthly' or 'yearly'

class CustomerPortalRequest(BaseModel):
    return_url: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    period_start: date
    period_end: date
    total_usd: float
    status: str
    line_items: list

class VendorSettlementResponse(BaseModel):
    provider_name: str
    period: str
    total_api_calls: int
    total_provider_cost: float
    total_revenue: float
    margin: float
    status: str

class UsageSummary(BaseModel):
    total_spent_act: int
    total_spent_usd: float
    total_api_calls: int
    top_models: List[dict]
    daily_usage: List[dict]

# ── Database (Singleton Pool) ───────────────────────────────────────

import asyncpg

class Database:
    """Database interface - singleton connection pool"""
    _pool = None

    @classmethod
    async def get_pool(cls):
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", 5432)),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "postgres"),
                database=os.getenv("DB_NAME", "aicaffe"),
                min_size=2,
                max_size=10,
            )
        return cls._pool

    @classmethod
    async def close_pool(cls):
        if cls._pool:
            await cls._pool.close()
            cls._pool = None

db = Database()

async def get_pool():
    return await db.get_pool()

# ── Auth Helpers ───────────────────────────────────────────────────

def get_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> str:
    """Extract user_id from query param or X-User-ID header (injected by API Gateway)."""
    resolved_user_id = user_id or x_user_id
    if not resolved_user_id:
        raise HTTPException(status_code=401, detail="User authentication required.")
    return resolved_user_id

def get_optional_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> Optional[str]:
    """Optional user_id extraction."""
    return user_id or x_user_id

# ── Stripe Helpers ─────────────────────────────────────────────────

async def get_or_create_stripe_customer(user_id: str, email: str = None) -> str:
    """Get existing or create new Stripe customer for user."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Check for existing customer
        record = await conn.fetchrow(
            "SELECT stripe_customer_id FROM users WHERE id = $1", user_id
        )

        if record and record["stripe_customer_id"]:
            return record["stripe_customer_id"]

        # Get user email if not provided
        if not email:
            user = await conn.fetchrow("SELECT email FROM users WHERE id = $1", user_id)
            email = user["email"] if user else f"user_{user_id}@aicaffe.ai"

        # Create Stripe customer
        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id}
        )

        # Store customer ID
        await conn.execute(
            "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
            customer.id, user_id
        )

        return customer.id

# ── Subscription Plans Config ──────────────────────────────────────

SUBSCRIPTION_PLANS = {
    "starter": {
        "name": "Starter",
        "monthly_price": 0,
        "yearly_price": 0,
        "tokens_per_month": 10000,
        "features": ["10K tokens/month", "Basic models", "Email support"]
    },
    "explorer": {
        "name": "Explorer",
        "monthly_price": 29,
        "yearly_price": 290,  # ~17% discount
        "tokens_per_month": 100000,
        "stripe_price_monthly": os.getenv("STRIPE_EXPLORER_MONTHLY_PRICE_ID", ""),
        "stripe_price_yearly": os.getenv("STRIPE_EXPLORER_YEARLY_PRICE_ID", ""),
        "features": ["100K tokens/month", "All models", "Priority support", "API access"]
    },
    "builder": {
        "name": "Builder",
        "monthly_price": 99,
        "yearly_price": 990,  # ~17% discount
        "tokens_per_month": 500000,
        "stripe_price_monthly": os.getenv("STRIPE_BUILDER_MONTHLY_PRICE_ID", ""),
        "stripe_price_yearly": os.getenv("STRIPE_BUILDER_YEARLY_PRICE_ID", ""),
        "features": ["500K tokens/month", "All models", "24/7 support", "API access", "Custom integrations"]
    }
}

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "billing"}

@app.get("/api/v1/billing/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    plans = []
    for plan_id, plan_data in SUBSCRIPTION_PLANS.items():
        plans.append({
            "id": plan_id,
            "name": plan_data["name"],
            "monthly_price": plan_data["monthly_price"],
            "yearly_price": plan_data["yearly_price"],
            "tokens_per_month": plan_data["tokens_per_month"],
            "features": plan_data["features"],
        })
    return {"plans": plans}

# ── Stripe Checkout ────────────────────────────────────────────────

@app.post("/api/v1/billing/checkout")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    user_id: str = Depends(get_user_id),
    x_user_email: Optional[str] = Header(None, alias="X-User-Email")
):
    """Create a Stripe checkout session for token purchase"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if request.package_id:
            package = await conn.fetchrow(
                "SELECT * FROM aicaffe_token_packages WHERE id = $1 AND is_active = TRUE",
                request.package_id
            )
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")
            amount_cents = int(float(package["price_usd"]) * 100)
            token_amount = int(package["token_amount"] * (1 + float(package["bonus_percentage"]) / 100))
            product_name = f"AICaffe {package['name']}"
            description = f"{package['token_amount']:,} ACT Tokens + {package['bonus_percentage']}% bonus"
        elif request.custom_token_amount:
            price = request.custom_token_amount / TOKENS_PER_USD
            amount_cents = int(price * 100)
            if amount_cents < 100:  # Minimum $1
                raise HTTPException(status_code=400, detail="Minimum purchase is $1 (20,000 ACT)")
            token_amount = request.custom_token_amount
            product_name = "AICaffe Custom Tokens"
            description = f"{request.custom_token_amount:,} ACT Tokens"
        else:
            raise HTTPException(status_code=400, detail="Specify package_id or custom_token_amount")

        success_url = request.success_url or f"{FRONTEND_URL}/tokens?success=true&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = request.cancel_url or f"{FRONTEND_URL}/tokens?cancelled=true"

        # Create Stripe checkout session
        if STRIPE_SECRET_KEY:
            try:
                # Get or create Stripe customer
                stripe_customer_id = await get_or_create_stripe_customer(user_id, x_user_email)

                session = stripe.checkout.Session.create(
                    customer=stripe_customer_id,
                    payment_method_types=["card"],
                    line_items=[{
                        "price_data": {
                            "currency": "usd",
                            "unit_amount": amount_cents,
                            "product_data": {
                                "name": product_name,
                                "description": description,
                                "images": [f"{FRONTEND_URL}/logo.png"],
                            },
                        },
                        "quantity": 1,
                    }],
                    mode="payment",
                    success_url=success_url,
                    cancel_url=cancel_url,
                    metadata={
                        "user_id": user_id,
                        "package_id": request.package_id or "",
                        "token_amount": str(token_amount),
                        "type": "token_purchase"
                    },
                    payment_intent_data={
                        "metadata": {
                            "user_id": user_id,
                            "token_amount": str(token_amount)
                        }
                    }
                )

                # Record pending purchase
                purchase_id = str(uuid.uuid4())
                await conn.execute(
                    """INSERT INTO payment_sessions
                       (id, user_id, stripe_session_id, type, amount_cents, token_amount, status, created_at)
                       VALUES ($1, $2, $3, 'token_purchase', $4, $5, 'pending', NOW())
                       ON CONFLICT DO NOTHING""",
                    purchase_id, user_id, session.id, amount_cents, token_amount
                )

                return {
                    "checkout_session_id": session.id,
                    "checkout_url": session.url,
                    "amount_usd": amount_cents / 100,
                    "token_amount": token_amount,
                    "description": description,
                }

            except stripe.error.StripeError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            # Test mode without Stripe
            checkout_id = str(uuid.uuid4())
            return {
                "checkout_session_id": checkout_id,
                "checkout_url": f"{FRONTEND_URL}/tokens?test_checkout={checkout_id}&tokens={token_amount}",
                "amount_usd": amount_cents / 100,
                "token_amount": token_amount,
                "description": description,
                "test_mode": True,
            }

@app.post("/api/v1/billing/checkout/subscription")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    user_id: str = Depends(get_user_id),
    x_user_email: Optional[str] = Header(None, alias="X-User-Email")
):
    """Create a Stripe checkout session for subscription"""
    plan = SUBSCRIPTION_PLANS.get(request.plan)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {request.plan}")

    if request.plan == "starter":
        # Starter is free - just update user's subscription
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE users SET subscription_plan = 'starter', subscription_status = 'active'
                   WHERE id = $1""",
                user_id
            )
        return {"message": "Subscribed to Starter plan", "plan": "starter"}

    price_id = plan.get(f"stripe_price_{request.billing_cycle}")
    if not price_id:
        raise HTTPException(status_code=400, detail="Stripe price not configured for this plan")

    if not STRIPE_SECRET_KEY:
        return {
            "test_mode": True,
            "message": f"Would subscribe to {plan['name']} ({request.billing_cycle})",
            "price": plan[f"{request.billing_cycle}_price"],
        }

    try:
        stripe_customer_id = await get_or_create_stripe_customer(user_id, x_user_email)

        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/billing?cancelled=true",
            metadata={
                "user_id": user_id,
                "plan": request.plan,
                "billing_cycle": request.billing_cycle,
                "type": "subscription"
            }
        )

        return {
            "checkout_session_id": session.id,
            "checkout_url": session.url,
            "plan": request.plan,
            "billing_cycle": request.billing_cycle,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/billing/portal")
async def create_customer_portal(
    request: CustomerPortalRequest,
    user_id: str = Depends(get_user_id)
):
    """Create a Stripe Customer Portal session for subscription management"""
    if not STRIPE_SECRET_KEY:
        return {"test_mode": True, "message": "Stripe not configured"}

    pool = await get_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow(
            "SELECT stripe_customer_id FROM users WHERE id = $1", user_id
        )

        if not record or not record["stripe_customer_id"]:
            raise HTTPException(status_code=400, detail="No billing account found. Make a purchase first.")

        try:
            session = stripe.billing_portal.Session.create(
                customer=record["stripe_customer_id"],
                return_url=request.return_url or f"{FRONTEND_URL}/billing"
            )
            return {"portal_url": session.url}
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/billing/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if STRIPE_WEBHOOK_SECRET and sig_header:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # For testing without webhook signature verification
        event = json.loads(payload)

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Handle checkout.session.completed
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(conn, data)

        # Handle subscription events
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(conn, data)

        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(conn, data)

        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(conn, data)

        # Handle payment events
        elif event_type == "invoice.paid":
            await handle_invoice_paid(conn, data)

        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(conn, data)

    return {"received": True}

async def handle_checkout_completed(conn, session):
    """Handle successful checkout"""
    metadata = session.get("metadata", {})
    user_id = metadata.get("user_id")
    checkout_type = metadata.get("type")

    if not user_id:
        return

    if checkout_type == "token_purchase":
        token_amount = int(metadata.get("token_amount", 0))
        if token_amount > 0:
            # Credit tokens to user's wallet
            await credit_user_tokens(conn, user_id, token_amount, session.get("id"))

    # Update payment session status
    await conn.execute(
        """UPDATE payment_sessions SET status = 'completed', completed_at = NOW()
           WHERE stripe_session_id = $1""",
        session.get("id")
    )

async def handle_subscription_created(conn, subscription):
    """Handle new subscription"""
    customer_id = subscription.get("customer")
    plan_id = subscription.get("items", {}).get("data", [{}])[0].get("price", {}).get("id")

    # Find user by Stripe customer ID
    user = await conn.fetchrow(
        "SELECT id FROM users WHERE stripe_customer_id = $1", customer_id
    )
    if not user:
        return

    # Determine plan from price ID
    plan = "explorer"  # Default
    for plan_name, plan_data in SUBSCRIPTION_PLANS.items():
        if plan_data.get("stripe_price_monthly") == plan_id or plan_data.get("stripe_price_yearly") == plan_id:
            plan = plan_name
            break

    await conn.execute(
        """UPDATE users SET
              subscription_plan = $1,
              subscription_status = 'active',
              stripe_subscription_id = $2,
              subscription_period_end = to_timestamp($3)
           WHERE id = $4""",
        plan, subscription.get("id"),
        subscription.get("current_period_end"),
        user["id"]
    )

    # Credit monthly tokens
    tokens_to_add = SUBSCRIPTION_PLANS[plan]["tokens_per_month"]
    await credit_user_tokens(conn, user["id"], tokens_to_add, f"subscription_{subscription.get('id')}")

async def handle_subscription_updated(conn, subscription):
    """Handle subscription update (upgrade/downgrade)"""
    customer_id = subscription.get("customer")
    status = subscription.get("status")

    user = await conn.fetchrow(
        "SELECT id FROM users WHERE stripe_customer_id = $1", customer_id
    )
    if not user:
        return

    await conn.execute(
        """UPDATE users SET
              subscription_status = $1,
              subscription_period_end = to_timestamp($2)
           WHERE id = $3""",
        status, subscription.get("current_period_end"), user["id"]
    )

async def handle_subscription_deleted(conn, subscription):
    """Handle subscription cancellation"""
    customer_id = subscription.get("customer")

    user = await conn.fetchrow(
        "SELECT id FROM users WHERE stripe_customer_id = $1", customer_id
    )
    if not user:
        return

    await conn.execute(
        """UPDATE users SET
              subscription_plan = 'starter',
              subscription_status = 'cancelled',
              stripe_subscription_id = NULL
           WHERE id = $1""",
        user["id"]
    )

async def handle_invoice_paid(conn, invoice):
    """Handle successful invoice payment (subscription renewal)"""
    customer_id = invoice.get("customer")
    subscription_id = invoice.get("subscription")

    if not subscription_id:
        return  # One-time payment, not subscription

    user = await conn.fetchrow(
        "SELECT id, subscription_plan FROM users WHERE stripe_customer_id = $1", customer_id
    )
    if not user:
        return

    # Credit monthly tokens for subscription renewal
    plan = user["subscription_plan"] or "explorer"
    if plan in SUBSCRIPTION_PLANS:
        tokens_to_add = SUBSCRIPTION_PLANS[plan]["tokens_per_month"]
        await credit_user_tokens(conn, user["id"], tokens_to_add, f"renewal_{invoice.get('id')}")

async def handle_payment_failed(conn, invoice):
    """Handle failed payment"""
    customer_id = invoice.get("customer")

    user = await conn.fetchrow(
        "SELECT id FROM users WHERE stripe_customer_id = $1", customer_id
    )
    if not user:
        return

    await conn.execute(
        "UPDATE users SET subscription_status = 'past_due' WHERE id = $1",
        user["id"]
    )

async def credit_user_tokens(conn, user_id: str, token_amount: int, reference: str):
    """Credit tokens to user's wallet"""
    # Get or create wallet
    wallet = await conn.fetchrow(
        "SELECT * FROM token_wallets WHERE user_id = $1 FOR UPDATE", user_id
    )

    if not wallet:
        wallet_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO token_wallets (id, user_id, balance, total_purchased, total_consumed, currency)
               VALUES ($1, $2, $3, $4, 0, 'ACT')""",
            wallet_id, user_id, token_amount, token_amount
        )
        balance_before = 0
        new_balance = token_amount
        wallet_id = wallet_id
    else:
        balance_before = wallet["balance"]
        new_balance = balance_before + token_amount
        wallet_id = str(wallet["id"])
        await conn.execute(
            """UPDATE token_wallets SET balance = $1, total_purchased = total_purchased + $2
               WHERE id = $3""",
            new_balance, token_amount, wallet["id"]
        )

    # Record transaction
    tx_id = str(uuid.uuid4())
    await conn.execute(
        """INSERT INTO token_transactions
           (id, wallet_id, user_id, transaction_type, token_amount, balance_before, balance_after, description)
           VALUES ($1, $2, $3, 'purchase', $4, $5, $6, $7)""",
        tx_id, wallet_id, user_id, token_amount, balance_before, new_balance,
        f"Stripe payment: {reference}"
    )

# ── Verify Payment ─────────────────────────────────────────────────

@app.get("/api/v1/billing/verify/{session_id}")
async def verify_payment(session_id: str, user_id: str = Depends(get_user_id)):
    """Verify a checkout session status"""
    if not STRIPE_SECRET_KEY:
        return {"status": "test_mode", "verified": True}

    try:
        session = stripe.checkout.Session.retrieve(session_id)

        if session.metadata.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Session does not belong to this user")

        return {
            "status": session.payment_status,
            "verified": session.payment_status == "paid",
            "token_amount": int(session.metadata.get("token_amount", 0)),
            "amount_paid": session.amount_total / 100 if session.amount_total else 0,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Usage & Spending ───────────────────────────────────────────────

@app.get("/api/v1/billing/usage")
async def get_usage(
    user_id: str = Depends(get_user_id),
    period: str = "month",  # 'day', 'week', 'month', 'year'
):
    """Get usage and spending summary"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        interval = {"day": "1 day", "week": "7 days", "month": "30 days", "year": "365 days"}.get(period, "30 days")

        # Total spending
        totals = await conn.fetchrow(
            f"""SELECT
                    COALESCE(SUM(ABS(token_amount)), 0) as total_tokens,
                    COALESCE(SUM(provider_cost_usd), 0) as total_provider_cost,
                    COALESCE(SUM(margin_usd), 0) as total_margin,
                    COUNT(*) as total_transactions
                FROM token_transactions
                WHERE user_id = $1 AND transaction_type = 'consumption'
                AND created_at > NOW() - INTERVAL '{interval}'""",
            user_id
        )

        # Top models by usage
        top_models = await conn.fetch(
            f"""SELECT m.name, m.model_type, p.name as provider,
                       COUNT(*) as calls, SUM(ABS(t.token_amount)) as tokens_spent,
                       SUM(t.provider_cost_usd) as cost_usd
                FROM token_transactions t
                JOIN ai_models m ON t.model_id = m.id
                JOIN ai_providers p ON m.provider_id = p.id
                WHERE t.user_id = $1 AND t.transaction_type = 'consumption'
                AND t.created_at > NOW() - INTERVAL '{interval}'
                GROUP BY m.name, m.model_type, p.name
                ORDER BY tokens_spent DESC
                LIMIT 10""",
            user_id
        )

        # Daily breakdown
        daily = await conn.fetch(
            f"""SELECT DATE(created_at) as date,
                       SUM(ABS(token_amount)) as tokens,
                       SUM(provider_cost_usd + margin_usd) as cost_usd,
                       COUNT(*) as api_calls
                FROM token_transactions
                WHERE user_id = $1 AND transaction_type = 'consumption'
                AND created_at > NOW() - INTERVAL '{interval}'
                GROUP BY DATE(created_at)
                ORDER BY date""",
            user_id
        )

        return {
            "period": period,
            "summary": {
                "total_act_spent": int(totals["total_tokens"]),
                "total_usd_spent": round(float(totals["total_provider_cost"]) + float(totals["total_margin"]), 2),
                "provider_costs": round(float(totals["total_provider_cost"]), 2),
                "platform_margin": round(float(totals["total_margin"]), 2),
                "margin_percentage": float(MARGIN_PERCENTAGE),
                "total_api_calls": totals["total_transactions"],
            },
            "top_models": [dict(m) for m in top_models],
            "daily_breakdown": [dict(d) for d in daily],
        }

# ── Invoices ───────────────────────────────────────────────────────

@app.get("/api/v1/billing/invoices")
async def list_invoices(user_id: str = Depends(get_user_id), page: int = 1, page_size: int = 10):
    pool = await get_pool()
    async with pool.acquire() as conn:
        offset = (page - 1) * page_size
        invoices = await conn.fetch(
            """SELECT * FROM invoices
               WHERE user_id = $1 OR organization_id IN (SELECT organization_id FROM users WHERE id = $1)
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3""",
            user_id, page_size, offset
        )
        return {"invoices": [dict(i) for i in invoices]}

@app.get("/api/v1/billing/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        invoice = await conn.fetchrow("SELECT * FROM invoices WHERE id = $1", invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return {"invoice": dict(invoice)}

# ── Vendor Settlements (Admin) ─────────────────────────────────────

@app.get("/api/v1/billing/settlements")
async def list_settlements(status: Optional[str] = None, page: int = 1, page_size: int = 10):
    """List vendor settlements (admin endpoint)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        conditions = ["1=1"]
        params = []
        idx = 1
        if status:
            conditions.append(f"vs.status = ${idx}")
            params.append(status)
            idx += 1

        offset = (page - 1) * page_size
        params.extend([page_size, offset])

        settlements = await conn.fetch(
            f"""SELECT vs.*, p.name as provider_name
                FROM vendor_settlements vs
                JOIN ai_providers p ON vs.provider_id = p.id
                WHERE {" AND ".join(conditions)}
                ORDER BY vs.period_end DESC
                LIMIT ${idx} OFFSET ${idx + 1}""",
            *params
        )
        return {"settlements": [dict(s) for s in settlements]}

@app.post("/api/v1/billing/settlements/generate")
async def generate_settlement(provider_slug: str, period_start: date, period_end: date):
    """Generate vendor settlement for a billing period"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        provider = await conn.fetchrow(
            "SELECT * FROM ai_providers WHERE slug = $1", provider_slug
        )
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        # Calculate totals from API calls
        totals = await conn.fetchrow(
            """SELECT
                    COUNT(*) as total_calls,
                    COALESCE(SUM(provider_cost_usd), 0) as total_provider_cost,
                    COALESCE(SUM(margin_usd), 0) as total_margin,
                    COALESCE(SUM(provider_cost_usd + margin_usd), 0) as total_revenue
               FROM api_calls ac
               JOIN ai_models m ON ac.model_id = m.id
               WHERE m.provider_id = $1 AND ac.status = 'completed'
               AND ac.created_at BETWEEN $2 AND $3""",
            provider["id"], period_start, period_end
        )

        settlement_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO vendor_settlements
               (id, provider_id, period_start, period_end, total_api_calls,
                total_provider_cost_usd, total_revenue_usd, margin_usd, margin_percentage,
                amount_due_to_provider, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'calculated')""",
            settlement_id, provider["id"], period_start, period_end,
            totals["total_calls"], float(totals["total_provider_cost"]),
            float(totals["total_revenue"]), float(totals["total_margin"]),
            float(MARGIN_PERCENTAGE), float(totals["total_provider_cost"])
        )

        return {
            "settlement_id": settlement_id,
            "provider": provider["name"],
            "period": f"{period_start} to {period_end}",
            "total_api_calls": totals["total_calls"],
            "total_revenue_usd": round(float(totals["total_revenue"]), 2),
            "provider_cost_usd": round(float(totals["total_provider_cost"]), 2),
            "platform_margin_usd": round(float(totals["total_margin"]), 2),
            "margin_percentage": f"{MARGIN_PERCENTAGE}%",
            "amount_due_to_provider": round(float(totals["total_provider_cost"]), 2),
        }

# ── Revenue Analytics (Admin) ─────────────────────────────────────

@app.get("/api/v1/billing/analytics/revenue")
async def revenue_analytics(days: int = 30):
    """Platform revenue analytics (admin)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        daily_revenue = await conn.fetch(
            f"""SELECT DATE(created_at) as date,
                       SUM(provider_cost_usd) as provider_costs,
                       SUM(margin_usd) as margin,
                       SUM(provider_cost_usd + margin_usd) as revenue,
                       COUNT(*) as transactions
                FROM api_calls
                WHERE status = 'completed' AND created_at > NOW() - INTERVAL '{days} days'
                GROUP BY DATE(created_at)
                ORDER BY date"""
        )
        totals = await conn.fetchrow(
            f"""SELECT
                    SUM(provider_cost_usd) as total_provider_costs,
                    SUM(margin_usd) as total_margin,
                    SUM(provider_cost_usd + margin_usd) as total_revenue,
                    COUNT(*) as total_calls,
                    COUNT(DISTINCT user_id) as unique_users
                FROM api_calls
                WHERE status = 'completed' AND created_at > NOW() - INTERVAL '{days} days'"""
        )
        provider_breakdown = await conn.fetch(
            f"""SELECT p.name, SUM(ac.provider_cost_usd) as cost,
                       SUM(ac.margin_usd) as margin, COUNT(*) as calls
                FROM api_calls ac
                JOIN ai_models m ON ac.model_id = m.id
                JOIN ai_providers p ON m.provider_id = p.id
                WHERE ac.status = 'completed' AND ac.created_at > NOW() - INTERVAL '{days} days'
                GROUP BY p.name ORDER BY cost DESC"""
        )
        return {
            "period_days": days,
            "totals": dict(totals) if totals else {},
            "daily_revenue": [dict(d) for d in daily_revenue],
            "provider_breakdown": [dict(p) for p in provider_breakdown],
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
