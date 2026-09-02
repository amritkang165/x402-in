import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function SuccessPage() {
  const { state } = useLocation() as { state?: { session_id?: string; offer?: any } }
  const [auditMsg, setAuditMsg] = useState('')

  useEffect(() => {
    if (!state?.session_id) return
    let cancelled = false
    axios.get(`/buyer/session/${state.session_id}/audit/verify`)
      .then(({ data }) => { if (!cancelled) setAuditMsg(data.message) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [state?.session_id])

  const offer = state?.offer
  const merchant = offer?.merchant_id ?? '—'
  const amount = offer?.pricing?.total_paise != null ? (offer.pricing.total_paise / 100).toFixed(2) : '—'

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-xl shadow p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-green-600 mb-2">Payment successful</h1>
        <p className="text-slate-600 mb-6">
          Your deal with <strong>{merchant}</strong> is confirmed. The session is marked
          <strong className="text-green-600"> PAID</strong>.
        </p>

        <div className="grid grid-cols-2 gap-4 my-6 text-left">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Amount paid</div>
            <div className="text-2xl font-bold">Rs. {amount}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Audit chain</div>
            <div className="text-sm text-slate-700">{auditMsg || 'Verifying…'}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link
            to="/theatre"
            className="border border-indigo-500 text-indigo-600 rounded-lg px-4 py-2 hover:bg-indigo-50"
          >
            View Negotiation Theatre
          </Link>
          <Link
            to="/"
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700"
          >
            New purchase
          </Link>
        </div>
      </div>
    </div>
  )
}