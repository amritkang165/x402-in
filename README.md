<p align="center">
  <img src="https://raw.githubusercontent.com/amritkang165/x402-in/main/frontend/public/x402.svg" width="96" alt="x402-IN logo" />
</p>

<h1 align="center">x402-IN · Agentic Commerce Protocol Gateway</h1>

<p align="center">
  <strong>Razorpay AI Buildathon 2026 — Track 01: AI Growth &amp; Agentic Commerce</strong>
</p>

<p align="center">
  <em>“AI proposes. Rules decide. Humans authorize money.”</em>
</p>

<p align="center">
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/amritkang165/x402-in" />
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/amritkang165/x402-in" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Razorpay" src="https://img.shields.io/badge/Razorpay-Settlement-0C2451?logo=razorpay&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue" />
</p>

<p align="center">
  AI agents discover merchants, negotiate within deterministic guardrails, and
  prepare transactions — humans only approve the final payment.
</p>

---

## 🎬 The Pitch in One Animation

The whole protocol, distilled. AI proposes → rules decide → humans authorize → Razorpay settles.

<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 190" width="900" role="img" aria-label="x402-IN flow: discovery, negotiation, approval, settlement">
    <defs>
      <marker id="arrowh" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 z" fill="#4f46e5"/>
      </marker>
      <style>
        .node { fill:#eef2ff; stroke:#4f46e5; stroke-width:1.5; rx:12; }
        .lbl  { font:600 13px system-ui,sans-serif; fill:#312e81; }
        .sub  { font:12px system-ui,sans-serif; fill:#6b7280; }
        .edge { fill:none; stroke:#4f46e5; stroke-width:2; marker-end:url(#arrowh); stroke-dasharray:7 5; }
        .anim { animation:dash 1.2s linear infinite; }
        @keyframes dash { to { stroke-dashoffset:-24; } }
        .pill { width:150px; }
        .hl   { fill:#fff7ed; stroke:#ea580c; }
      </style>
    </defs>

    <g>
      <rect class="node" x="30"  y="30" width="150" height="64"/>
      <text class="lbl" x="105" y="58" text-anchor="middle">1 · Discover</text>
      <text class="sub" x="105" y="78" text-anchor="middle">registry → merchants</text>
    </g>

    <g>
      <rect class="node" x="270" y="30" width="150" height="64"/>
      <text class="lbl" x="345" y="58" text-anchor="middle">2 · Negotiate</text>
      <text class="sub" x="345" y="78" text-anchor="middle">parallel · guardrails</text>
    </g>

    <g>
      <rect class="node" x="520" y="30" width="150" height="64"/>
      <text class="lbl" x="595" y="58" text-anchor="middle">3 · Approve</text>
      <text class="sub" x="595" y="78" text-anchor="middle">human · one click</text>
    </g>

    <g>
      <rect class="node" x="710" y="30" width="160" height="64"/>
      <text class="lbl" x="790" y="58" text-anchor="middle">4 · Settle</text>
      <text class="sub" x="790" y="78" text-anchor="middle">Razorpay payment link</text>
    </g>

    <path class="edge anim" d="M185 62 L262 62"/>
    <path class="edge anim" d="M425 62 L512 62"/>
    <path class="edge anim" d="M675 62 L702 62"/>

    <g>
      <rect class="node hl" x="270" y="130" width="360" height="42"/>
      <text class="lbl" x="450" y="151" text-anchor="middle" fill="#c2410c">guardrails: floor price · budget · stock · expiry · rounds</text>
      <text class="sub" x="450" y="165" text-anchor="middle">rules decide — the LLM never controls money</text>
      <line x1="345" y1="95" x2="345" y2="128" stroke="#ea580c" stroke-width="1.5" stroke-dasharray="4 3"/>
      <line x1="595" y1="95" x2="595" y2="128" stroke="#ea580c" stroke-width="1.5" stroke-dasharray="4 3"/>
    </g>
  </svg>
</p>

> **Why it matters:** sellers stay in control of prices and stock. Buyers get an
> agent that does the shopping. Every step lands in a tamper-evident audit chain,
> and the human signs off on the money. That is the whole point.

---

## ✨ What This Is

x402-IN is a working MVP of an **agent-to-agent commerce protocol** with Razorpay
as the settlement layer. It's not a chatbot that buys things in a black box — it's
a **verifiable pipeline** where each decision is rule-checked on the server and
each payment requires explicit human approval.

| Surface | What It Is |
|---------|-----------|
| 🤖 **Merchant Agent** | Headless FastAPI server exposing a machine-readable storefront (`/acp/catalog`, `/acp/negotiate`, `/acp/settle`). Enforces floor prices, stock, and bundles. Can auto-build its catalog from **plain English** via OpenAI. |
| 🛍️ **Buyer Agent** | Runs on the central gateway. Discovers merchants from a registry, runs **parallel async negotiations**, and recommends the best deal. |
| 🎭 **Negotiation Theatre** | React dashboard showing negotiations **live** over WebSocket, plus the persisted **SHA-256 hash-chained audit trail** with a one-click “Verify Chain” integrity check. |

---

## 🧠 Core Principle

AI proposes — **rules decide** — humans authorize money.

<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 120" width="720" role="img" aria-label="AI proposes rules decide humans authorize money">
    <defs>
      <style>
        .c { font:600 14px system-ui,sans-serif; fill:#fff; text-anchor:middle; }
        .d { font:12px system-ui,sans-serif; fill:#6b7280; text-anchor:middle; }
        .bar { rx:16; }
      </style>
    </defs>
    <rect class="bar" x="0"   y="20" width="220" height="70" fill="#6366f1"/>
    <text class="c" x="110" y="55">🤖 AI proposes</text>
    <text class="d" x="110" y="76" fill="#e0e7ff">catalogs · discovery · negotiation</text>

    <rect class="bar" x="250" y="20" width="220" height="70" fill="#0ea5e9"/>
    <text class="c" x="360" y="55">⚖️ Rules decide</text>
    <text class="d" x="360" y="76" fill="#e0f2fe">floors · stock · expiry · rounds</text>

    <rect class="bar" x="500" y="20" width="220" height="70" fill="#10b981"/>
    <text class="c" x="610" y="55">🧑‍💼 Humans authorize</text>
    <text class="d" x="610" y="76" fill="#d1fae5">one click approves the amount</text>
  </svg>
</p>

The **LLM never controls money.** It can propose list prices and bundle ideas;
deterministic code clamps every price to the merchant's floor and enforces every
guardrail. The backend alone computes the final amount.

---

## 🧱 Tech Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, httpx, plain SQLite (stdlib)
- **Frontend:** React 18 + TypeScript + Tailwind + Vite
- **Settlement:** Razorpay (real keys) **or** built-in mock mode (no keys needed)
- **Audit:** SHA-256 hash chain persisted to SQLite, verifiable by recomputation
- **Live feed:** WebSocket broadcasts every negotiation step

---

## 📁 Project Structure

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
├── docs/                    # ARCHITECTURE.md · API_SPEC.md · PITCH_SCRIPT.md
├── README.md
└── requirements.txt
```

---

## 🚀 Quick Start

### 1 · Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

### 2 · Start the services

**Terminal 1 — Central gateway (buyer + registry + settlement + theatre):**
```bash
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Merchant agents:**
```bash
source venv/bin/activate
# Rahul's Handmade Pottery on 8001
python -m backend.merchant_agent.standalone --port 8001 --config backend/merchant_agent/merchant.yaml
# Sneha's Soy Candles on 8002 (optional, multi-merchant negotiation)
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

Open **http://localhost:5173** — type a need and watch the negotiation live.

> **Tab-frenzy?** `scripts/dev.sh` starts the whole stack with one command and
> auto-frees ports on restart.

---

## 🧪 Try It: Demo Scenarios

Two scenarios show the guardrails doing real work:

- **💰 Budget Rs. 600 → “2 handmade mugs”** — the pottery merchant accepts within
  budget and bundles apply → **OFFER** → click **Buy** → approved → `PAID`.
- **🚫 Budget Rs. 400 → “2 handmade mugs”** — below the floor, the merchant
  **REJECTS** and suggests a reduced quantity (`1 × mug_001 — Reduce quantity`).

Watch both play out **live** in the Negotiation Theatre, then hit **Verify Chain**
to confirm no audit entry was tampered with.

---

## 💳 Payments: Mock ↔ Real Razorpay

By default the app runs in **mock mode**: approving an offer returns a fake
`mock://` payment link and `POST /webhooks/mock/notify` marks the session `PAID`.
No keys required.

To switch to **real Razorpay test payments**, copy `.env.example` to `.env` and fill in:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

Then:

1. `/buyer/approve` creates a Razorpay **payment link** (server-side amount only,
   idempotency-keyed by `session_id:offer_id` so retries never duplicate).
2. The frontend opens the secure **Razorpay checkout** in a new tab.
3. Razorpay's webhook fires at `/webhooks/razorpay` → **signature verified** →
   `processed_webhooks` dedupes events → session marked `PAID`.

Both `payment` and `payment_link` webhook payload shapes are parsed; sessions are
matched by `order_id` **or** `payment_link_id`. **Secrets never reach the
frontend** — the backend alone determines the amount.

### Live payment flow

<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 150" width="760" role="img" aria-label="payment flow">
    <defs>
      <style>
        .b { fill:#fef2f2; stroke:#f43f5e; stroke-width:1.5; rx:12; }
        .t { font:600 12px system-ui,sans-serif; fill:#9f1239; text-anchor:middle; }
        .s { font:11px system-ui,sans-serif; fill:#9ca3af; text-anchor:middle; }
        .e { fill:none; stroke:#f43f5e; stroke-width:2; stroke-dasharray:6 5; marker-end:url(#a2); }
        .an { animation:d2 1.1s linear infinite; }
        @keyframes d2 { to { stroke-dashoffset:-22; } }
      </style>
      <marker id="a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 z" fill="#f43f5e"/>
      </marker>
    </defs>
    <rect class="b" x="10"  y="25" width="130" height="60"/>
    <text class="t" x="75"  y="50">Buyer approve</text>
    <text class="s" x="75"  y="68">idempotent link</text>

    <rect class="b" x="210" y="25" width="150" height="60"/>
    <text class="t" x="285" y="50">Razorpay API</text>
    <text class="s" x="285" y="68">payment link</text>

    <rect class="b" x="430" y="25" width="140" height="60"/>
    <text class="t" x="500" y="50">Open checkout</text>
    <text class="s" x="500" y="68">new tab</text>

    <rect class="b" x="640" y="25" width="110" height="60"/>
    <text class="t" x="695" y="50">Webhook</text>
    <text class="s" x="695" y="68">verify + dedupe</text>

    <path class="e an" d="M140 55 L202 55"/>
    <path class="e an" d="M360 55 L422 55"/>
    <path class="e an" d="M570 55 L632 55"/>

    <rect class="b" x="250" y="112" width="260" height="28"/>
    <text class="t" x="380" y="130">session → PAID · audit-hash appended</text>
  </svg>
</p>

---

## 📡 API Summary

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

Interactive API docs: **http://localhost:8000/docs**

---

## ✅ Verified Behavior

- Bundle discounts apply only to eligible items (single-item bundles; real combos require every listed item).
- Floor prices are never violated; budget below floor → **REJECT** with reasoning.
- Inventory reservations prevent overselling during concurrent negotiations.
- Offer expiry + server-side amounts prevent stale/altered payments.
- Approval is gated by a per-session secret (`buyer_token`, issued at search, constant-time compared) so only the initiating buyer can settle a session.
- Webhooks are signature-verified and idempotent (`processed_webhooks` persisted).
- Every action enters a SHA-256 hash chain; `verify` recomputes and detects tampering.
- **Live Theatre:** real-time WebSocket feed broadcasts every negotiation step
  (`SESSION_STARTED` → `DISCOVERY` → `NEGOTIATION` per merchant → `OFFER_STORED` →
  `SETTLEMENT_INITIATED` → `PAYMENT_CAPTURED`). The Theatre connects to
  `/ws/theatre/*`, auto-reconnects, and deduplicates events by id.

---

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, money-path guardrail matrix, schema, audit-chain algorithm, concurrency model, trade-offs
- [`docs/API_SPEC.md`](docs/API_SPEC.md) — every endpoint, JSON shapes, lifecycle, errors, curl examples
- [`docs/PITCH_SCRIPT.md`](docs/PITCH_SCRIPT.md) — a timed 5:00 pitch script with setup and rehearsal notes

---

## 🛡️ Security Notes

- Secrets (`RAZORPAY_KEY_SECRET`, `OPENAI_API_KEY`) live in `.env` and **never** reach the frontend.
- Final amounts are computed **server-side only**; the frontend just relays approval.
- Webhook endpoints verify Razorpay's signature before trusting any event.
- The audit chain makes silent tampering detectable by recomputation.

---

<p align="center">
  Built for the <strong>Razorpay AI Buildathon 2026</strong> ·
  Track 01 · AI Growth &amp; Agentic Commerce
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/amritkang165/x402-in/main/frontend/public/x402.svg" width="40" alt="" />
</p>
