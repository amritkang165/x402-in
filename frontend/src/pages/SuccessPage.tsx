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
  const shortId = sessionId.slice(0, 12)
  const merchant = offer?.merchant_id ? merchantName(offer.merchant_id) : '—'
  const total = offer?.pricing?.total_paise ?? 0
  const items = (offer?.items ?? []) as { item_id: string; quantity: number }[]
  const discounts = (offer?.pricing?.discounts ?? []) as { rule: string; amount_paise: number }[]
  const subtotal = offer?.pricing?.subtotal_paise ?? 0

  const steps = [
    { label: 'Negotiated', done: true },
    { label: 'Approved', done: true },
    { label: 'Paid via Razorpay', done: true },
  ]

  return (
    <div className="mx-auto max-w-xl">
      <div className="panel p-8 text-center">
        {/* badge */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-mint/40 bg-mint/10 shadow-glow-mint">
          <span className="text-4xl text-mint">✓</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-white">Order confirmed</h1>
        <p className="mt-2 text-slate-400">
          Your purchase from <strong className="text-white">{merchant}</strong> has been negotiated, approved &amp; paid.
        </p>

        {/* order card */}
        <div className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-5 text-left">
          <div className="flex items-start justify-between mb-4">
            <div className="text-xs text-slate-500">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-0.5">Order</div>
              <span className="font-mono text-slate-300">#{shortId}</span>
            </div>
            <span className="chip bg-mint/10 text-mint">PAID</span>
          </div>

          <div className="flex gap-4 mb-4">
            <ProductArt kind={artKind(items)} size={80} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{merchant}</div>
              <div className="mt-1 text-sm text-slate-300">
                {items.length > 0
                  ? items.map((i) => `${i.quantity} × ${itemName(i.item_id)}`).join(', ')
                  : 'your items'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-white">Rs {(total / 100).toFixed(0)}</div>
              {discounts.length > 0 && (
                <div className="text-xs text-mint">
                  − Rs {discounts.reduce((s, d) => s + d.amount_paise, 0) / 100} saved
                </div>
              )}
            </div>
          </div>

          {/* line items */}
          {items.length > 1 && (
            <div className="border-t border-ink-700 pt-3 space-y-1 text-xs text-slate-400">
              {items.map((it) => (
                <div key={it.item_id} className="flex justify-between">
                  <span>{it.quantity} × {itemName(it.item_id)}</span>
                  <span>Rs {((subtotal / items.reduce((s, i) => s + i.quantity, 0)) * it.quantity / 100).toFixed(0)}</span>
                </div>
              ))}
              {discounts.map((d) => (
                <div key={d.rule} className="flex justify-between text-mint">
                  <span>{d.rule}</span>
                  <span>− Rs {(d.amount_paise / 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* steps */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-mint">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/10 text-[10px] text-mint">✓</span>
                {s.label}
              </span>
              {i < steps.length - 1 && <span className="text-ink-600">→</span>}
            </div>
          ))}
        </div>

        {auditMsg && (
          <p className="mt-3 text-xs text-slate-500">
            audit: <span className="text-slate-400">{auditMsg}</span>
          </p>
        )}

        {/* buttons */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-ghost">
            Back to shop
          </Link>
          {sessionId && (
            <Link to={`/theatre?session=${sessionId}`} className="btn-ghost text-xs">
              view negotiation in theatre
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function artKind(items: { item_id: string }[]): 'mug' | 'bowl' | 'plate' | 'candle' {
  const id = items[0]?.item_id ?? ''
  if (['mug', 'bowl', 'plate', 'candle'].includes(id.split('_')[0])) return id.split('_')[0] as any
  if (id.includes('candle')) return 'candle'
  if (id.includes('bowl')) return 'bowl'
  if (id.includes('plate')) return 'plate'
  return 'mug'
}