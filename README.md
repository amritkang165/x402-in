# x402-IN — Agentic Commerce Protocol Gateway

**Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce**

> **AI proposes. Rules decide. Humans authorize money.**

An MVP of an agent-to-agent commerce protocol with Razorpay as the settlement
layer. Agents discover merchants, negotiate within deterministic guardrails,
and prepare transactions — humans only approve the final payment.

## Three Surfaces

| Surface | What It Is |
|---------|-----------|
| **Merchant Agent** | Headless FastAPI server exposing a machine-readable storefront (`/acp/catalog`, `/acp/negotiate`, `/acp/settle`) with floor prices, stock, and bundles |
| **Buyer Agent** | Runs on the gateway; discovers merchants from a registry and runs parallel async negotiations, picking the best deal |
| **Negotiation Theatre** | React dashboard for live negotiations over WebSocket plus a hash-chained audit trail with integrity verification |

## Tech Stack

- Backend: Python, FastAPI, Pydantic v2, httpx, SQLite (stdlib)
- Frontend: React + TypeScript + Tailwind + Vite
- Settlement: Razorpay (real keys) or built-in mock mode (no keys needed)
- Audit: SHA-256 hash chain persisted and verifiable by recomputation

## Core Principle

- **AI proposes:** machine-readable catalogs; discovery + negotiation are protocol-driven.
- **Rules decide:** deterministic code enforces floor prices, bundles, stock, rounds, and expiry.
- **Humans authorize money:** the buyer approves one click; the backend computes the amount server-side.
