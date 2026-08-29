import { useState } from 'react'
import axios from 'axios'

interface Offer {
  id: string
  merchant_id: string
  status: string
  reasoning: string
  pricing?: { total_paise: number; subtotal_paise: number; discounts: { rule: string; amount_paise: number }[] }
  offer_id?: string
}

interface Result {
  status: string
  session_id?: string
  recommendation?: string
  best_offer?: Offer & { offer_id: string }
  all_offers?: Offer[]
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
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const { data } = await axios.get(`/buyer/session/${sid}`)
      if (data.search_status === 'DONE') {
        setResult(data.result)
        setLoading(false)
        return
      }
    }
    setLoading(false)
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
    }
  }

  async function verifyAudit() {
    const { data } = await axios.get(`/buyer/session/${sessionId}/audit/verify`)
    setAuditMsg(data.message)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Buyer Agent</h1>
      <p className="text-slate-600 mb-6">State a need; the buyer agent negotiates with every merchant in parallel.</p>

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
            <input className="border rounded-lg p-2 w-32" value={budget} onChange={(e) => setBudget(e.target.value)} />
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
          <div className={`text-lg font-semibold mb-2 ${result.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
            {result.status === 'SUCCESS' ? 'Deal found' : 'No deal'}
          </div>
          <p>{result.recommendation}</p>

          {result.all_offers?.map((o) => (
            <div key={o.merchant_id} className="mt-3 border rounded-lg p-4">
              <div className="flex justify-between">
                <span className="font-medium">{o.merchant_id}</span>
                <span className={`text-sm font-semibold ${o.status === 'OFFER' ? 'text-green-600' : 'text-red-600'}`}>{o.status}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{o.reasoning}</p>
              {o.pricing && (
                <div className="mt-2 flex gap-5 text-sm">
                  <span>Subtotal: Rs. {o.pricing.subtotal_paise / 100}</span>
                  {o.pricing.discounts.map((d) => (
                    <span key={d.rule} className="text-green-600">− Rs. {d.amount_paise / 100} ({d.rule})</span>
                  ))}
                  <span className="font-bold">Total: Rs. {o.pricing.total_paise / 100}</span>
                </div>
              )}
              {o.offer_id && o.status === 'OFFER' && (
                <button onClick={() => buy(o.offer_id!)} className="mt-3 bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700">
                  Buy
                </button>
              )}
            </div>
          ))}

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
