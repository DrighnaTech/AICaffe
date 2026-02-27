"""
AiCaffe Database Setup Script
Runs in order:
  1. Creates the 'aicaffe' database if it doesn't exist
  2. Applies database/001_schema.sql (all tables, indexes, seed providers/use-cases)
  3. Seeds admin + user accounts with token wallets

Usage:
    npm run db:setup
    # or directly:
    python database/setup.py
"""

import asyncio
import os
import sys
import bcrypt
import asyncpg
from pathlib import Path
from dotenv import load_dotenv

# ── Load .env ────────────────────────────────────────────────────────────────
# This file lives in database/ — project root is one level up
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", 5432))
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME     = os.getenv("DB_NAME", "aicaffe")

SCHEMA_FILE = ROOT / "database" / "001_schema.sql"

ACCOUNTS = [
    {
        "email":       "admin@aicaffe.com",
        "password":    "Admin@1234",
        "full_name":   "AiCaffe Admin",
        "role":        "admin",
        "is_verified": True,
        "tokens":      5_000_000,
    },
    {
        "email":       "user@aicaffe.com",
        "password":    "User@1234",
        "full_name":   "Test User",
        "role":        "user",
        "is_verified": True,
        "tokens":      100_000,
    },
]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# ── Step 1: Create database ───────────────────────────────────────────────────

async def create_database():
    print(f"[1/3] Connecting to PostgreSQL as '{DB_USER}' ...")
    try:
        # Connect to default 'postgres' database to create our DB
        conn = await asyncpg.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASSWORD,
            database="postgres",
        )
    except Exception as e:
        print(f"  ERROR: Cannot connect to PostgreSQL — {e}")
        print(f"\n  Check that PostgreSQL is running and credentials are correct:")
        print(f"    Host    : {DB_HOST}:{DB_PORT}")
        print(f"    User    : {DB_USER}")
        print(f"    Password: {DB_PASSWORD}")
        sys.exit(1)

    # Check if DB exists
    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", DB_NAME
    )
    if exists:
        print(f"  Database '{DB_NAME}' already exists — skipping creation.")
    else:
        # CREATE DATABASE cannot run inside a transaction
        await conn.execute(f'CREATE DATABASE "{DB_NAME}"')
        print(f"  Created database '{DB_NAME}'.")

    await conn.close()


# ── Step 2: Apply schema ──────────────────────────────────────────────────────

async def apply_schema():
    print(f"\n[2/3] Applying schema from {SCHEMA_FILE.name} ...")
    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")

    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME,
    )

    # Check if tables already exist
    table_count = await conn.fetchval(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    if table_count and table_count > 0:
        print(f"  Schema already applied ({table_count} tables found) — skipping.")
        await conn.close()
        return

    try:
        await conn.execute(schema_sql)
        print(f"  Schema applied successfully.")
    except Exception as e:
        print(f"  ERROR applying schema: {e}")
        await conn.close()
        sys.exit(1)

    await conn.close()


# ── Step 3: Seed accounts ────────────────────────────────────────────────────

async def seed_accounts():
    print(f"\n[3/3] Seeding accounts ...")
    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME,
    )

    for account in ACCOUNTS:
        email = account["email"]
        password_hash = hash_password(account["password"])

        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", email)

        if existing:
            await conn.execute(
                """
                UPDATE users
                SET password_hash = $1, role = $2, is_active = TRUE, is_verified = $3
                WHERE id = $4
                """,
                password_hash, account["role"], account["is_verified"], existing["id"],
            )
            user_id = existing["id"]

            wallet = await conn.fetchrow(
                "SELECT id FROM token_wallets WHERE user_id = $1", user_id
            )
            if not wallet:
                await conn.execute(
                    "INSERT INTO token_wallets (user_id, balance, total_purchased, currency) VALUES ($1, $2, $2, 'ACT')",
                    user_id, account["tokens"],
                )
            print(f"  [UPDATED]  {account['role']:6s} | {email}")
        else:
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, password_hash, full_name, role, is_active, is_verified, auth_provider)
                VALUES ($1, $2, $3, $4, TRUE, $5, 'local') RETURNING id
                """,
                email, password_hash, account["full_name"], account["role"], account["is_verified"],
            )
            wallet_id = await conn.fetchval(
                "INSERT INTO token_wallets (user_id, balance, total_purchased, currency) VALUES ($1, $2, $2, 'ACT') RETURNING id",
                user_id, account["tokens"],
            )
            await conn.execute(
                """
                INSERT INTO token_transactions (wallet_id, user_id, transaction_type, token_amount, balance_before, balance_after, description)
                VALUES ($1, $2, 'bonus', $3, 0, $3, 'Setup: initial balance grant')
                """,
                wallet_id, user_id, account["tokens"],
            )
            print(f"  [CREATED]  {account['role']:6s} | {email} | {account['tokens']:,} ACT")

        print(f"             password : {account['password']}")

    await conn.close()


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 50)
    print("  AiCaffe Database Setup")
    print("=" * 50)
    print(f"  DB : {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}\n")

    await create_database()
    await apply_schema()
    await seed_accounts()

    print("\n" + "=" * 50)
    print("  Setup complete!")
    print("=" * 50)
    print("\n  Login credentials:")
    print("    Admin : admin@aicaffe.com  /  Admin@1234")
    print("    User  : user@aicaffe.com   /  User@1234\n")


if __name__ == "__main__":
    asyncio.run(main())
