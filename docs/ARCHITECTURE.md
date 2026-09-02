# x402-IN Architecture

> **AI proposes. Rules decide. Humans authorize money.**

x402-IN is an **agent-to-agent commerce protocol gateway**. AI agents discover
merchants, negotiate within deterministic guardrails, and prepare
transactions. A human only authorizes the final payment, which settles through
Razorpay (or a deterministic mock in local dev).

Protocol name/version: `x402-in` / `0.1.0`.

---

## 1. System Context

Three logical surfaces, one central gateway:

```
                    ┌──────────────────────────────────────────────┐
                    │            CENTRAL GATEWAY (FastAPI)         │
                    │  :8000                                       │
                    │                                              │
   React / Vite ───▶│  buyer_agent ──▶ registry ──▶ merchant ACP   │
   (:5173)          │        │              │                      │
                    │        ▼              ▼                      │
                    │  offers  ◀─ settlement ◀─ razorpay_client    │
                    │              │            │                  │
                    │              ▼            ▼                  │
                    │        webhooks (mock/real)                  │
                    │        core: SQLite + audit hash chain       │
                    │        theatre: WebSocket live feed          │
   WS /ws/theatre ─▶│                                              │
                    └──────────────────────────────────────────────┘
                                      │  HTTP (httpx, async)
                                      ▼
                    ┌──────────────────────────────────────────────┐
                    │   MERCHANT AGENTS (N × FastAPI, standalone)  │
                    │   :8001  Rahul's Pottery    (YAML catalog)   │
                    │   :8002  Sneha's Candles    (YAML catalog)   │
                    │   :8003  Meera's Spices     (LLM-built cat.) │
                    │   /acp/catalog  /acp/negotiate  /acp/settle  │
                    └──────────────────────────────────────────────┘
```

**Mock vs real settlement.** Settlement is a thin abstraction over
`create_payment_link`. Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` the app
runs in **mock mode** (`mock://pay/...` links + `POST /webhooks/mock/notify`);
with keys it issues real Razorpay payment links and verifies webhook
signatures. The decision is made at call time (`is_mock()` reads config
dynamically), so the whole stack works both ways with no code forks elsewhere.

---

## 2. Components

### 2.1 Central Gateway (`backend/main.py`)

Composes four routers: buyer, registry, settlement webhooks, theatre. CORS
all-allow (demo), `init_db()` + theatre loop wiring on startup.

### 2.2 Buyer Agent (`backend/buyer_agent/`)

`BuyerAgent.find_best_deal()` is the orchestration engine:

1. `discover_merchants()` — pulls the merchant registry.
2. Creates a `sessions` row (`ACTIVE`) and broadcasts `SESSION_STARTED`.
3. Broadcasts `DISCOVERY`.
4. Fans out **parallel** `negotiate_with_merchant()` coroutines (one per
   merchant, `httpx` with a 5s timeout), gathers them, and broadcasts each
   result as a `NEGOTIATION` event.
5. Tracks the **cheapest offer within budget** (AND the offer is only
   considered if its `status == OFFER` and price ≤ budget).
6. Persists the winning offer (`OFFER_STORED`) with server-generated expiry.
7. Returns `SUCCESS` or `NO_DEAL`.

Per-merchant failures are contained: a timeout or HTTP error becomes a
`TIMEOUT`/`ERROR` result with the merchant's id and reasoning — it never
crashes the orchestration. Every result (offer or reject) enters the audit
chain.

### 2.3 Merchant Agent (`backend/merchant_agent/`)

Each merchant is a standalone FastAPI server exposing the machine-readable
storefront (`/acp/*`):

- **`MerchantAgent`** — owns the catalog (`catalog()`) and the negotiation
  policy (`negotiate()`, capped at `MAX_NEGOTIATION_ROUNDS`). All pricing is
  **deterministic**:
  - `subtotal = Σ base_price × quantity`
  - bundle discounts computed over eligible line items only (a multi-item
    bundle requires *every* listed item); price never drops below the order's
    total **floor** price (price is clamped up to floor if discount would
    breach it).
  - `final_price > budget` → `COUNTER` if budget ≥ floor, else `REJECT` with
    reasoning + `suggested_alternatives`.
- **`InventoryManager`** — reservation ledger. `available_stock = base_stock −
  Σ HELD reservations`. Offers reserve stock (TTL = offer expiry); the router
  returns **503** when a request exceeds current availability, and agents
  reject cleanly for unknown items.
- **`catalog.py`** — the optional **LLM catalog builder**: takes a plain-English
  inventory, asks OpenAI (`response_format=json_object`) to emit a structured
  catalog, then deterministically **validates and clamps** every price to the
  YAML `floor_prices_paise` before the merchant can serve it. The LLM
  *proposes*; rules *decide*.

### 2.4 Registry (`backend/registry/`)

A simple directory (`merchant_registry` table): register (upsert), list, and
search. Seed via `scripts/seed_registry.py`.

### 2.5 Settlement (`backend/settlement/`)

- `razorpay_client.py` — thin wrapper over the Razorpay SDK.
  `create_payment_link()` (mock or real, idempotency-keyed),
  `verify_webhook_signature()`, and `extract_payment_event()` /
  `extract_link_refs()` which parse **both** real Razorpay payload shapes
  (`payment.entity` and `payment_link.entity.payments`).
- `service.py` — on `/buyer/approve`: validates offer belongs to session +
  buyer, checks expiry, rejects double-settlement, computes the **server-side
  amount** (from the stored offer pricing), issues the payment link with
  idempotency key `{session_id}:{offer_id}`, persists `razorpay_order_id` and
  `razorpay_payment_link_id`, audits `SETTLEMENT_INITIATED`, broadcasts it.
- `webhooks.py` — `/webhooks/razorpay` (signature-verified, deduplicated via
  `processed_webhooks`) and `/webhooks/mock/notify` (mock mode). Session lookup
  by `order_id` **or** `payment_link_id`; captured → session `PAID`,
  otherwise `PAYMENT_FAILED`.

### 2.6 Theatre (`backend/theatre/`)

`ConnectionManager` keeps per-session room sets plus a global room (`*`).
`broadcast_event()` is callable from **sync or async** code — it snapshots the
event loop at startup and uses `loop.call_soon_threadsafe` to marshal onto the
loop. Every message is a `make_event()` envelope with a dedupe id.

### 2.7 Frontend (`frontend/`)

- `BuyerPage` — intent form + budget, one-click demo scenarios, polls
  `/buyer/session/{id}` (resilient to the pre-commit race), renders per-merchant
  bubbles (OFFER green / REJECT red w/ suggested-alternative chips / COUNTER
  amber / TIMEOUT dashed), `Buy` → approve → opens payment link (mock auto-
  captures, real opens Razorpay checkout).
- `SuccessPage` — post-payment confirmation (`/success`): shows the paid merchant,
  amount, and a live audit-verify result; links back to Theatre / new purchase.
- `TheatrePage` — live WebSocket feed (`/ws/theatre/*`, reconnect + dedupe,
  bubbles colored by negotiation status), session list with audit chain + Verify.
- Vite dev proxy forwards `/ws` (ws:true) and `/buyer`, `/registry`, etc. to
  `:8000`. Public env values only (`VITE_API_BASE_URL`/`VITE_WS_BASE_URL`).

---

## 3. Protocol & Data Flow

### 3.1 Search → Negotiation → Result

```
   Buyer             Gateway (buyer agent)            Merchants (async)
    │  POST /buyer/search            │                       │
    │───────────────────────────────▶│                       │
    │                                 ├── registry/list ──────▶│
    │                                 │ ───────────────────────│
    │                                 │ SESSION_STARTED ───▶ theatre
    │                                 │ DISCOVERY ─────────▶ theatre
    │                                 ├──── /acp/negotiate ──▶│ (each merchant)
    │                                 │◀── OFFER/COUNTER/     │
    │                                 │     REJECT + reasoning │
    │                                 │  NEGOTIATION ──────▶ theatre
    │                GET /buyer/session/{id}   │
    │◀────────────────────────────────────────│                   │
    │  (poll until search_status == DONE)      │
    │                                 │  OFFER_STORED ─────▶ theatre
    │                                 │  (or NO_DEAL)         │
```

`NegotiateRequest` payload sent to `/acp/negotiate`:

```json
{
  "buyer_id": "priya_demo",
  "session_id": "…",
  "intent": {
    "type": "purchase",
    "items_requested": [{"item_id": "mug_001", "quantity": 2}],
    "budget_paise": 60000,
    "currency": "INR"
  },
  "round": 1
}
```

Response statuses: `OFFER`, `COUNTER`, `REJECT`, `ACCEPT` (reserved), plus
gateway-side `TIMEOUT`/`ERROR`.

### 3.2 Approve → Settle → Webhook

```
   Buyer                   Gateway (settlement)            Razorpay (mock/real)
    │  POST /buyer/approve/{session}                       │
    │─────────────────────────────────────────────────────▶│
    │            (validate offer owner/expiry;             │
    │             server-side amount)                      │
    │                          │ payment_link.create ─────▶│
    │                          │◀─ link (idempotency key)  │
    │                          │ SETTLEMENT_INITIATED ──▶ theatre
    │◀─ {"status":"SETTLEMENT_INITIATED","payment_link":…} │
    │                                                        │
    │  Buyers pays (mock://pay/… auto-captures; real →      │
    │  Razorpay checkout).                                   │
    │                          │ POST /webhooks/… ─────────▶│
    │                          │ (signature verify →        │
    │                          │  dedupe → match session →  │
    │                          │  status='PAID')            │
    │                          │ PAYMENT_CAPTURED ───────▶ theatre
```

### 3.3 Theatre live events

| actor | action_type | when |
|---|---|---|
| buyer_agent | `SESSION_STARTED` | session created |
| buyer_agent | `DISCOVERY` | registry queried |
| merchant_agent | `NEGOTIATION` | every merchant result (`details.status` ∈ OFFER/COUNTER/REJECT/TIMEOUT/ERROR) |
| buyer_agent | `OFFER_STORED` | best offer persisted |
| buyer_agent | `NO_DEAL` | no offer within budget |
| system | `SETTLEMENT_INITIATED` | approve → payment link issued |
| razorpay | `PAYMENT_CAPTURED` / `PAYMENT_FAILED` | webhook processed |

---

## 4. Purity of the Money Path

The confidence story of this MVP is one property:

> **Negotiation can reject, bargain, or discount — but it CANNOT mint or
> misprice money.**

Every price a merchant ever quotes is derived from `base_price_paise` and
`floor_price_paise` in deterministic code. The amount the buyer pays on
approval is **recomputed by the settlement service from the stored offer**
(`offer["pricing"]["total_paise"]`), never taken from the request. Human
approval is required for the payment to exist at all.

Guardrail matrix:

| Threat | Mitigation |
|---|---|
| LLM proposes a silly/short-sighted price | catalog clamping to `floor_prices_paise` + validation |
| Merchant sells below floor | final price clamped `max(final_price, total_floor)` |
| Buyer over-pays / amount tampered client-side | amount is server-side, from stored offer |
| Stale offer accepted | offer expiry (`OFFER_EXPIRY_MINUTES`), explicit `OFFER_EXPIRED` |
| Double settlement / replay approve | offer status locks (`SETTLEMENT_INITIATED`/`SETTLED`) |
| Duplicate webhook replay | `processed_webhooks` table (event id PK) |
| Forged webhook | Razorpay signature verification (skipped in mock) |
| Duplicate payment links on retry | idempotency header `X-Razorpay-Idempotency-Key` |
| Overselling (N concurrent buyers) | reservation ledger + 503 on `available_stock` shortfall |
| Tampered history | SHA-256 hash chain, recomputed on Verify |
| One dead merchant takes everyone down | per-merchant timeout/error containment |

---

## 5. Persistence

Plain SQLite (stdlib `sqlite3`, no ORM), WAL mode, `busy_timeout = 15000ms`.
One file (`x402_in.db`) is **shared** by the central gateway and the merchant
agents (each merchant process also connects to it for the reservation ledger),
so a single `init_db()` migration covers all schemas.

Tables:

| table | purpose | key columns |
|---|---|---|
| `sessions` | negotiation lifecycle | `status` (ACTIVE → SETTLEMENT_INITIATED → PAID \| PAYMENT_FAILED), `final_amount_paise`, `razorpay_order_id`, `razorpay_payment_link_id`, `razorpay_payment_id` |
| `offers` | persisted price quotes | `status` (PENDING → SETTLEMENT_INITIATED → EXPIRED/SETTLED), `items`/`pricing` (JSON), `expires_at` |
| `audit_logs` | tamper-evident history | `action_type`, `actor`, `details` (JSON), `previous_hash`, `current_hash` |
| `merchant_registry` | directory | `endpoint_url`, `categories`, `capabilities` (JSON) |
| `inventory_reservations` | stock ledger | `status` (HELD → RELEASED/CONSUMED), `expires_at` |
| `processed_webhooks` | dedupe | `event_id` PK |

`init_db()` runs `CREATE TABLE IF NOT EXISTS` then an idempotent `_migrate()`
(`ALTER TABLE ... ADD COLUMN` when a column is missing) — safe on existing
databases.

**Audit chain algorithm** (`backend/core/audit.py`): each entry hashes a
canonical JSON (`sort_keys`, `default=str`) of
`{timestamp, session_id, action_type, actor, details, previous_hash}` with
SHA-256. Genesis = `"0"*64`. `verify_chain()` replays the whole chain in id
order, recomputing every hash and checking both hash equality and prev-link
continuity — any tampered, reordered, or forged row breaks verification.

**Concurrency notes:**
- A DB write from `audit.log()`/`broadcast_event()` while an outer
  `db_session()` is still open causes a nested-writer lock (SQLite single-
  writer). Pattern: commit/close the data write first, then audit/broadcast
  (see `settlement/webhooks.py` `_process_event`).
- Theatre events are emitted from sync code via `call_soon_threadsafe`.

---

## 6. Running Topology

| process | command | port |
|---|---|---|
| central gateway | `uvicorn backend.main:app --port 8000` | 8000 |
| merchant (YAML) | `python -m backend.merchant_agent.standalone --port 8001 --config backend/merchant_agent/merchant.yaml` | 8001 |
| merchant (YAML) | same with `merchant_candles.yaml` | 8002 |
| merchant (LLM) | same + `--llm` + `merchant_llm.yaml` | 8003 |
| frontend | `cd frontend && npm run dev` | 5173 |

`scripts/dev.sh` starts gateway + 2 merchants + seed + frontend in one command
and traps Ctrl+C to stop all. Optional `--with-llm` / `--with-dead` flags on
`seed_registry.py` register the LLM merchant and an intentionally-offline
merchant (for the failure demo).

## 7. Trade-offs & Next Steps

- **Single SQLite per process group:** great for an MVP demo (zero ops, WAL),
  but the real deployment would be Postgres with per-merchant own-host
  settlement; x402-in is designed to put payment-pathing in the hands of the
  biz person, not to bake in its current storage.
- **Demo-resident auth:** none on public endpoints (theatre/buyer) other than
  webhook signature. Next step: lightweight ownership tokens on approve
  (#6 in the backlog).
- **1 round of negotiation exercised** by the parallel fan-out today; the
  merchant already implements multi-round `COUNTER` logic (round ≤
  `MAX_NEGOTIATION_ROUNDS`). Extending the buyer to a real bargaining loop is
  an obvious follow-up.
- **Scalability path:** registry health-checking + auto-scaling of buyer
  coroutines; theatre → a pub/sub bus; idempotency already keyed for retries.