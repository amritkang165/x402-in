import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import type { LiveEvent } from '../types/live'
import { openLiveFeed } from '../lib/live'
import { fmtRs, STATUS_META } from '../lib/meta'

interface Alternative {
  item_id: string
  quantity: number
  reason: string
}

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
  suggested_alternatives?: Alternative[]
  offer_id?: string
}

interface Result {
  status: string
  session_id?: string
  recommendation?: string
  best_offer?: Offer & { offer_id: string }
  all_offers?: Offer[]
}

const SCENARIOS = [
  { label: '2 mugs · ₹600', query: 'I need 2 handmade mugs', budget: '600' },
  { label: '2 mugs · ₹400 (reject)', query: 'I need 2 handmade mugs', budget: '400' },
  { label: '3 candles · ₹800 (bundle)', query: 'I need 3 candles', budget: '800' },
]

const EVENT_ICON: Record<string, string> = {
  SESSION_STARTED: '▶',
  DISCOVERY: '🛰',
  NEGOTIATION: '💬',
  OFFER_STORED: '📦',
  NO_DEAL: '😔',
  SETTLEMENT_INITIATED: '🧾',
  PAYMENT_CAPTURED: '💳',
  PAYMENT_FAILED: '⛔',
}

function merchantState(events: LiveEvent[], id: string): string {
  const neg = events.filter(
    (e) => e.action_type === 'NEGOTIATION' && e.details?.merchant_id === id,
  )
  if (neg.length) return neg[neg.length - 1].details?.status || 'NEGOTIATING'
  return 'PENDING'
}

function eventLine(ev: LiveEvent): string {
  switch (ev.action_type) {
    case 'SESSION_STARTED':
      return 'Session started'
    case 'DISCOVERY': {
      const n = Array.isArray(ev.details?.merchants) ? ev.details.merchants.length : 0
      return `Discovered ${n} merchant${n === 1 ? '' : 's'} in the registry`
    }
    case 'NEGOTIATION': {
      const d = ev.details
      const status = d?.status ? (STATUS_META[d.status]?.label ?? d.status) : ''
      const price = d?.total_paise != null ? ` · ${fmtRs(d.total_paise)}` : ''
      return `Negotiation → ${status}${price}`
    }
    case 'OFFER_STORED':
      return `Best offer stored${
        ev.details?.total_paise != null ? ` · ${fmtRs(ev.details.total_paise)}` : ''
      }`
    case 'NO_DEAL':
      return 'No deal — every merchant exceeded your budget'
    case 'PAYMENT_CAPTURED':
      return 'Payment captured — session PAID'
    default:
      return ev.action_type.split('_').join(' ').toLowerCase()
  }
}

export default function BuyerPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [budget, setBudget] = useState('600')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [buyerToken, setBuyerToken] = useState('')
  const [payLink, setPayLink] = useState('')
  const [auditMsg, setAuditMsg] = useState('')
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [merchants, setMerchants] = useState<Record<string, string>>({})
  const wsCleanup = useRef<(() => void) | null>(null)

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

  const merchantsDiscovered = useMemo(() => {
    const ev = liveEvents.find((e) => e.action_type === 'DISCOVERY')
    return Array.isArray(ev?.details?.merchants) ? (ev.details.merchants as string[]) : []
  }, [liveEvents])

  const feedCount = liveEvents.length

  async function findDeals() {
    setLoading(true)
    setResult(null)
    setPayLink('')
    setAuditMsg('')
    setLiveEvents([])
    wsCleanup.current?.()
    const items = parseQuery(query)
    const body = {
      buyer_id: 'priya_demo',
      type: 'purchase',
      items_requested: items,
      budget_paise: Math.round(parseFloat(budget) * 100),
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
      } catch {
        // session row may not be committed yet; keep polling
      }
    }
    setLoading(false)
  }

  function applyScenario(s: (typeof SCENARIOS)[number]) {
    setQuery(s.query)
    setBudget(s.budget)
  }

  async function buy(offerId: string) {
    const { data } = await axios.post(`/buyer/approve/${sessionId}`, {
      offer_id: offerId,
      buyer_id: 'priya_demo',
      buyer_email: 'priya@example.com',
      buyer_token: buyerToken,
    })
    if (data.payment_link && data.payment_link.startsWith('mock://')) {
      await axios.post('/webhooks/mock/notify', {
        session_id: sessionId,
        payment_status: 'captured',
      })
      setPayLink('CAPTURED')
      const offer = result?.all_offers?.find((o) => o.offer_id === offerId)
      navigate('/success', { state: { session_id: sessionId, offer } })
    } else if (data.payment_link) {
      window.open(data.payment_link, '_blank')
      setPayLink(data.payment_link)
    }
  }

  async function verifyAudit() {
    const { data } = await axios.get(`/buyer/session/${sessionId}/audit/verify`)
    setAuditMsg(data.message)
  }

  const counts = (result?.all_offers ?? []).reduce(
    (acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }),
    {} as Record<string, number>,
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-white">
            Buyer <span className="text-accent">Agent</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            State a need; the buyer agent negotiates with every merchant in parallel — live.
          </p>
        </div>
        {sessionId && (
          <Link to={`/theatre?session=${sessionId}`} className="btn-ghost text-xs">
            Open in Theatre →
          </Link>
        )}
      </div>

      <div className="panel p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => applyScenario(s)}
              className="rounded-full border border-ink-600 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-accent/60 hover:text-accent"
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-300">What do you need?</label>
        <textarea
          className="input mb-4"
          rows={2}
          placeholder="I need 2 handmade mugs under Rs. 600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Budget (Rs.)</label>
            <input
              className="input w-32"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <button onClick={findDeals} disabled={loading} className="btn-primary">
            {loading ? 'Negotiating…' : 'Find Deals'}
          </button>
        </div>
      </div>

      {(loading || liveEvents.length > 0) && (
        <div className="panel mt-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-sm font-bold tracking-wide text-white">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  loading ? 'bg-accent shadow-glow animate-pulse' : 'bg-mint'
                }`}
              />
              {loading ? 'Negotiators at work…' : 'Negotiation complete'}
            </h2>
            <span className="font-mono text-xs text-slate-500">
              {feedCount} events{loading ? '' : ' · done'}
            </span>
          </div>

          {merchantsDiscovered.length > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {merchantsDiscovered.map((id) => {
                const st = merchantState(liveEvents, id)
                const meta = STATUS_META[st] ?? STATUS_META.PENDING
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 ${meta.border}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span className="truncate text-sm font-medium text-slate-200">
                        {merchants[id] ?? id}
                      </span>
                    </span>
                    <span className={`chip ${meta.chip}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {liveEvents.length === 0 && (
            <p className="text-sm text-slate-500">Connecting to the live feed…</p>
          )}

          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {liveEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 rounded-lg px-2 py-1 text-sm hover:bg-ink-800/60">
                <span className="w-5 shrink-0 text-center">{EVENT_ICON[ev.action_type] ?? '•'}</span>
                <span className="text-slate-300">{eventLine(ev)}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-500">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="panel mt-6 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div
              className={`flex items-center gap-2 text-lg font-bold ${
                result.status === 'SUCCESS' ? 'text-mint' : 'text-rose'
              }`}
            >
              <span className="text-2xl">{result.status === 'SUCCESS' ? '🎉' : '😔'}</span>
              {result.status === 'SUCCESS' ? 'Deal found' : 'No deal'}
            </div>
            <div className="ml-auto flex gap-2">
              {Object.entries(counts).map(([status, n]) => (
                <span key={status} className={`chip ${STATUS_META[status]?.chip ?? 'bg-ink-700 text-slate-400'}`}>
                  {STATUS_META[status]?.label ?? status}: {n}
                </span>
              ))}
            </div>
          </div>
          <p className="text-slate-300">{result.recommendation}</p>

          {result.status === 'NO_DEAL' && (
            <p className="mt-2 text-sm text-slate-400">
              Every merchant's lowest price was above your budget, or no merchant responded. Use the
              suggestions below to adjust quantity or raise your budget.
            </p>
          )}

          {result.all_offers?.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.ERROR
            return (
              <div key={o.merchant_id} className={`mt-3 rounded-xl border-2 ${meta.border} bg-ink-850/60 p-4`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">
                    {merchants[o.merchant_id] ?? o.merchant_id}
                  </span>
                  <span className={`chip ${meta.chip}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <p className={`mt-1 text-sm ${meta.text}`}>{o.reasoning}</p>

                {o.pricing && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span className="text-slate-400">Subtotal: {fmtRs(o.pricing.subtotal_paise)}</span>
                    {o.pricing.discounts.map((d) => (
                      <span key={d.rule} className="text-mint">
                        − {fmtRs(d.amount_paise)} ({d.rule})
                      </span>
                    ))}
                    <span className="font-bold text-white">Total: {fmtRs(o.pricing.total_paise)}</span>
                  </div>
                )}

                {o.status === 'REJECT' && o.suggested_alternatives?.length ? (
                  <div className="mt-3">
                    <div className="card-title mb-1">Merchant suggests</div>
                    {o.suggested_alternatives.map((a, i) => (
                      <span
                        key={i}
                        className="mr-2 inline-flex items-center gap-1 rounded-full border border-rose/40 bg-rose/5 px-3 py-1 text-xs text-rose"
                      >
                        {a.quantity} × {a.item_id} — {a.reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                {o.status === 'COUNTER' && o.next_action && (
                  <p className="mt-2 text-xs text-slate-400">next: {o.next_action}</p>
                )}

                {o.offer_id && o.status === 'OFFER' && (
                  <button onClick={() => buy(o.offer_id!)} className="btn-mint mt-3">
                    Buy now
                  </button>
                )}
              </div>
            )
          })}

          {payLink && (
            <div className="mt-4 rounded-lg border border-mint/40 bg-mint/10 p-4 font-medium text-mint">
              {payLink === 'CAPTURED' ? 'Payment captured. Deal closed ✓' : `Complete payment: ${payLink}`}
            </div>
          )}

          {result.status === 'SUCCESS' && (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={verifyAudit} className="btn-ghost">
                Verify Audit Chain
              </button>
              {auditMsg && <span className="text-sm text-slate-400">{auditMsg}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function parseQuery(query: string): { item_id: string; quantity: number }[] {
  const q = query.toLowerCase()
  let quantity = 1
  const m = q.match(/(\d+)/)
  if (m) quantity = parseInt(m[1])
  if (q.includes('candle')) return [{ item_id: 'candle_001', quantity }]
  if (q.includes('bowl')) return [{ item_id: 'bowl_001', quantity }]
  if (q.includes('plate')) return [{ item_id: 'plate_001', quantity }]
  return [{ item_id: 'mug_001', quantity }]
}