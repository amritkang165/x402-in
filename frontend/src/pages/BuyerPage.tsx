import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import type { LiveEvent } from '../types/live'
import { openLiveFeed } from '../lib/live'
import { humanizeEvent, type ChatMessage } from '../lib/shop'
import { CATALOG, MERCHANT_META, merchantName, itemName } from '../lib/shop'
import ProductArt from '../components/ProductArt'

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

const SUGGESTIONS = ['2 handmade mugs', '3 candles', '1 serving bowl', '1 dinner plate']

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
  return 'Rs ' + (paise / 100).toLocaleString('en-IN')
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

  useEffect(() => () => wsCleanup.current?.(), [])
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [liveEvents])

  const chatMessages = useMemo(() => {
    const out: ChatMessage[] = []
    for (const ev of liveEvents) {
      const m = humanizeEvent(ev)
      if (m) out.push(m)
    }
    return out
  }, [liveEvents])

  const desiredItems = useMemo(() => (query.trim() ? parseQuery(query) : []), [query])
  const primary = desiredItems[0] ? CATALOG[desiredItems[0].item_id] : undefined
  const best = result?.best_offer
  const negotiatedTotal = best?.pricing?.total_paise ?? null
  const listTotal = desiredItems.reduce((s, r) => s + (CATALOG[r.item_id]?.basePaise ?? 0) * r.quantity, 0)
  const totalListWithMrp = desiredItems.reduce((s, r) => s + (CATALOG[r.item_id]?.mrpPaise ?? 0) * r.quantity, 0)
  const savedPaise = listTotal - (negotiatedTotal ?? 0)
  const otherOffers = (result?.all_offers ?? []).filter((o) => o !== best)

  function clearState() {
    setResult(null)
    setLiveEvents([])
    setSessionId('')
    setBuyerToken('')
  }

  async function findDeals() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    clearState()
    const items = parseQuery(q)
    const body = {
      buyer_id: 'priya_demo',
      type: 'purchase',
      items_requested: items,
      budget_paise: Math.round(parseFloat(budgetFor(q)) * 100),
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

  function requestItem(id: string) {
    setQuery(`1 ${CATALOG[id].name}`)
    clearState()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showSearchPanel = loading || liveEvents.length > 0 || result != null
  const mm = best ? MERCHANT_META[best.merchant_id] : undefined

  return (
    <div>
      {/* offers bar */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-xs text-gray-500">
        Free shipping over Rs 999&nbsp;&nbsp;·&nbsp;&nbsp;COD available&nbsp;&nbsp;·&nbsp;&nbsp;7-day returns
      </div>

      {/* request bar */}
      <div className="mx-auto mb-10 max-w-2xl">
        <label htmlFor="need" className="eyebrow mb-2 block">
          Tell your buyer agent what you need
        </label>
        <div className="flex gap-2">
          <input
            id="need"
            className="input"
            placeholder='e.g. "2 handmade mugs" or "3 soy candles"'
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (showSearchPanel) clearState() }}
            onKeyDown={(e) => e.key === 'Enter' && findDeals()}
          />
          <button onClick={findDeals} disabled={loading || !query.trim()} className="btn-primary shrink-0">
            {loading ? 'Looking…' : 'Get best price'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); clearState() }}
              className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* live negotiation */}
      {(loading || liveEvents.length > 0) && result == null && (
        <section className="mx-auto mb-10 max-w-2xl">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {loading ? 'Negotiating with sellers…' : 'Negotiation done'}
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
                {primary && <ProductArt kind={primary.art} size={96} className="shrink-0" />}
                <div>
                  <div className="font-medium text-gray-900">
                    {desiredItems.map((r) => `${r.quantity} × ${itemName(r.item_id)}`).join(', ')}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">{merchantName(best.merchant_id)}</div>
                  {mm && (
                    <div className="mt-1 text-xs text-gray-500">
                      <span className="font-medium text-green-700">★ {mm.rating.toFixed(1)}</span> · {mm.reviews}
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:ml-auto sm:text-right">
                {totalListWithMrp > 0 && (
                  <div className="text-sm text-gray-400 line-through">{rs(totalListWithMrp)}</div>
                )}
                <div className="text-2xl font-semibold text-gray-900">{rs(negotiatedTotal)}</div>
                {savedPaise > 0 && <div className="text-xs font-medium text-green-700">MRP {rs(listTotal)} → you save {rs(savedPaise)}</div>}
              </div>
            </div>

            <button onClick={() => buy(best.offer_id!)} className="btn-primary mt-6 w-full sm:w-auto">
              Pay {rs(negotiatedTotal)}
            </button>
            <p className="mt-2 text-xs text-gray-400">Paid securely via Razorpay. Funds held until dispatch.</p>
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

      {/* catalogue grid */}
      {!showSearchPanel && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-gray-900">Handmade homeware</h2>
            <span className="text-xs text-gray-400">4 items</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(CATALOG).map((item) => {
              const m = MERCHANT_META[item.merchant]
              return (
                <div key={item.id} className="card overflow-hidden transition-shadow hover:shadow-sm">
                  <button
                    className="flex w-full flex-col items-stretch text-left"
                    onClick={() => requestItem(item.id)}
                  >
                    <div className="flex items-center justify-center py-5">
                      <ProductArt kind={item.art} size={120} />
                    </div>
                    <div className="border-t border-gray-100 p-4">
                      {item.tag && <div className="tag mb-1 bg-brand-50 text-brand-700">{item.tag}</div>}
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.desc}</p>
                      <div className="mt-2 text-xs text-gray-400">
                        {merchantName(item.merchant)}
                        {m && <span className="text-gray-600"> · ★ {m.rating.toFixed(1)}</span>}
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <span className="text-base font-semibold text-gray-900">{rs(item.basePaise)}</span>
                          <span className="ml-1.5 text-xs text-gray-400 line-through">{rs(item.mrpPaise)}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{item.sold}</span>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
