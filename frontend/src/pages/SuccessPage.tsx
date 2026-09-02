import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { merchantName, itemName } from '../lib/shop'
import ProductArt from '../components/ProductArt'

export default function SuccessPage() {
  const { state } = useLocation() as { state?: { session_id?: string; offer?: any } }
  const [auditMsg, setAuditMsg] = useState('')

  useEffect(() => {
    if (!state?.session_id) return
    let cancelled = false
    axios
      .get(`/buyer/session/${state.session_id}/audit/verify`)
      .then(({ data }) => { if (!cancelled) setAuditMsg(data.message) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [state?.session_id])

  const offer = state?.offer
  const sessionId = state?.session_id ?? ''
  const shortId = sessionId.slice(0, 10)
  const merchant = offer?.merchant_id ? merchantName(offer.merchant_id) : '—'
  const total = offer?.pricing?.total_paise ?? 0
  const items = (offer?.items ?? []) as { item_id: string; quantity: number }[]
  const discounts = (offer?.pricing?.discounts ?? []) as { rule: string; amount_paise: number }[]

  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4 4L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">Order placed</h1>
        <p className="mt-1 text-sm text-gray-500">
          Thanks — your order from <span className="font-medium text-gray-800">{merchant}</span> is confirmed.
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 p-4 text-left">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Order number</div>
              <div className="font-mono text-sm text-gray-800">#{shortId}</div>
            </div>
            <span className="tag bg-green-50 text-green-700">Paid</span>
          </div>

          <div className="flex gap-3">
            <ProductArt kind={artKind(items)} size={64} className="shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{merchant}</div>
              <div className="text-xs text-gray-500">
                {items.length > 0 ? items.map((i) => `${i.quantity} × ${itemName(i.item_id)}`).join(', ') : 'Your items'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">Rs {(total / 100).toFixed(0)}</div>
              {discounts.length > 0 && (
                <div className="text-xs text-green-700">
                  − Rs {discounts.reduce((s, d) => s + d.amount_paise, 0) / 100} saved
                </div>
              )}
            </div>
          </div>
        </div>

        {auditMsg && <p className="mt-3 text-xs text-gray-400">Verified on-chain: {auditMsg}</p>}

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary">
            Back to shop
          </Link>
          {sessionId && (
            <Link to={`/theatre?session=${sessionId}`} className="btn-ghost">
              View audit trail
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function artKind(items: { item_id: string }[]): 'mug' | 'bowl' | 'plate' | 'candle' {
  const id = items[0]?.item_id ?? ''
  if (id.includes('candle')) return 'candle'
  if (id.includes('bowl')) return 'bowl'
  if (id.includes('plate')) return 'plate'
  return 'mug'
}
