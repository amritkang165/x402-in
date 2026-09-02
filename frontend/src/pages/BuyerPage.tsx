import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import type { LiveEvent } from '../types/live'
import { openLiveFeed } from '../lib/live'
import { humanizeEvent, type ChatMessage } from '../lib/shop'
import {
  CATALOG,
  MERCHANT_META,
  PRODUCTS,
  CATEGORIES,
  merchantName,
  itemName,
  type Product,
  type Category,
} from '../lib/shop'

interface Offer {
  merchant_id: string
  status: string
  reasoning: string
  pricing?: { subtotal_paise: number; total_paise: number; discounts: { rule: string; amount_paise: number }[] }
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

type SortKey = 'popular' | 'low' | 'high'

interface CartLine {
  product: Product
  qty: number
}

function parseQuery(q: string): { item_id: string; quantity: number }[] {
  const lower = q.toLowerCase()
  let qty = 1
  const m = lower.match(/(\d+)/)
  if (m && parseInt(m[1]) > 0) qty = parseInt(m[1])
  if (lower.includes('candle')) return [{ item_id: 'candle_001', quantity: qty }]
  if (lower.includes('bowl')) return [{ item_id: 'bowl_001', quantity: qty }]
  if (lower.includes('plate')) return [{ item_id: 'plate_001', quantity: qty }]
  return [{ item_id: 'mug_001', quantity: qty }]
}

function budgetFor(q: string): string {
  return String(
    Math.max(
      1,
      parseQuery(q).reduce((s, r) => s + (CATALOG[r.item_id]?.budgetPaise ?? 0) * r.quantity, 0) / 100,
    ),
  )
}

function rs(paise: number | null | undefined): string {
  if (paise == null) return '—'
  return 'Rs ' + Number((paise / 100).toFixed(0)).toLocaleString('en-IN')
}

function pctOff(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className="rounded bg-green-700 px-1 py-px font-semibold text-white">{rating.toFixed(1)} ★</span>
      <span className="text-gray-500">({Math.round(rating * 80 + 40)})</span>
    </span>
  )
}

export default function BuyerPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [buyerToken, setBuyerToken] = useState('')
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const wsCleanup = useRef<(() => void) | null>(null)
  const chatEnd = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('popular')
  const [cart, setCart] = useState<CartLine[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [selQty, setSelQty] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => () => wsCleanup.current?.(), [])
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [liveEvents])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const chatMessages = useMemo(() => {
    const out: ChatMessage[] = []
    for (const ev of liveEvents) {
      const m = humanizeEvent(ev)
      if (m) out.push(m)
    }
    return out
  }, [liveEvents])

  const desiredItems = useMemo(() => (query.trim() ? parseQuery(query) : []), [query])
  const best = result?.best_offer
  const negotiatedTotal = best?.pricing?.total_paise ?? null
  const listTotal = desiredItems.reduce((s, r) => s + (CATALOG[r.item_id]?.basePaise ?? 0) * r.quantity, 0)
  const savedPaise = listTotal - (negotiatedTotal ?? 0)
  const otherOffers = (result?.all_offers ?? []).filter((o) => o !== best)

  const cartCount = cart.reduce((s, l) => s + l.qty, 0)
  const cartTotal = cart.reduce((s, l) => s + l.product.pricePaise * l.qty, 0)

  const visibleProducts = useMemo(() => {
    let list = category === 'all' ? [...PRODUCTS] : PRODUCTS.filter((p) => p.category === category)
    if (sort === 'low') list.sort((a, b) => a.pricePaise - b.pricePaise)
    else if (sort === 'high') list.sort((a, b) => b.pricePaise - a.pricePaise)
    else list.sort((a, b) => b.sold.localeCompare(a.sold, undefined, { numeric: true }) || b.rating - a.rating)
    return list
  }, [category, sort])

  function clearState() {
    setResult(null)
    setLiveEvents([])
    setSessionId('')
    setBuyerToken('')
  }

  async function findDeals(q?: string) {
    const search = (q ?? query).trim()
    if (!search) return
    setQuery(search)
    setLoading(true)
    clearState()
    const items = parseQuery(search)
    const body = {
      buyer_id: 'priya_demo',
      type: 'purchase',
      items_requested: items,
      budget_paise: Math.round(parseFloat(budgetFor(search)) * 100),
      currency: 'INR',
    }
    try {
      const { data } = await axios.post('/buyer/search', body)
      setSessionId(data.session_id)
      setBuyerToken(data.buyer_token)
      wsCleanup.current = openLiveFeed(data.session_id, (ev) => {
        setLiveEvents((prev) => (prev.some((p) => p.id === ev.id) ? prev : [...prev, ev].slice(-200)))
      })
      poll(data.session_id)
    } catch (e: any) {
      setResult({ status: 'ERROR', recommendation: e?.response?.data?.detail || 'Something went wrong. Please try again.' })
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
      } catch {
        /* not yet committed */
      }
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
      await axios.post('/webhooks/mock/notify', { session_id: sessionId, payment_status: 'captured' })
      const offer = result?.all_offers?.find((o) => o.offer_id === offerId)
      navigate('/success', { state: { session_id: sessionId, offer } })
    } else if (data.payment_link) {
      window.open(data.payment_link, '_blank')
    }
  }

  function openProduct(p: Product) {
    setSelected(p)
    setSelQty(1)
  }

  function addToCart(p: Product, qty = 1) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + qty }
        return next
      }
      return [...prev, { product: p, qty }]
    })
    setSelected(null)
    setCartOpen(true)
    setToast(`${p.name} added to bag`)
  }

  function negotiateFromCart() {
    if (cart.length === 0) return
    // Combine all cart lines into one negotiation request
    const itemsText = cart
      .map((l) => `${l.qty} ${itemName(l.product.itemId).toLowerCase().replace('ceramic ', '').split(' ')[0]}${l.qty > 1 ? 's' : ''}`)
      .join(' and ')
    setQuery(itemsText)
    setCartOpen(false)
    setLoading(false)
    clearState()
    setTimeout(() => findDeals(itemsText), 50)
  }

  const mm = best ? MERCHANT_META[best.merchant_id] : undefined
  const showSearchPanel = loading || liveEvents.length > 0 || result != null
  const primaryImage = selected
    ? selected.image
    : desiredItems[0]
      ? PRODUCTS.find((p) => p.itemId === desiredItems[0].item_id)?.image
      : undefined

  return (
    <div>
      {/* offers bar */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600">
        <span>Cod available</span>
        <span className="hidden sm:inline">·</span>
        <span>7-day easy returns</span>
        <span className="hidden sm:inline">·</span>
        <span>Free shipping over Rs 999</span>
      </div>

      {/* hero / request strip */}
      <div className="mb-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row">
          <div className="flex w-full flex-1 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 shadow-sm">
            <span className="text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m21 21-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              placeholder='Try "2 mugs" or "3 soy candles" — ask your buyer agent'
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (showSearchPanel) clearState() }}
              onKeyDown={(e) => e.key === 'Enter' && findDeals()}
            />
            <button
              onClick={() => findDeals()}
              disabled={loading || !query.trim()}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? '…' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* live negotiation */}
      {(loading || liveEvents.length > 0) && result == null && (
        <section className="mx-auto mb-10 max-w-2xl">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {loading && <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />}
                {loading ? 'Your buyer agent is negotiating…' : 'Negotiation done'}
              </h3>
              {sessionId && (
                <Link to={`/theatre?session=${sessionId}`} className="text-xs text-brand-600 hover:text-brand-700">
                  View audit trail
                </Link>
              )}
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {chatMessages.length === 0 && <p className="text-sm text-gray-400">Reaching out to sellers…</p>}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.side === 'seller' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] px-3.5 py-2 ${
                      msg.side === 'seller'
                        ? 'rounded-2xl rounded-tl-sm border border-gray-200 bg-white'
                        : 'rounded-2xl rounded-tr-sm border border-brand-100 bg-brand-50'
                    }`}
                  >
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-900">{msg.name}</span>
                      <span className="text-[10px] text-gray-400">{msg.time}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-800">{msg.text}</p>
                    {msg.price != null && <div className="mt-1 text-sm font-semibold text-gray-900">{rs(msg.price)}</div>}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
          </div>
        </section>
      )}

      {/* result */}
      {result && result.status === 'SUCCESS' && best && (
        <section className="mx-auto mb-10 max-w-3xl">
          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-semibold text-gray-900">Best price we found</h3>
              <button onClick={clearState} className="text-xs text-gray-400 hover:text-gray-600">
                Start over
              </button>
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex items-start gap-4">
                {primaryImage && (
                  <img src={primaryImage} alt="" width={96} height={96} className="shrink-0 rounded-lg object-cover" />
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    {desiredItems.map((r) => `${r.quantity} × ${itemName(r.item_id)}`).join(', ')}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">{merchantName(best.merchant_id)}</div>
                  {mm && (
                    <div className="mt-1">
                      <Stars rating={mm.rating} />
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:ml-auto sm:text-right">
                <div className="text-sm text-gray-400 line-through">{rs(listTotal)}</div>
                <div className="text-2xl font-semibold text-gray-900">{rs(negotiatedTotal)}</div>
                {savedPaise > 0 && <div className="mt-0.5 text-xs font-medium text-green-700">You save {rs(savedPaise)}</div>}
              </div>
            </div>
            <button onClick={() => buy(best.offer_id!)} className="btn-primary mt-6 w-full sm:w-auto">
              Pay {rs(negotiatedTotal)} securely
            </button>
            <p className="mt-2 text-xs text-gray-400">Paid via Razorpay · funds held until dispatch.</p>
          </div>
        </section>
      )}

      {/* no deal / error */}
      {result && result.status !== 'SUCCESS' && (
        <section className="mx-auto mb-10 max-w-2xl">
          <div className="card p-5 text-center">
            <p className="text-sm text-gray-700">{result.recommendation}</p>
            <p className="mt-1 text-xs text-gray-400">Try a different item, or raise your budget.</p>
          </div>
        </section>
      )}

      {/* other quotes */}
      {otherOffers.length > 0 && (
        <section className="mx-auto mb-10 max-w-3xl">
          <h3 className="eyebrow mb-3">All seller quotes</h3>
          <div className="space-y-2">
            {otherOffers.map((o) => (
              <div key={o.merchant_id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{merchantName(o.merchant_id)}</div>
                  <div className="truncate text-xs text-gray-500">{o.reasoning}</div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  {o.pricing && <div className="text-sm font-semibold text-gray-900">{rs(o.pricing.total_paise)}</div>}
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* catalogue (hidden during active negotiation unless cart button used) */}
      {!showSearchPanel && (
        <section>
          {/* category nav */}
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  category === c.id ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {c.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-sm">
              <span className="text-xs text-gray-400">Sort</span>
              {(
                [
                  ['popular', 'Popularity'],
                  ['low', 'Price: Low to High'],
                  ['high', 'Price: High to Low'],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    sort === k ? 'text-brand-700' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {visibleProducts.map((p) => {
              const off = pctOff(p.pricePaise, p.mrpPaise)
              return (
                <div key={p.id} className="card group overflow-hidden transition-shadow hover:shadow-md">
                  <button className="block w-full" onClick={() => openProduct(p)}>
                    <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                      <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      {p.tag && (
                        <span className="absolute left-2 top-2 bg-gray-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {p.tag}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button className="text-left" onClick={() => openProduct(p)}>
                        <span className="text-sm font-medium text-gray-900 hover:text-brand-700">{p.name}</span>
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{merchantName(p.merchant)}</p>
                    <div className="mt-1">
                      <Stars rating={p.rating} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-[15px] font-semibold text-gray-900">{rs(p.pricePaise)}</span>
                      {off > 0 && (
                        <>
                          <span className="text-xs text-gray-400 line-through">{rs(p.mrpPaise)}</span>
                          <span className="text-xs font-medium text-green-700">{off}% off</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className="mt-2 w-full rounded-md border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Add to bag
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            Your buyer agent negotiates the price with every seller before you pay.
          </p>
        </section>
      )}

      {/* sticky cart bar */}
      {!showSearchPanel && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-5 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                {cartCount} {cartCount === 1 ? 'item' : 'items'} · {rs(cartTotal)}
              </div>
              <button onClick={() => setCartOpen(true)} className="text-xs text-gray-500 hover:text-brand-700">
                View bag
              </button>
            </div>
            <button onClick={negotiateFromCart} className="btn-primary">
              Negotiate {rs(cartTotal)} →
            </button>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* product detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="text-base font-semibold text-gray-900">Product details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                <img src={selected.image} alt={selected.name} className="h-full w-full object-cover" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-gray-900">{rs(selected.pricePaise)}</span>
                <span className="text-sm text-gray-400 line-through">{rs(selected.mrpPaise)}</span>
                <span className="text-sm font-medium text-green-700">{pctOff(selected.pricePaise, selected.mrpPaise)}% off</span>
              </div>
              {selected.tag && <span className="tag mt-2 bg-brand-50 text-brand-700">{selected.tag}</span>}
              <h2 className="mt-2 text-lg font-semibold text-gray-900">{selected.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{selected.desc}</p>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <h4 className="eyebrow mb-2">Seller</h4>
                <div className="text-sm text-gray-900">{merchantName(selected.merchant)}</div>
                {MERCHANT_META[selected.merchant] && (
                  <div className="text-xs text-gray-500">{MERCHANT_META[selected.merchant].blurb}</div>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <h4 className="eyebrow mb-2">Delivery</h4>
                <div className="text-sm text-gray-700">Free · Arrives by Fri, Sep 11</div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold text-gray-900">{rs(selected.pricePaise * selQty)}</span>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200">
                    <button onClick={() => setSelQty((q) => Math.max(1, q - 1))} className="px-3 py-1 text-gray-600 hover:bg-gray-50">−</button>
                    <span className="w-8 text-center text-sm font-medium">{selQty}</span>
                    <button onClick={() => setSelQty((q) => q + 1)} className="px-3 py-1 text-gray-600 hover:bg-gray-50">+</button>
                  </div>
                </div>
                <button onClick={() => addToCart(selected, selQty)} className="btn-primary mt-4 w-full">
                  Add to bag · {rs(selected.pricePaise * selQty)}
                </button>
                <button
                  onClick={() => {
                    const itemsText = `${selQty} ${itemName(selected.itemId)}`
                    setSelected(null)
                    findDeals(itemsText)
                  }}
                  className="mt-2 w-full rounded-lg border border-brand-600 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Negotiate this price
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="text-base font-semibold text-gray-900">Your bag ({cartCount})</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 && <p className="text-sm text-gray-400">Your bag is empty.</p>}
              {cart.map((line) => (
                <div key={line.product.id} className="mb-4 flex gap-3">
                  <img src={line.product.image} alt="" width={72} height={72} className="shrink-0 rounded-md object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{line.product.name}</div>
                    <div className="text-xs text-gray-500">{merchantName(line.product.merchant)}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{rs(line.product.pricePaise * line.qty)}</div>
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="flex items-center rounded-md border border-gray-200">
                      <button
                        onClick={() => setCart((prev) => prev.flatMap((l) => (l.product.id === line.product.id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])))}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{line.qty}</span>
                      <button
                        onClick={() => setCart((prev) => prev.map((l) => (l.product.id === line.product.id ? { ...l, qty: l.qty + 1 } : l)))}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-900">{rs(cartTotal)}</span>
              </div>
              <button onClick={negotiateFromCart} disabled={cart.length === 0} className="btn-primary w-full">
                Negotiate all items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
