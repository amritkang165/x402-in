# x402-IN API Specification

Protocol `x402-in` v`0.1.0`. All prices are in **paise** (₹1 = 100 paise).

- Gateway base: `http://localhost:8000` (interactive docs at `/docs`)
- Merchant base: `http://localhost:8001`/`8002`/`8003` (per merchant)
- Settlement is **mock** unless `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` are
  set in `.env` — see §7.

---

## 1. Gateway — Buyer Agent

### `POST /buyer/search`

Submit an intent; discovery + negotiation run **asynchronously**. Returns
immediately; poll `GET /buyer/session/{id}`.

Request:

```json
{
  "buyer_id": "priya_demo",
  "type": "purchase",
  "items_requested": [{"item_id": "mug_001", "quantity": 2}],
  "budget_paise": 60000,
  "currency": "INR",
  "preferences": null
}
```

`type`: `purchase | inquiry`. `quantity` int 1–100. `budget_paise` > 0.

Response `202`-style (always `200`). `buyer_token` is the **secret ownership
proof** — it must be sent back on `POST /buyer/approve`. It is returned exactly
once, never stored in the DB, and never exposed to the Theatre.

```json
{
  "session_id": "3f74e9546442410aa037ecdc6f8ed434",
  "status": "RUNNING",
  "buyer_token": "AbC…xyz"
}
```

### `GET /buyer/session/{session_id}`

Poll for the negotiation outcome. `404` if unknown (may briefly occur
immediately after search while the session row is being committed).

```json
{
  "session": {
    "id": "…", "buyer_id": "priya_demo", "status": "ACTIVE",
    "created_at": "…", "settled_at": null,
    "final_amount_paise": null, "razorpay_order_id": null,
    "razorpay_payment_link_id": null, "razorpay_payment_id": null
  },
  "offers": [],
  "search_status": "DONE",
  "result": {
    "status": "SUCCESS",
    "session_id": "…", "buyer_id": "priya_demo",
    "best_offer": { … },
    "all_offers": [ … ],
    "recommendation": "Best deal from pottery_rahul_001: Rs. 540"
  }
}
```

`search_status`: `RUNNING → DONE` (or `ERROR`, meaning the agent orchestration
threw; per-merchant failures are contained inside `result.all_offers` and do
not set this).

`result.status`:

| value | meaning |
|---|---|
| `SUCCESS` | at least one offer priced ≤ budget; `best_offer` + `offer_id` set |
| `NO_DEAL` | no merchant offered within budget; `all_offers` explains each |

Each element of `all_offers` is a per-merchant outcome:

```json
{
  "merchant_id": "pottery_rahul_001",
  "session_id": "…",
  "status": "REJECT",
  "items": [],
  "pricing": null,
  "reasoning": "Lowest I can go is Rs. 500. Your budget is Rs. 400. Cannot fulfill.",
  "round": 1,
  "suggested_alternatives": [
    {"item_id": "mug_001", "quantity": 1, "reason": "Reduce quantity to fit budget"}
  ],
  "offer_id": null,
  "expires_at": null
}
```

`status` values: `OFFER` (has `pricing`, `offer_id`, `expires_at`),
`COUNTER` (has `pricing`, price > budget, `next_action`), `REJECT` (reasoning +
maybe `suggested_alternatives`), `TIMEOUT` / `ERROR` (gateway-side failure
isolation).

### `POST /buyer/approve/{session_id}`

**The human authorization step.** Requires the `buyer_token` returned by
`POST /buyer/search` (constant-time compared against the gateway's in-memory
copy) — proof of session ownership. Settles the given offer with a server-side
amount. `403` on a missing/mismatched/expired token (e.g. gateway restarted).

Request:

```json
{
  "offer_id": "…",
  "buyer_id": "priya_demo",
  "buyer_email": "priya@example.com",
  "buyer_token": "AbC…xyz"
}
```

`buyer_id` must match the offer's buyer (else `FAILED`). `buyer_phone`/
`shipping_address` optional.

Response:

```json
{
  "merchant_id": "pottery_rahul_001",
  "status": "SETTLEMENT_INITIATED",
  "razorpay_order_id": "order_…",
  "payment_link": "mock://pay/…",
  "amount_paise": 54000,
  "currency": "INR",
  "expires_at": "…",
  "audit_hash": "…"
}
```

`status` values: `SETTLEMENT_INITIATED`, `OFFER_NOT_FOUND`, `OFFER_EXPIRED`,
`FAILED` (offer/session/buyer mismatch, or offer already settled/locked).

### `GET /buyer/session/{session_id}/audit`

Full hash chain, oldest → newest:

```json
[
  {
    "id": 1,
    "session_id": "…",
    "timestamp": "…",
    "action_type": "SESSION_STARTED",
    "actor": "buyer_agent",
    "details": { … },
    "previous_hash": "00000000…00",
    "current_hash": "ab12…"
  }
]
```

### `GET /buyer/session/{session_id}/audit/verify`

Recompute + verify the chain.

```json
{ "verified": true, "message": "Chain verified: 14 entries, no tampering detected" }
```

---

## 2. Gateway — Registry

### `POST /registry/register`

Upsert a merchant.

```json
{
  "merchant_id": "pottery_rahul_001",
  "merchant_name": "Rahul's Handmade Pottery",
  "endpoint_url": "http://localhost:8001",
  "description": "…",
  "categories": ["pottery", "home"],
  "protocol_version": "0.1.0",
  "capabilities": ["CATALOG", "NEGOTIATION", "RAZORPAY_SETTLEMENT"]
}
```

### `GET /registry/list`, `GET /registry/search?category=pottery`

List (or filter by category) registered merchants with parsed
`categories`/`capabilities`.

---

## 3. Merchant Agent — ACP Storefront

Path prefix `/acp`.

### `GET /acp/catalog`

```json
{
  "merchant_id": "pottery_rahul_001",
  "merchant_name": "Rahul's Handmade Pottery",
  "protocol_version": "0.1.0",
  "capabilities": ["CATALOG", "NEGOTIATION", "RAZORPAY_SETTLEMENT"],
  "items": [
    {
      "id": "mug_001", "name": "Handmade Ceramic Mug",
      "base_price_paise": 30000, "floor_price_paise": 25000,
      "currency": "INR", "available": true, "stock": 15,
      "variants": ["blue", "brown", "white"]
    }
  ],
  "bundle_rules": [
    {"id": "mug_bundle", "name": "Mug Bundle", "item_ids": ["mug_001"],
     "min_quantity": 2, "discount_type": "PERCENT", "discount_value": 10}
  ],
  "payment_methods": ["razorpay"]
}
```

`items[].id` values are stable product keys that buyers use in
`items_requested`. Prices are list (`base`) and never-violate (`floor`).

### `POST /acp/negotiate`

Body is the `NegotiateRequest` shown in §1 (buyer sends it via the gateway).

Responses (all `status` values):

- **`OFFER`** — `pricing { subtotal_paise, discounts[], total_paise }`,
  `items`, `reasoning`, `offer_id`, `expires_at`, and reserves stock.
- **`COUNTER`** — `pricing` above budget, `reasoning`, `next_action`. Reserves
  stock.
- **`REJECT`** — `reasoning`, optionally `suggested_alternatives`. No reserve.
- **`503`** HTTP — requested quantity exceeds current availability:
  `{"detail": "Item mug_001 has only 3 available"}`. (Unknown items produce a
  clean `REJECT` instead.)
- **`400` HTTP** — validation errors (bad item/quantity/budget).

#### Pricing rules

1. `subtotal = Σ base_price_paise × quantity`.
2. Apply bundle discounts over **eligible line items only**; a multi-item
   bundle requires *all* its `item_ids` present; `eligible_qty ≥
   min_quantity`.
3. `final = max(subtotal − discounts, Σ floor_price_paise × quantity)` —
   **floor never breaches**.
4. Compare `final` to `budget_paise` → OFFER / COUNTER / REJECT.

Example: 2 mugs, base ₹300 each → subtotal ₹600, Mug Bundle −10% → ₹540.
2 mugs @ budget ₹400 → REJECT (`lowest ₹500`), suggestion `1 × mug`).

### `POST /acp/settle`

Merchant acknowledgment stub:

```json
{ "offer_id": "…", "session_id": "…" }
```

```json
{ "merchant_id": "pottery_rahul_001", "status": "ACKNOWLEDGED",
  "session_id": "…", "offer_id": "…" }
```

---

## 4. Webhooks

### `POST /webhooks/razorpay` (real mode)

Header `X-Razorpay-Signature` required. Signature verified against key secret
first → `400 Invalid webhook signature` on failure (mock mode rejects the whole
endpoint with `400 Razorpay is disabled in mock mode`).

Handles both real payload shapes — `payment.entity` (e.g. event
`payment.captured`) and `payment_link.entity.payments` (e.g. event
`payment_link.paid`). Sessions are matched by `order_id`, then fall back to
`payment_link_id`. After processing, the event id is stored and replays return
`{"status": "already_processed"}`.

Causes: `status='PAID'` (captured) or `'PAYMENT_FAILED'`, an audit entry, and a
theatre `PAYMENT_CAPTURED`/`PAYMENT_FAILED` broadcast.

```json
{ "status": "processed" }
<!-- or -->
{ "status": "already_processed" }
```

### `POST /webhooks/mock/notify` (mock mode)

```json
{
  "session_id": "…",
  "payment_status": "captured"        // or "failed"
}
```

Simulates a payment event against a session. Idempotent to the extent of the
obvious (no dedupe key — used for demo). `404` if session unknown.

---

## 5. Theatre

### `WS /ws/theatre/{session_id}`

Subscribe to a session's room. Use `/ws/theatre/*` for the global room (all
sessions). Send a text frame every ~?s or just hold the socket; drops are
fine — clients reconnect and dedupe by `id`.

Server push message shape:

```json
{
  "id": "1700000000.0-merchant_agent-NEGOTIATION",
  "timestamp": "2026-09-02T10:00:00.000000",
  "session_id": "…",
  "actor": "merchant_agent",
  "action_type": "NEGOTIATION",
  "details": {"merchant_id": "pottery_rahul_001", "status": "REJECT",
              "reasoning": "…", "total_paise": null},
  "sequence": null
}
```

Event types — see ARCHITECTURE §3.3. Frontend colors `NEGOTIATION` by
`details.status`: OFFER green, COUNTER amber, REJECT red, TIMEOUT/ERROR dashed.

### `GET /sessions`

Most-recent 50 sessions, newest first (id, buyer_id, status, timestamps,
razorpay ids, final amount).

---

## 6. Session & Offer Lifecycle

```
sessions.status
  ACTIVE ──approve──▶ SETTLEMENT_INITIATED
     │                       │
     │                       ├──webhook captured──▶ PAID
     │                       └──webhook failed/────▶ PAYMENT_FAILED
     └──────────────────────▶ (drops when search ends)

offers.status
  PENDING ──approve──▶ SETTLEMENT_INITIATED ──▶ (SETTLED on capture)
     │
     └──expiry────────▶ EXPIRED
```

A `SUCCESS` session is created with `ACTIVE`; `PAID` marks the closed deal. The
negotiation result object (cf. §1) is held in the gateway in-memory search
table; the persisted truth for money is `sessions` + `offers`.

## 7. Errors

Standard: `{"detail": "message"}` with 4xx/5xx.

| code | typical cause |
|---|---|
| 400 | missing `offer_id`; invalid negotiate body; bad webhook signature; mock meta-endpoint misuse |
| 403 | missing/mismatched `buyer_token` on approve |
| 404 | unknown session / offer / webhook ref |
| 503 | inventory shortfall at `.acp/negotiate` |
| 500 | unexpected server error |

## 8. Interactive / Examples

```bash
# search (gateway)
curl -s localhost:8000/buyer/search \
  -H 'content-type: application/json' \
  -d '{"buyer_id":"priya_demo","type":"purchase",
       "items_requested":[{"item_id":"mug_001","quantity":2}],
       "budget_paise":60000,"currency":"INR"}'

# poll → approve (with buyer_token from search) → mock-capture
curl -s localhost:8000/buyer/session/<SID>
curl -s localhost:8000/buyer/approve/<SID> \
  -H 'content-type: application/json' \
  -d '{"offer_id":"<OFFER>","buyer_id":"priya_demo","buyer_email":"priya@example.com","buyer_token":"<TOKEN>"}'
curl -s localhost:8000/webhooks/mock/notify \
  -H 'content-type: application/json' \
  -d '{"session_id":"<SID>","payment_status":"captured"}'
```