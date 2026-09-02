import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

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
  const merchant = offer?.merchant_id ?? '—'
  const amount = offer?.pricing?.total_paise != null ? (offer.pricing.total_paise / 100).toFixed(2) : '—'

  return (
    <div className="mx-auto max-w-xl">
      <div className="panel p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-mint/40 bg-mint/10 text-3xl shadow-glow-mint">
          ✓
        </div>
        <h1 className="font-mono text-2xl font-bold tracking-tight text-mint">Payment successful</h1>
        <p className="mt-2 text-slate-300">
          Your deal with <strong className="text-white">{merchant}</strong> is confirmed. The session
          is marked <strong className="text-mint">PAID</strong>.
        </p>

        <div className="my-6 grid grid-cols-2 gap-4 text-left">
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <div className="card-title mb-1">Amount paid</div>
            <div className="font-mono text-2xl font-bold text-white">Rs. {amount}</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <div className="card-title mb-1">Audit chain</div>
            <div className="flex items-center gap-1 text-sm text-slate-300">
              <span className="text-mint">✓</span>
              {auditMsg || 'Verifying…'}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/theatre" className="btn-ghost">
            View Negotiation Theatre
          </Link>
          <Link to="/" className="btn-primary">
            New purchase
          </Link>
        </div>
      </div>
    </div>
  )
}