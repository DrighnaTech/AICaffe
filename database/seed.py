"""
AiCaffe Database Seed Script
Creates super admin and first user accounts with token wallets.

Credentials:
  Super Admin : admin@aicaffe.com  / Admin@1234
  User        : user@aicaffe.com   / User@1234
"""

import asyncio
import os
import sys
import bcrypt
import asyncpg
from dotenv import load_dotenv

# Load .env from project root (two levels up from database/)
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 5432)),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
    "database": os.getenv("DB_NAME", "aicaffe"),
}

ACCOUNTS = [
    {
        "email":      "admin@aicaffe.com",
        "password":   "Admin@1234",
        "full_name":  "AiCaffe Admin",
        "role":       "admin",
        "is_verified": True,
        "tokens":     5_000_000,   # 5M ACT starting balance
    },
    {
        "email":      "user@aicaffe.com",
        "password":   "User@1234",
        "full_name":  "Test User",
        "role":       "user",
        "is_verified": True,
        "tokens":     100_000,     # 100K ACT starting balance
    },
]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


async def seed():
    print(f"Connecting to PostgreSQL at {DB_CONFIG['host']}:{DB_CONFIG['port']} ...")
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
    except Exception as e:
        print(f"ERROR: Could not connect to database — {e}")
        sys.exit(1)

    print("Connected.\n")

    for account in ACCOUNTS:
        email = account["email"]
        password_hash = hash_password(account["password"])

        # Check if already exists
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", email)

        if existing:
            # Reset password, role, and ensure active + verified
            await conn.execute(
                """
                UPDATE users
                SET password_hash = $1, role = $2, is_active = TRUE, is_verified = $3
                WHERE id = $4
                """,
                password_hash,
                account["role"],
                account["is_verified"],
                existing["id"],
            )
            user_id = existing["id"]
            print(f"  [UPDATED] {account['role']:10s} | {email} — password reset")

            # Ensure wallet exists; create if missing
            wallet = await conn.fetchrow(
                "SELECT id FROM token_wallets WHERE user_id = $1", user_id
            )
            if not wallet:
                await conn.fetchval(
                    """
                    INSERT INTO token_wallets (user_id, balance, total_purchased, currency)
                    VALUES ($1, $2, $2, 'ACT') RETURNING id
                    """,
                    user_id,
                    account["tokens"],
                )
        else:
            # Insert new user
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, password_hash, full_name, role, is_active, is_verified, auth_provider)
                VALUES ($1, $2, $3, $4, TRUE, $5, 'local')
                RETURNING id
                """,
                email,
                password_hash,
                account["full_name"],
                account["role"],
                account["is_verified"],
            )

            # Create token wallet
            wallet_id = await conn.fetchval(
                """
                INSERT INTO token_wallets (user_id, balance, total_purchased, currency)
                VALUES ($1, $2, $2, 'ACT')
                RETURNING id
                """,
                user_id,
                account["tokens"],
            )

            # Record the initial token transaction
            await conn.execute(
                """
                INSERT INTO token_transactions
                    (wallet_id, user_id, transaction_type, token_amount,
                     balance_before, balance_after, description)
                VALUES ($1, $2, 'bonus', $3, 0, $3, 'Seed: initial balance grant')
                """,
                wallet_id,
                user_id,
                account["tokens"],
            )

            print(f"  [CREATED] {account['role']:10s} | {email}")
            print(f"            tokens   : {account['tokens']:,} ACT")

        print(f"            password : {account['password']}")
        print(f"            user_id  : {user_id}\n")

    await conn.close()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
