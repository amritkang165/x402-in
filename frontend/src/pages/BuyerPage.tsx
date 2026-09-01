import { useState } from 'react'
import axios from 'axios'

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

const STATUS_META: Record<string, { label: string; border: string; chip: string; icon: string }> = {
  OFFER: { label: 'Offer', border: 'border-green-300', chip: 'bg-green-100 text-green-700', icon: '✓' },
  COUNTER: { label: 'Counter-offer', border: 'border-amber-300', chip: 'bg-amber-100 text-amber-700', icon: '↔' },
  REJECT: { label: 'Rejected', border: 'border-red-300', chip: 'bg-red-100 text-red-700', icon: '✕' },
  TIMEOUT: { label: 'Timed out', border: 'border-slate-300 border-dashed', chip: 'bg-slate-100 text-slate-600', icon: '…' },
  ERROR: { label: 'Error', border: 'border-slate-300', chip: 'bg-slate-100 text-slate-600', icon: '!' },
}

export default function BuyerPage() {
  const [query, setQuery] = useState('')
  const [budget, setBudget] = useState('600')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [payLink, setPayLink] = useState('')
  const [auditMsg, setAuditMsg] = useState('')

  async function findDeals() {
    setLoading(true)
    setResult(null)
    setPayLink('')
    setAuditMsg('')
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
    })
    if (data.payment_link && data.payment_link.startsWith('mock://')) {
      await axios.post('/webhooks/mock/notify', { session_id: sessionId, payment_status: 'captured' })
      setPayLink('CAPTURED')
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
      <h1 className="text-3xl font-bold mb-2">Buyer Agent</h1>
      <p className="text-slate-600 mb-4">State a need; the buyer agent negotiates with every merchant in parallel.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => applyScenario(s)}
            className="border border-indigo-200 text-indigo-600 text-sm rounded-full px-3 py-1 hover:bg-indigo-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <label className="block text-sm font-medium mb-1">What do you need?</label>
        <textarea
          className="w-full border rounded-lg p-3 mb-4"
          rows={2}
          placeholder="I need 2 handmade mugs under Rs. 600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Budget (Rs.)</label>
            <input
              className="border rounded-lg p-2 w-32"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <button
            onClick={findDeals}
            disabled={loading}
            className="bg-indigo-600 text-white rounded-lg px-5 py-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Negotiating…' : 'Find Deals'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex items-center gap-2 text-lg font-semibold ${result.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
              <span className="text-2xl">{result.status === 'SUCCESS' ? '🎉' : '😔'}</span>
              {result.status === 'SUCCESS' ? 'Deal found' : 'No deal'}
            </div>
            <div className="flex gap-2 ml-auto">
              {Object.entries(counts).map(([status, n]) => (
                <span key={status} className={`text-xs font-medium rounded-full px-2 py-1 ${STATUS_META[status]?.chip ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_META[status]?.label ?? status}: {n}
                </span>
              ))}
            </div>
          </div>
          <p className="text-slate-600">{result.recommendation}</p>

          {result.status === 'NO_DEAL' && (
            <p className="mt-2 text-sm text-slate-500">
              Every merchant's lowest price was above your budget, or no merchant responded.
              Use the suggestions below to adjust quantity or raise your budget.
            </p>
          )}

          {result.all_offers?.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.ERROR
            return (
              <div key={o.merchant_id} className={`mt-3 border-2 ${meta.border} rounded-lg p-4`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{o.merchant_id}</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-1 ${meta.chip}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${o.status === 'REJECT' ? 'text-red-700' : o.status === 'COUNTER' ? 'text-amber-700' : 'text-slate-500'}`}>
                  {o.reasoning}
                </p>

                {o.pricing && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span>Subtotal: Rs. {o.pricing.subtotal_paise / 100}</span>
                    {o.pricing.discounts.map((d) => (
                      <span key={d.rule} className="text-green-600">− Rs. {d.amount_paise / 100} ({d.rule})</span>
                    ))}
                    <span className="font-bold">Total: Rs. {o.pricing.total_paise / 100}</span>
                  </div>
                )}

                {o.status === 'REJECT' && o.suggested_alternatives?.length ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Merchant suggests</div>
                    {o.suggested_alternatives.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs px-3 py-1 mr-2">
                        {a.quantity} × {a.item_id} — {a.reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                {o.status === 'COUNTER' && o.next_action && (
                  <p className="mt-2 text-xs text-slate-500">next: {o.next_action}</p>
                )}

                {o.offer_id && o.status === 'OFFER' && (
                  <button onClick={() => buy(o.offer_id!)} className="mt-3 bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700">
                    Buy
                  </button>
                )}
              </div>
            )
          })}

          {payLink && (
            <div className="mt-4 p-4 rounded-lg bg-green-100 text-green-800 font-medium">
              {payLink === 'CAPTURED' ? 'Payment captured. Deal closed ✓' : `Complete payment: ${payLink}`}
            </div>
          )}

          {result.status === 'SUCCESS' && (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={verifyAudit} className="border border-indigo-500 text-indigo-600 rounded-lg px-4 py-2 hover:bg-indigo-50">
                Verify Audit Chain
              </button>
              {auditMsg && <span className="text-sm text-slate-600">{auditMsg}</span>}
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