# x402-IN — Agentic Commerce Protocol Gateway

**Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce**

> **AI proposes. Rules decide. Humans authorize money.**

A working MVP of an **agent-to-agent commerce protocol** with Razorpay as the
settlement layer. AI agents discover merchants, negotiate within deterministic
guardrails, and prepare transactions — humans only approve the final payment.

## Three Surfaces

| Surface | What It Is |
|---------|-----------|
| **Merchant Agent** | Headless FastAPI server that exposes a machine-readable storefront (`/acp/catalog`, `/acp/negotiate`, `/acp/settle`) and enforces floor prices, stock, and bundles |
| **Buyer Agent** | Runs on the central server; discovers merchants from a registry and runs parallel async negotiations, picking the best deal |
| **Negotiation Theatre** | React dashboard showing agent negotiations **live** over WebSocket, plus the persisted hash-chained audit trail with a "Verify Chain" integrity check |

## Core Principle

- **AI proposes:** The merchant's catalog is machine-readable; discovery + negotiation are protocol-driven. With an OpenAI key, a merchant's **plain-English inventory** is automatically structured into a machine-readable catalog.
- **Rules decide:** Deterministic code enforces floor prices, bundle eligibility, stock limits, round caps, and offer expiry. The LLM never controls money.
- **Humans authorize money:** The buyer approves one click; the backend determines the exact amount server-side.

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, httpx, plain SQLite (stdlib)
- **Frontend:** React 18 + TypeScript + Tailwind + Vite
- **Settlement:** Razorpay (real keys) **or** built-in mock mode (no keys needed)
- **Audit:** SHA-256 hash chain persisted to SQLite, verifiable by recomputation

## Project Structure

```
x402-in/
├── backend/
│   ├── main.py              # Central gateway (buyer + registry + settlement + theatre)
│   ├── config.py            # Settings + env vars
│   ├── core/                # Pydantic models, SQLite, audit hash chain
│   ├── protocol/            # Protocol envelope + versioning
│   ├── merchant_agent/      # Standalone merchant servers (agent, catalog, router, YAML configs)
│   ├── buyer_agent/         # Discovery + parallel negotiation + approve
│   ├── offers/              # Offer persistence + expiry
│   ├── settlement/          # Payment link creation + webhooks (mock/real)
│   ├── registry/            # Merchant directory
│   └── theatre/             # WebSocket live feed + sessions list
├── frontend/                # React + Vite buyer page and theatre
├── scripts/                 # start_merchant, start_buyer, seed_registry, dev.sh
└── requirements.txt
```

## Quick Start

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

### Start services

**Terminal 1 — Central gateway (buyer + registry + settlement + theatre):**
```bash
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Merchant agents:**
```bash
source venv/bin/activate
python -m backend.merchant_agent.standalone --port 8001 --config backend/merchant_agent/merchant.yaml
python -m backend.merchant_agent.standalone --port 8002 --config backend/merchant_agent/merchant_candles.yaml
```

**Terminal 3 — Register merchants in the registry:**
```bash
source venv/bin/activate
python scripts/seed_registry.py
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm run dev
```

### LLM catalog builder (optional)

With `OPENAI_API_KEY` set in `.env`, a merchant can run purely from a
**plain-English inventory** instead of a hand-written structured catalog:

```bash
python -m backend.merchant_agent.standalone --port 8003 \
  --config backend/merchant_agent/merchant_llm.yaml --llm
```

The LLM proposes the catalog and list prices; deterministic code in
`backend/merchant_agent/catalog.py` clamps every price to the merchant's floor
(`floor_prices_paise` in the YAML) and rejects invalid items. The LLM never
controls the final sale price — the negotiator enforces floors.

Open http://localhost:5173 — type a need (e.g. "2 mugs" with budget Rs. 600),
watch the deal appear, then click **Buy**. View the audit chain at
**Negotiation Theatre**.

## Payments

By default the app runs in **mock mode**: approving an offer returns a fake
`mock://` payment link and `POST /webhooks/mock/notify` marks the session
`PAID`. Set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in `.env` to switch to
**real Razorpay payment links**; Razorpay's webhook then marks the session
`PAID` automatically.

## Verified Behavior

- Bundle discounts apply only to eligible items (single-item bundles; real combos require every listed item).
- Floor prices are never violated; budget below floor → **REJECT** with reasoning.
- Inventory reservations prevent overselling during concurrent negotiations.
- Offer expiry + server-side amounts prevent stale/altered payments.
- Every action enters a SHA-256 hash chain; `verify` recomputes and detects tampering.
- **Live Theatre:** real-time WebSocket feed broadcasts every negotiation step, auto-reconnects, and deduplicates events by id.
