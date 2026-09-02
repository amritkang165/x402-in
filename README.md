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
├── docs/                   # ARCHITECTURE.md, API_SPEC.md, PITCH_SCRIPT.md
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

### Start services (3 terminals)

**Terminal 1 — Central gateway (buyer + registry + settlement + theatre):**
```bash
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Merchant agents:**
```bash
source venv/bin/activate
# Rahul's Pottery on 8001
python -m backend.merchant_agent.standalone --port 8001 --config backend/merchant_agent/merchant.yaml
# Sneha's Candles on 8002 (optional, for multi-merchant negotiation)
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
# Meera's Spice Emporium — plain text -> LLM -> structured catalog -> validated
python -m backend.merchant_agent.standalone --port 8003 \
  --config backend/merchant_agent/merchant_llm.yaml --llm
```

Then register it in `scripts/seed_registry.py` (add its `endpoint_url` on port
8003) and re-seed. The LLM proposes the catalog and list prices; deterministic
code in `backend/merchant_agent/catalog.py` **clamps every price to the
merchant's floor** (`floor_prices_paise` in the YAML) and rejects invalid
items. The LLM never controls the final sale price — the negotiator enforces
floors.

Open http://localhost:5173 — type a need (e.g. "2 mugs" with budget Rs. 600),
watch the deal appear, then click **Buy**. Use budget Rs. 400 to see the
merchant **reject** the deal (guardrail demo). View the audit chain at
**Negotiation Theatre**.

## Configuration (.env)

Copy `.env.example` to `.env`. Without Razorpay keys the app runs in **mock
mode** (simulated payment via `POST /webhooks/mock/notify`). Set
`RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to switch to **real test payments**:

1. `/buyer/approve` creates a Razorpay **payment link** (server-side amount
   only, idempotency-keyed by `session_id:offer_id` so retries never duplicate).
2. The frontend opens the secure checkout in a new tab.
3. Razorpay's webhook fires at `/webhooks/razorpay` → signature verified →
   `processed_webhooks` table deduplicates events → session marked `PAID`.

Both `payment` and `payment_link` webhook payload shapes are parsed; sessions
are matched by `order_id` or `payment_link_id`. Secrets never reach the
frontend — the backend alone determines the amount.

## API Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/buyer/search` | Submit buyer intent; async discovery + negotiation |
| GET | `/buyer/session/{id}` | Session status, offers, result |
| POST | `/buyer/approve/{id}` | Human approval → settlement. Requires a per-session `buyer_token` returned by `/buyer/search` (ownership proof) |
| GET | `/buyer/session/{id}/audit` | Audit chain |
| GET | `/buyer/session/{id}/audit/verify` | Recompute + verify hashes |
| POST | `/registry/register` | Merchant registers itself |
| GET | `/registry/list` · `/registry/search` | Registry queries |
| WS | `/ws/theatre/{session_id}` | Real-time theatre feed (use `/ws/theatre/*` for all sessions) |
| POST | `/webhooks/razorpay` | Real Razorpay payment event (signature-verified, idempotent) |
| POST | `/webhooks/mock/notify` | Simulated payment for mock mode |
| GET | `/acp/catalog` · `/acp/negotiate` · `/acp/settle` | Merchant agent endpoints |

Interactive API docs: http://localhost:8000/docs

## Verified Behavior

- Bundle discounts apply only to eligible items (single-item bundles; real combos require every listed item).
- Floor prices are never violated; budget below floor → **REJECT** with reasoning.
- Inventory reservations prevent overselling during concurrent negotiations.
- Offer expiry + server-side amount prevent stale/altered payments.
- Approval is gated by a per-session secret (`buyer_token`, issued at search,
  constant-time compared) so only the initiating buyer can settle a session.
- Webhooks are signature-verified and idempotent (`processed_webhooks` persisted).
- Every action enters a SHA-256 hash chain; `verify` recomputes and detects tampering.
- **Live Theatre:** real-time WebSocket feed broadcasts every negotiation step
  (`SESSION_STARTED` → `DISCOVERY` → `NEGOTIATION` per merchant → `OFFER_STORED` →
  `SETTLEMENT_INITIATED` → `PAYMENT_CAPTURED`). The Theatre connects to
  `/ws/theatre/*`, auto-reconnects, and deduplicates events by id.
