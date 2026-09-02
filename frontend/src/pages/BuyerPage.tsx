import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import type { LiveEvent } from '../types/live'
import { openLiveFeed } from '../lib/live'
import { STATUS_META } from '../lib/meta'
import {
  CATALOG,
  MERCHANT_META,
  humanizeEvent,
  itemName,
  merchantName,
  type ArtKind,
  type ChatMessage,
} from '../lib/shop'
import ProductArt from '../components/ProductArt'

interface Pricing {
  total_paise: number
  subtotal_paise: number
  discounts: { rule: string; amount_paise: number }[]
}

interface Offer {
  merchant_id: string
  status: string
  reasoning: string
  next_action?: string
  pricing?: Pricing
  suggested_alternatives?: { item_id: string; quantity: number; reason: string }[]
  offer_id?: string
  items?: { item_id: string; quantity: number }[]
}

interface Result {
  status: string
  session_id?: string
  recommendation?: string
  best_offer?: Offer & { offer_id: string }
  all_offers?: Offer[]
}

const SCENARIOS = [
  { label: '2 mugs · Rs 600', query: 'I need 2 handmade mugs', budget: '600' },
  { label: '3 candles · Rs 800', query: 'I need 3 candles', budget: '800' },
  { label: '1 bowl · Rs 700', query: 'I need 1 handmade bowl', budget: '700' },
  { label: '2 mugs · Rs 400', query: 'I need 2 handmade mugs', budget: '400', subtle: true },
]

function parseQuery(q: string): { item_id: string; quantity: number }[] {
  const lower = q.toLowerCase()
  let qty = 1
  const m = lower.match(/(\d+)/)
  if (m) qty = parseInt(m[1])
  if (lower.includes('candle')) return [{ item_id: 'candle_001', quantity: qty }]
  if (lower.includes('bowl')) return [{ item_id: 'bowl_001', quantity: qty }]
  if (lower.includes('plate')) return [{ item_id: 'plate_001', quantity: qty }]
  return [{ item_id: 'mug_001', quantity: qty }]
}

function merchantState(events: LiveEvent[], id: string): string {
  const neg = events.filter((e) => e.action_type === 'NEGOTIATION' && e.details?.merchant_id === id)
  if (neg.length) return neg[neg.length - 1].details?.status || 'NEGOTIATING'
  return 'PENDING'
}

function StarRating({ rating }: { rating: string }) {
  const n = Math.round(parseFloat(rating))
  return (
    <span className="inline-flex gap-0.5 text-amber">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'opacity-100' : 'opacity-25'}>★</span>
      ))}
      <span className="ml-1 text-xs text-slate-400">{rating}</span>
    </span>
  )
}

export default function BuyerPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [budget, setBudget] = useState('600')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [buyerToken, setBuyerToken] = useState('')
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [merchants, setMerchants] = useState<Record<string, string>>({})
  const [showLog, setShowLog] = useState(false)
  const wsCleanup = useRef<(() => void) | null>(null)
  const chatEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    axios
      .get('/registry/list')
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const m of data as Array<Record<string, string>>) map[m.id] = m.name
        setMerchants(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => () => wsCleanup.current?.(), [])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [liveEvents])

  const merchantsDiscovered = useMemo(() => {
    const ev = liveEvents.find((e) => e.action_type === 'DISCOVERY')
    return Array.isArray(ev?.details?.merchants) ? (ev.details.merchants as string[]) : []
  }, [liveEvents])

  const chatMessages = useMemo(() => {
    const out: ChatMessage[] = []
    for (const ev of liveEvents) {
      const m = humanizeEvent(ev)
      if (m) out.push(m)
    }
    return out
  }, [liveEvents])

  async function findDeals(overrideQuery?: string, overrideBudget?: string) {
    const q = overrideQuery ?? query
    const b = overrideBudget ?? budget
    if (!q.trim()) return

    setLoading(true)
    setResult(null)
    setLiveEvents([])
    wsCleanup.current?.()
    setQuery(q)
    setBudget(b)

    const items = parseQuery(q)
    const body = {
      buyer_id: 'priya_demo',
      type: 'purchase',
      items_requested: items,
      budget_paise: Math.round(parseFloat(b) * 100),
      currency: 'INR',
    }

    try {
      const { data } = await axios.post('/buyer/search', body)
      setSessionId(data.session_id)
      setBuyerToken(data.buyer_token)
      wsCleanup.current = openLiveFeed(data.session_id, (ev) => {
        setLiveEvents((prev) => (prev.some((p) => p.id === ev.id) ? prev : [...prev, ev].slice(-300)))
      })
      poll(data.session_id)
    } catch (e: any) {
      setResult({ status: 'ERROR', recommendation: e?.response?.data?.detail || 'Search failed' })
      setLoading(false)
    }
  }

  async function poll(sid: string) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500))
      try {
        const { data } = await axios.get(`/buyer/session/${sid}`)
        if (data.search_status === 'DONE') {
          setResult(data.result)
          setLoading(false)
          return
        }
      } catch { /* session row may not be committed yet */ }
    }
    setLoading(false)
  }

  async function buy(offerId: string) {
    const { data } = await axios.post(`/buyer/approve/${sessionId}`, {
      offer_id: offerId,
      buyer_id: 'priya_demo',
      buyer_email: 'priya@example.com',
      buyer_token: buyerToken,
    })
    if (data.payment_link?.startsWith('mock://')) {
      await axios.post('/webhooks/mock/notify', {
        session_id: sessionId,
        payment_status: 'captured',
      })
      const offer = result?.all_offers?.find((o) => o.offer_id === offerId)
      navigate('/success', { state: { session_id: sessionId, offer } })
    } else if (data.payment_link) {
      window.open(data.payment_link, '_blank')
    }
  }

  const catalogList = Object.values(CATALOG)
  const bestOffer = result?.best_offer
  const otherOffers = (result?.all_offers ?? []).filter((o) => o !== bestOffer)
  const merchantDisplay = merchants[bestOffer?.merchant_id ?? ''] ?? MERCHANT_META[bestOffer?.merchant_id ?? '']?.blurb ?? merchantName(bestOffer?.merchant_id ?? '')
  const merchantRating = MERCHANT_META[bestOffer?.merchant_id ?? '']

  return (
    <div>
      {/* ── hero ── */}
      <section className="mb-10 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            An AI that shops,{' '}
            <span className="bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">
              haggles & pays
            </span>{' '}
            for you.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Describe what you need. Parley's buyer agent negotiates with real sellers over the x402-IN protocol — you just approve the bill.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl">
          <div className="panel p-5 shadow-lg shadow-ink-950/50">
            <label className="mb-2 block text-left text-sm font-medium text-slate-300">What are you looking for?</label>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                placeholder="Try &quot;2 handmade mugs under 600&quot; or &quot;a set of 3 candles&quot;"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && findDeals()}
              />
              <input
                className="input w-28"
                placeholder="Budget (Rs)"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && findDeals()}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => findDeals(s.query, s.budget)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      s.subtle
                        ? 'border-ink-600 text-slate-500 hover:border-rose/40 hover:text-rose'
                        : 'border-ink-600 text-slate-400 hover:border-accent/50 hover:text-accent'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => findDeals()}
                disabled={loading || !query.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-ink-950" />
                    Negotiating…
                  </span>
                ) : (
                  'Find best price'
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-8 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><span className="text-accent">①</span> Ask</span>
            <span className="flex items-center gap-1.5"><span className="text-accent">②</span> Agent negotiates</span>
            <span className="flex items-center gap-1.5"><span className="text-accent">③</span> You approve & pay</span>
          </div>
        </div>
      </section>

      {/* ── live negotiation ── */}
      {(loading || liveEvents.length > 0) && (
        <section className="mb-10">
          <div className="panel p-6">
            {/* status strip */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <span className={`h-2.5 w-2.5 rounded-full ${loading ? 'bg-accent shadow-glow animate-pulse' : 'bg-mint'}`} />
                {loading ? 'Your agent is negotiating…' : 'Negotiation complete'}
              </h2>
              {sessionId && (
                <Link to={`/theatre?session=${sessionId}`} className="btn-ghost text-xs">
                  view full audit →
                </Link>
              )}
            </div>

            {/* merchant status cards */}
            {merchantsDiscovered.length > 0 && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                {merchantsDiscovered.map((id) => {
                  const st = merchantState(liveEvents, id)
                  const meta = STATUS_META[st] ?? STATUS_META.PENDING
                  const mm = MERCHANT_META[id]
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-4 rounded-xl border bg-ink-850 px-4 py-3 ${meta.border}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-xs font-bold text-accent">
                        {merchantName(id).charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {merchantName(id)}
                          </span>
                          <span className={`chip ${meta.chip}`}>{meta.icon} {meta.label}</span>
                        </div>
                        {mm && (
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <StarRating rating={mm.rating} />
                            <span>{mm.reviews}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* chat feed */}
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {chatMessages.length === 0 && (
                <p className="text-sm text-slate-500">Connecting to the live feed…</p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.side === 'seller' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.side === 'seller'
                        ? 'rounded-tl-md border border-ink-700 bg-ink-850'
                        : msg.side === 'system'
                          ? 'rounded-full border border-violet/30 bg-violet/10 px-3 py-1.5 text-xs'
                          : 'rounded-tr-md bg-accent/10 border border-accent/20'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">{msg.name}</span>
                      {msg.priceLabel && (
                        <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[10px] font-bold text-mint">
                          {msg.priceLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200">{msg.text}</p>
                    {msg.meta && (
                      <div className="mt-1 text-[10px] text-slate-500">{msg.meta}</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
          </div>
        </section>
      )}

      {/* ── best deal ── */}
      {bestOffer && (
        <section className="mb-10">
          <div className="panel p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="text-lg">🎉</span>
              <h2 className="text-xl font-bold text-mint">Best deal for you</h2>
              <span className="chip bg-mint/10 text-mint">verified offer</span>
            </div>

            <div className="flex flex-col gap-6 md:flex-row">
              {/* product art + merchant */}
              <div className="flex flex-col items-center gap-4 md:w-56">
                {(() => {
                  const artId = (bestOffer.items?.[0]?.item_id ?? '') as ArtKind
                  const art: ArtKind = ['mug', 'bowl', 'plate', 'candle'].includes(artId) ? (artId as ArtKind) : 'mug'
                  return <ProductArt kind={art} size={160} />
                })()}
                <div className="text-center">
                  <div className="font-semibold text-white">{merchantDisplay}</div>
                  {merchantRating && (
                    <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                      <StarRating rating={merchantRating.rating} />
                      <span>{merchantRating.reviews}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* details */}
              <div className="flex-1">
                <div className="space-y-2 text-sm text-slate-300">
                  {(bestOffer.items ?? []).map((it) => (
                    <div key={it.item_id} className="flex justify-between">
                      <span>{it.quantity} × {itemName(it.item_id)}</span>
                      <span className="text-slate-400">
                        Rs {bestOffer.pricing?.subtotal_paise != null
                          ? (bestOffer.pricing.subtotal_paise / 100).toFixed(0)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {(bestOffer.pricing?.discounts ?? []).length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-ink-700 pt-3">
                    {bestOffer.pricing!.discounts.map((d) => (
                      <div key={d.rule} className="flex justify-between text-sm text-mint">
                        <span>↓ {d.rule}</span>
                        <span>− Rs {(d.amount_paise / 100).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-ink-700 pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">You pay</div>
                      <div className="mt-1 text-3xl font-extrabold text-white">
                        Rs {bestOffer.pricing?.total_paise != null
                          ? (bestOffer.pricing.total_paise / 100).toFixed(0)
                          : '—'}
                      </div>
                    </div>
                    {bestOffer.pricing?.subtotal_paise != null && bestOffer.pricing.total_paise != null && bestOffer.pricing.total_paise < bestOffer.pricing.subtotal_paise && (
                      <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
                        You save Rs {((bestOffer.pricing.subtotal_paise - bestOffer.pricing.total_paise) / 100).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400 italic">{bestOffer.reasoning}</p>

                <button
                  onClick={() => buy(bestOffer.offer_id!)}
                  className="btn-buy mt-5 w-full text-base"
                >
                  Approve & pay via Razorpay
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Razorpay secures your payment · funds held in escrow until dispatch
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── no deal / other offers ── */}
      {result && !bestOffer && (
        <section className="mb-10">
          <div className="panel p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-lg">😔</span>
              <h2 className="text-xl font-bold text-amber">No deal found</h2>
            </div>
            <p className="text-sm text-slate-300">{result.recommendation}</p>
            <p className="mt-2 text-xs text-slate-400">
              Try raising your budget, reducing quantity, or picking a different item.
            </p>
          </div>
        </section>
      )}

      {otherOffers.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="card-title">All merchant responses</h2>
            <span className="text-xs text-slate-500">{otherOffers.length + (bestOffer ? 1 : 0)} total</span>
          </div>
          <div className="space-y-2">
            {otherOffers.map((o) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.ERROR
              return (
                <div key={o.merchant_id} className={`flex items-center justify-between rounded-xl border bg-ink-900/60 px-4 py-3 ${meta.border}`}>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white">{merchantName(o.merchant_id)}</span>
                    <p className="mt-0.5 text-xs text-slate-400 truncate">{o.reasoning}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    {o.pricing && (
                      <span className="text-sm font-bold text-white">Rs {(o.pricing.total_paise / 100).toFixed(0)}</span>
                    )}
                    <span className={`chip ${meta.chip}`}>{meta.icon} {meta.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── agent log (collapsed) ── */}
      {liveEvents.length > 0 && (
        <section className="mb-10">
          <button
            onClick={() => setShowLog((v) => !v)}
            className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-accent transition"
          >
            <span className={`transition-transform ${showLog ? 'rotate-90' : ''}`}>▸</span>
            Agent activity log ({liveEvents.length} events)
          </button>
          {showLog && (
            <div className="panel p-4 max-h-64 overflow-y-auto">
              <ul className="space-y-1">
                {liveEvents.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 rounded px-2 py-1 text-xs text-slate-400 hover:bg-ink-800/50">
                    <span className="w-4 shrink-0 text-center text-slate-500">
                      {ev.action_type === 'SESSION_STARTED' && '▶'}
                      {ev.action_type === 'DISCOVERY' && '🛰'}
                      {ev.action_type === 'NEGOTIATION' && '💬'}
                      {ev.action_type === 'OFFER_STORED' && '📦'}
                      {ev.action_type === 'NO_DEAL' && '😔'}
                      {ev.action_type === 'PAYMENT_CAPTURED' && '💳'}
                      {!['SESSION_STARTED', 'DISCOVERY', 'NEGOTIATION', 'OFFER_STORED', 'NO_DEAL', 'PAYMENT_CAPTURED'].includes(ev.action_type) && '•'}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium text-slate-300">{ev.action_type.replace(/_/g, ' ').toLowerCase()}</span>
                      {ev.details?.merchant_id && (
                        <span className="ml-1 text-slate-500">({merchantName(ev.details.merchant_id)})</span>
                      )}
                      {ev.details?.reasoning && (
                        <span className="ml-1">{ev.details.reasoning}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-600">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── catalogue ── */}
      {!loading && !result && (
        <section>
          <h2 className="mb-4 card-title">Fresh from the registry</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {catalogList.map((item) => {
              const mm = MERCHANT_META[item.merchant]
              return (
                <div
                  key={item.id}
                  className="panel group cursor-pointer overflow-hidden transition hover:border-accent/40 hover:shadow-glow"
                  onClick={() => findDeals(`I need 1 ${item.name.toLowerCase()}`, String(item.budgetPaise / 100))}
                >
                  <div className="flex justify-center pt-5">
                    <ProductArt kind={item.art} size={130} />
                  </div>
                  <div className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-white">{item.name}</span>
                      {item.tag && (
                        <span className="chip bg-accent/10 text-accent">{item.tag}</span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {merchantName(item.merchant)}
                      {mm && <span className="ml-1 text-amber">★ {mm.rating}</span>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-white">Rs {(item.basePaise / 100).toFixed(0)}</span>
                      <span className="text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
                        negotiate & buy →
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}