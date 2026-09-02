# x402-IN — 5-Minute Pitch Script

**Venue:** Razorpay AI Buildathon 2026 · Track 01 · AI Growth & Agentic Commerce
**One-liner:** *AI proposes. Rules decide. Humans authorize money.*

---

## The One-Sentence Every Judge Should Remember

> "AI agents roam the internet, negotiate with each other, and agree on a
> price — but they can **never** move money; a human clicks once, and only
> then does Razorpay get involved."

---

## Script (5:00 total)

### 0:00–0:40 — Hook (what is it)

> "We're in the post-AI-search world. Your buyer isn't human anymore — it's an
> agent with a budget. So the storefront has to change: instead of a shopping
> cart, a store needs a **machine-readable catalog** plus an AI **shopkeeper**
> that can negotiate on its behalf — within guardrails.
>
> x402-IN is that protocol: agents discover stores, read their catalogs,
> negotiate in parallel, and close a deal — and a **human authorizes the
> payment** on Razorpay. Today I'll show you a real negotiation, a real
> rejection, and the payment."

> 👇 click **"2 mugs · ₹600"** on the Buyer page, click **Find Deals**.

### 0:40–1:30 — The Deal (happy path)

> "Two handmade mugs, budget ₹600. The buyer agent is now talking to **every
> merchant at once** — watch it happen live in the Theatre."
>
> 👇 switch to **Negotiation Theatre** — the live feed is streaming
> `SESSION_STARTED → DISCOVERY → NEGOTIATION`.

> "Rahul's Pottery reads the request, applies the **Mug Bundle rule** (2 mugs,
> 10% off), and ships a price: **₹540**. Notice this isn't a chat bot
> guessing — the discount came from a deterministic rule, and the number was
> checked against a recorded **floor price**. Sneha's Candles rejects because
> she doesn't sell mugs — rejected *politely, with a reason*. The registry's
> third merchant is offline — and instead of failing the whole search, the
> buyer agent just isolates it."
>
> "₹540 against a budget of ₹600. Best offer wins."
>
> 👇 back to **Buyer** page.

### 1:30–2:10 — Human Authorizes Money (the core moment)

> "Now the part that makes this *commerce* and not a toy: **I approve.**
> The buyer agent can't pay. I click Buy."
>
> 👇 click **Buy**.

> "The gateway re-derives the amount **server-side** — it does not trust the
> frontend — and issues a one-time payment link. In this local demo we auto-
> capture; with real keys this is a real Razorpay checkout, and the webhook
> comes back **signature-verified** and **idempotent**."

> "Note the audit hash on screen. Every single step — every offer, every
> rejection, every rupee — is chained, tamper-evident, and **verifiable**."
>
> 👇 click **Verify Audit Chain**. *(Show the green "verified" message.)*

### 2:10–2:50 — The Rejection (guardrail demo — the demo judges remember)

> "Now the same buyer, asking for the moon: **two mugs, budget ₹400.**"
>
> 👇 click **"2 mugs · ₹400 (reject)"**, then **Find Deals**.

> "Rahul checks his floor: the *all-in*, lowest-legal price for two mugs is
> ₹500. ₹400 is below it. So — **rules decide** — he rejects. Not a vague
> 'sorry', but an auditable one: *'Lowest I can go is Rs. 500.'* And like a
> good human shopkeeper he leaves a suggestion: *reduce quantity to one mug*.
>
> This is the safety story: no LLM hallucination, no price panic, no 'deals'
> below cost — an unbreakable floor.
>
> Meanwhile the offline merchant is still isolated, and the whole search
> degrades gracefully instead of erroring."

> 👇 **Theatre** — point out the *red* rejection bubble, then the *green* offer
> bubble from before.

### 2:50–3:40 — The Merchant Side (how stores get AI-shopkeepered fast)

> "Three merchants, three ways to onboard, same protocol:
>
> - Rahul: a **hand-written YAML** catalog.
> - Sneha: the same, one file.
> - Meera: **no catalog at all** — just a plain-English inventory list."
>
> 👇 *have the LLM merchant running* — show `merchant_llm.yaml`.

> "We paste her inventory: *'I sell cardamom pods at ₹250, saffron at 500, I
> have 40 boxes…'* — and OpenAI structures it into a machine-readable catalog.
> But notice: the LLM only **proposes** list prices and items. The floor
> prices stay in config, and **code clamps** any absurd price up to the floor,
> and rejects items that don't exist. The LLM proposes; rules decide."

### 3:40–4:20 — The Audit Trail (trust infrastructure)

> "Take the Theatre's 'Audit Trails' panel. Every action is a row chained to
> the previous one by SHA-256. Verify recomputes the entire chain — if
> anything was edited, reordered, or forged, it breaks. Human oversight,
> machine verifiability. That's what makes agents wallet-safe."

> 👇 record any session → **Verify**.

### 4:20–5:00 — Close (the pitch)

> "So what is x402-IN, exactly?
>
> - **For buyers:** a *parley* — one intent, N merchants, parallel
>   negotiation, best auditable price, one human click.
> - **For merchants:** their storefront becomes agent-readable in a day —
>   even from a text file — with iron guarantees on floors and stock.
> - **For the ecosystem:** a protocol where **AI proposes, rules decide, and
>   humans authorize money** — with Razorpay as the settlement layer that
>   agents can push toward but never touch.
>
> This MVP runs entirely locally today — the CLI is on screen, the repo is
> public. Thank you."

---

## Setup Checklist (before the pitch)

1. `./scripts/dev.sh` → gateway :8000, merchants :8001/:8002, frontend :5173.
2. Optional: `OPENAI_API_KEY` in `.env`, start Meera at :8003, seed with
   `--with-llm`.
3. Pre-delete `x402_in.db` for a clean audit story (optional).
4. Browser: Buyer page *and* Negotiation Theatre in two tabs, both pre-loaded.
5. Keep the rejection scenario queued (click the chip, don't press **Find
   Deals** yet).

## Rehearsal Notes

- **Don't belabor the mock/webhook mechanics**; say "signature-verified,
  idempotent" and move on — technical depth is in `ARCHITECTURE.md` if they
  ask.
- **The rejection is the star.** Pause a full second on the red bubble and the
  "Merchant suggests" chips.
- **Empathize with the fail:** if a merchant isn't up, that's the *failure
  demo* — say "see — isolated, exactly as designed."
- **Watch the clock:** 30s over on the LLM merchant if needed; the happy path +
  rejection are the must-haves.