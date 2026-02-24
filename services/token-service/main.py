"""
AICaffe Token Service - Universal token system, wallet management, and exchange rates
Handles ACT (AICaffe Token) currency, pricing calculations, and consumption tracking
"""
from fastapi import FastAPI, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import os
import uuid

app = FastAPI(title="AICaffe Token Service", version="1.0.0")

# Constants
MARGIN_PERCENTAGE = Decimal(os.getenv("PLATFORM_MARGIN", "20.00"))  # 20% margin on all AI vendor costs
TOKENS_PER_USD = int(os.getenv("TOKENS_PER_USD", "20000"))  # 1 USD = 20,000 AICaffe Tokens (ACT)

# ── Schemas ────────────────────────────────────────────────────────

class WalletResponse(BaseModel):
    id: str
    balance: int
    total_purchased: int
    total_consumed: int
    balance_usd_equivalent: float
    currency: str = "ACT"

class PurchaseTokensRequest(BaseModel):
    package_id: Optional[str] = None
    custom_amount: Optional[int] = None
    payment_method: str = "stripe"

class TokenExchangeCalc(BaseModel):
    model_id: str
    input_tokens: int = 0
    output_tokens: int = 0
    images: int = 0
    audio_minutes: float = 0
    video_seconds: float = 0

class TokenExchangeResult(BaseModel):
    model_name: str
    provider_name: str
    provider_cost_usd: float
    margin_usd: float
    total_cost_usd: float
    aicaffe_tokens_needed: int
    breakdown: dict

class TransferTokensRequest(BaseModel):
    to_user_id: str
    amount: int = Field(gt=0)
    note: Optional[str] = None

class TransactionHistory(BaseModel):
    id: str
    transaction_type: str
    token_amount: int
    balance_after: int
    model_name: Optional[str]
    description: Optional[str]
    created_at: datetime

# ── Database (Singleton) ───────────────────────────────────────────

import asyncpg

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            database=os.getenv("DB_NAME", "aicaffe"),
            min_size=2,
            max_size=10,
        )
    return _pool

@app.on_event("shutdown")
async def shutdown():
    global _pool
    if _pool:
        await _pool.close()

# ── Auth Helpers ───────────────────────────────────────────────────

def get_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> str:
    """
    Extract user_id from query param or X-User-ID header (injected by API Gateway).
    The API Gateway extracts user_id from JWT and injects it.
    """
    resolved_user_id = user_id or x_user_id
    if not resolved_user_id:
        raise HTTPException(
            status_code=401,
            detail="User authentication required. Please login."
        )
    return resolved_user_id

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "token-service"}

# ── Wallet Management ──────────────────────────────────────────────

@app.get("/api/v1/tokens/wallet")
async def get_wallet(user_id: str = Depends(get_user_id)):
    """Get user's token wallet"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        wallet = await conn.fetchrow(
            "SELECT * FROM token_wallets WHERE user_id = $1", user_id
        )
        if not wallet:
            # Auto-create wallet for new users with welcome bonus
            wallet_id = str(uuid.uuid4())
            welcome_bonus = 10000  # 10,000 ACT welcome bonus
            await conn.execute(
                """INSERT INTO token_wallets (id, user_id, balance, total_purchased, total_consumed, currency)
                   VALUES ($1, $2, $3, 0, 0, 'ACT')""",
                wallet_id, user_id, welcome_bonus
            )
            wallet = await conn.fetchrow(
                "SELECT * FROM token_wallets WHERE user_id = $1", user_id
            )

        return {
            "wallet": {
                "id": str(wallet["id"]),
                "user_id": str(wallet["user_id"]),
                "balance": wallet["balance"],
                "total_purchased": wallet["total_purchased"],
                "total_consumed": wallet["total_consumed"],
                "currency": wallet["currency"],
                "balance_usd_equivalent": round(float(wallet["balance"]) / TOKENS_PER_USD, 2),
            }
        }

# ── Token Packages ─────────────────────────────────────────────────

@app.get("/api/v1/tokens/packages")
async def list_packages():
    """List available token packages (public endpoint)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        packages = await conn.fetch(
            """SELECT *,
                      ROUND(price_usd / token_amount * 1000000, 2) as price_per_million,
                      token_amount + FLOOR(token_amount * bonus_percentage / 100) as total_tokens
               FROM aicaffe_token_packages
               WHERE is_active = TRUE
               ORDER BY price_usd"""
        )
        return {"packages": [dict(p) for p in packages]}

# ── Purchase Tokens ────────────────────────────────────────────────

@app.post("/api/v1/tokens/purchase")
async def purchase_tokens(
    request: PurchaseTokensRequest,
    user_id: str = Depends(get_user_id)
):
    """Purchase AICaffe tokens"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get wallet
            wallet = await conn.fetchrow(
                "SELECT * FROM token_wallets WHERE user_id = $1 FOR UPDATE", user_id
            )
            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")

            if request.package_id:
                package = await conn.fetchrow(
                    "SELECT * FROM aicaffe_token_packages WHERE id = $1 AND is_active = TRUE",
                    request.package_id
                )
                if not package:
                    raise HTTPException(status_code=404, detail="Package not found")
                token_amount = int(package["token_amount"] * (1 + float(package["bonus_percentage"]) / 100))
                price = float(package["price_usd"])
            elif request.custom_amount:
                token_amount = request.custom_amount
                price = round(token_amount / TOKENS_PER_USD, 2)
            else:
                raise HTTPException(status_code=400, detail="Specify package_id or custom_amount")

            # Record purchase
            purchase_id = str(uuid.uuid4())
            await conn.execute(
                """INSERT INTO token_purchases (id, wallet_id, user_id, package_id, token_amount, amount_paid_usd, payment_method, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')""",
                purchase_id, str(wallet["id"]), user_id, request.package_id,
                token_amount, price, request.payment_method
            )

            # Update wallet
            new_balance = wallet["balance"] + token_amount
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
                tx_id, str(wallet["id"]), user_id, token_amount,
                wallet["balance"], new_balance, f"Purchased {token_amount} ACT tokens"
            )

            return {
                "purchase_id": purchase_id,
                "tokens_added": token_amount,
                "amount_paid": price,
                "new_balance": new_balance,
                "balance_usd": round(new_balance / TOKENS_PER_USD, 2),
            }

# ── Token Exchange Calculator ──────────────────────────────────────

@app.post("/api/v1/tokens/calculate")
async def calculate_exchange(request: TokenExchangeCalc):
    """Calculate how many AICaffe tokens needed for a specific model usage (public)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.name as provider_name
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1""",
            request.model_id
        )
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")

        breakdown = {}
        total_provider_cost = Decimal("0")

        # Text tokens
        if request.input_tokens > 0 and model["input_price_per_million"]:
            input_cost = Decimal(str(request.input_tokens)) * model["input_price_per_million"] / Decimal("1000000")
            breakdown["input_tokens"] = {
                "count": request.input_tokens,
                "rate_per_million": float(model["input_price_per_million"]),
                "cost_usd": round(float(input_cost), 6),
            }
            total_provider_cost += input_cost

        if request.output_tokens > 0 and model["output_price_per_million"]:
            output_cost = Decimal(str(request.output_tokens)) * model["output_price_per_million"] / Decimal("1000000")
            breakdown["output_tokens"] = {
                "count": request.output_tokens,
                "rate_per_million": float(model["output_price_per_million"]),
                "cost_usd": round(float(output_cost), 6),
            }
            total_provider_cost += output_cost

        if request.images > 0 and model["image_price_per_unit"]:
            img_cost = Decimal(str(request.images)) * model["image_price_per_unit"]
            breakdown["images"] = {
                "count": request.images,
                "rate_per_unit": float(model["image_price_per_unit"]),
                "cost_usd": round(float(img_cost), 6),
            }
            total_provider_cost += img_cost

        if request.audio_minutes > 0 and model["audio_price_per_minute"]:
            audio_cost = Decimal(str(request.audio_minutes)) * model["audio_price_per_minute"]
            breakdown["audio"] = {
                "minutes": request.audio_minutes,
                "rate_per_minute": float(model["audio_price_per_minute"]),
                "cost_usd": round(float(audio_cost), 6),
            }
            total_provider_cost += audio_cost

        margin = total_provider_cost * MARGIN_PERCENTAGE / Decimal("100")
        total_cost = total_provider_cost + margin
        act_tokens_needed = int(total_cost * TOKENS_PER_USD) + 1  # Round up

        return {
            "model_name": model["name"],
            "provider_name": model["provider_name"],
            "provider_cost_usd": round(float(total_provider_cost), 6),
            "margin_percentage": float(MARGIN_PERCENTAGE),
            "margin_usd": round(float(margin), 6),
            "total_cost_usd": round(float(total_cost), 6),
            "aicaffe_tokens_needed": act_tokens_needed,
            "breakdown": breakdown,
            "exchange_rate": f"1 USD = {TOKENS_PER_USD} ACT",
        }

# ── Multi-Model Cost Comparison ────────────────────────────────────

@app.post("/api/v1/tokens/compare-costs")
async def compare_costs(
    model_ids: List[str],
    input_tokens: int = 1000,
    output_tokens: int = 500,
):
    """Compare costs across multiple models for same usage (public)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        results = []
        for mid in model_ids:
            model = await conn.fetchrow(
                """SELECT m.*, p.name as provider_name
                   FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
                   WHERE m.id = $1""",
                mid
            )
            if model:
                input_cost = float(model["input_price_per_million"] or 0) * input_tokens / 1000000
                output_cost = float(model["output_price_per_million"] or 0) * output_tokens / 1000000
                provider_cost = input_cost + output_cost
                margin = provider_cost * float(MARGIN_PERCENTAGE) / 100
                total = provider_cost + margin
                results.append({
                    "model_id": mid,
                    "model_name": model["name"],
                    "provider": model["provider_name"],
                    "provider_cost_usd": round(provider_cost, 6),
                    "margin_usd": round(margin, 6),
                    "total_cost_usd": round(total, 6),
                    "act_tokens": int(total * TOKENS_PER_USD) + 1,
                })

        results.sort(key=lambda x: x["total_cost_usd"])
        cheapest = results[0]["model_name"] if results else None
        return {
            "comparison": results,
            "cheapest": cheapest,
            "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
        }

# ── Consume Tokens (called by AI Proxy) ───────────────────────────

@app.post("/api/v1/tokens/consume")
async def consume_tokens(
    user_id: str,
    model_id: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    api_call_id: Optional[str] = None,
):
    """Deduct tokens from wallet for API usage (internal endpoint called by AI Proxy)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            wallet = await conn.fetchrow(
                "SELECT * FROM token_wallets WHERE user_id = $1 FOR UPDATE", user_id
            )
            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")

            model = await conn.fetchrow("SELECT * FROM ai_models WHERE id = $1", model_id)
            if not model:
                raise HTTPException(status_code=404, detail="Model not found")

            # Calculate cost
            provider_cost = (
                float(model["input_price_per_million"] or 0) * input_tokens / 1000000 +
                float(model["output_price_per_million"] or 0) * output_tokens / 1000000
            )
            margin = provider_cost * float(MARGIN_PERCENTAGE) / 100
            total_cost = provider_cost + margin
            act_tokens = int(total_cost * TOKENS_PER_USD) + 1

            if wallet["balance"] < act_tokens:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "message": "Insufficient tokens",
                        "required": act_tokens,
                        "available": wallet["balance"],
                        "shortfall": act_tokens - wallet["balance"],
                    }
                )

            new_balance = wallet["balance"] - act_tokens
            await conn.execute(
                """UPDATE token_wallets SET balance = $1, total_consumed = total_consumed + $2
                   WHERE id = $3""",
                new_balance, act_tokens, wallet["id"]
            )

            tx_id = str(uuid.uuid4())
            await conn.execute(
                """INSERT INTO token_transactions
                   (id, wallet_id, user_id, transaction_type, token_amount, balance_before, balance_after,
                    model_id, api_call_id, provider_cost_usd, margin_usd, description)
                   VALUES ($1, $2, $3, 'consumption', $4, $5, $6, $7, $8, $9, $10, $11)""",
                tx_id, str(wallet["id"]), user_id, -act_tokens,
                wallet["balance"], new_balance, model_id, api_call_id,
                round(provider_cost, 6), round(margin, 6),
                f"Used {model['name']}: {input_tokens}in/{output_tokens}out tokens"
            )

            return {
                "transaction_id": tx_id,
                "tokens_charged": act_tokens,
                "new_balance": new_balance,
                "provider_cost_usd": round(provider_cost, 6),
                "margin_usd": round(margin, 6),
            }

# ── Transaction History ────────────────────────────────────────────

@app.get("/api/v1/tokens/transactions")
async def get_transactions(
    user_id: str = Depends(get_user_id),
    transaction_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Get token transaction history"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        conditions = ["t.user_id = $1"]
        params = [user_id]
        idx = 2

        if transaction_type:
            conditions.append(f"t.transaction_type = ${idx}")
            params.append(transaction_type)
            idx += 1

        where = " AND ".join(conditions)
        offset = (page - 1) * page_size
        params.extend([page_size, offset])

        transactions = await conn.fetch(
            f"""SELECT t.*, m.name as model_name
                FROM token_transactions t
                LEFT JOIN ai_models m ON t.model_id = m.id
                WHERE {where}
                ORDER BY t.created_at DESC
                LIMIT ${idx} OFFSET ${idx + 1}""",
            *params
        )

        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM token_transactions t WHERE {where}",
            *params[:idx-1]
        )

        return {
            "transactions": [dict(t) for t in transactions],
            "total": total,
            "page": page,
        }

# ── Transfer Tokens ────────────────────────────────────────────────

@app.post("/api/v1/tokens/transfer")
async def transfer_tokens(
    request: TransferTokensRequest,
    user_id: str = Depends(get_user_id)
):
    """Transfer tokens to another user"""
    if user_id == request.to_user_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get sender wallet
            sender_wallet = await conn.fetchrow(
                "SELECT * FROM token_wallets WHERE user_id = $1 FOR UPDATE", user_id
            )
            if not sender_wallet:
                raise HTTPException(status_code=404, detail="Sender wallet not found")

            if sender_wallet["balance"] < request.amount:
                raise HTTPException(status_code=400, detail="Insufficient balance")

            # Get receiver wallet
            receiver_wallet = await conn.fetchrow(
                "SELECT * FROM token_wallets WHERE user_id = $1 FOR UPDATE", request.to_user_id
            )
            if not receiver_wallet:
                raise HTTPException(status_code=404, detail="Receiver wallet not found")

            # Deduct from sender
            sender_new_balance = sender_wallet["balance"] - request.amount
            await conn.execute(
                "UPDATE token_wallets SET balance = $1 WHERE id = $2",
                sender_new_balance, sender_wallet["id"]
            )

            # Add to receiver
            receiver_new_balance = receiver_wallet["balance"] + request.amount
            await conn.execute(
                "UPDATE token_wallets SET balance = $1 WHERE id = $2",
                receiver_new_balance, receiver_wallet["id"]
            )

            # Record transactions
            transfer_id = str(uuid.uuid4())

            await conn.execute(
                """INSERT INTO token_transactions
                   (id, wallet_id, user_id, transaction_type, token_amount, balance_before, balance_after, description)
                   VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, $7)""",
                str(uuid.uuid4()), str(sender_wallet["id"]), user_id, -request.amount,
                sender_wallet["balance"], sender_new_balance,
                f"Transfer to {request.to_user_id}: {request.note or 'No note'}"
            )

            await conn.execute(
                """INSERT INTO token_transactions
                   (id, wallet_id, user_id, transaction_type, token_amount, balance_before, balance_after, description)
                   VALUES ($1, $2, $3, 'transfer_in', $4, $5, $6, $7)""",
                str(uuid.uuid4()), str(receiver_wallet["id"]), request.to_user_id, request.amount,
                receiver_wallet["balance"], receiver_new_balance,
                f"Transfer from {user_id}: {request.note or 'No note'}"
            )

            return {
                "transfer_id": transfer_id,
                "amount": request.amount,
                "from_user": user_id,
                "to_user": request.to_user_id,
                "new_balance": sender_new_balance,
            }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
