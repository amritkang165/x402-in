import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { openLiveFeed } from '../lib/live'
import type { LiveEvent } from '../types/live'

interface AuditEntry {
  id: number
  timestamp: string
  session_id: string
  action_type: string
  actor: string
  details: string
  previous_hash: string
  current_hash: string
}

type Filter = 'ALL' | 'ACTIVE' | 'PAID' | 'CLOSED'

const FILTER_KEYS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PAID', label: 'Paid' },
  { key: 'CLOSED', label: 'Closed' },
]

function bucket(status: string): Filter {
  if (status === 'PAID') return 'PAID'
  if (status === 'ACTIVE') return 'ACTIVE'
  return 'CLOSED'
}

const STATUS_STYLE: Record<string, { badge: string; dot: string; text: string; border: string }> = {
  OFFER: { badge: 'bg-green-50 text-green-700', dot: 'bg-green-600', text: 'text-green-700', border: 'border-green-300' },
  ACCEPT: { badge: 'bg-green-50 text-green-700', dot: 'bg-green-600', text: 'text-green-700', border: 'border-green-300' },
  COUNTER: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300' },
  REJECT: { badge: 'bg-red-50 text-red-700', dot: 'bg-red-600', text: 'text-red-700', border: 'border-red-300' },
  NEGOTIATING: { badge: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500', text: 'text-brand-700', border: 'border-brand-300' },
  PENDING: { badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', text: 'text-gray-500', border: 'border-gray-200' },
  TIMEOUT: { badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', text: 'text-gray-500', border: 'border-gray-200' },
  ERROR: { badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', text: 'text-gray-500', border: 'border-gray-200' },
}

const ACTOR_BORDER: Record<string, string> = {
  buyer_agent: 'border-brand-300',
  merchant_agent: 'border-green-300',
  system: 'border-gray-300',
  razorpay: 'border-violet-300',
}

function st(key: string): { badge: string; dot: string; text: string; border: string } {
  return STATUS_STYLE[key] ?? STATUS_STYLE.PENDING
}

function fmtRs(paise: number | null | undefined): string {
  if (paise == null) return '—'
  return 'Rs ' + (paise / 100).toLocaleString('en-IN')
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: string): string {
  const first = status.charAt(0) + status.slice(1).toLowerCase()
  return first
}

export default function TheatrePage() {
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState<any[]>([])
  const [sel, setSel] = useState(searchParams.get('session') ?? '')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [feed, setFeed] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [auditResult, setAuditResult] = useState('')
  const [verifyCount, setVerifyCount] = useState(0)

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const cleanup = openLiveFeed(
      '*',
      (ev) => setFeed((prev) => (prev.some((p) => p.id === ev.id) ? prev : [ev, ...prev].slice(0, 400))),
      setConnected,
    )
    return cleanup
  }, [])

  function refreshSessions() {
    axios.get('/sessions').then(({ data }) => setSessions(data)).catch(() => {})
  }

  const filteredSessions = useMemo(
    () => (filter === 'ALL' ? sessions : sessions.filter((s) => bucket(s.status) === filter)),
    [sessions, filter],
  )

  const visibleFeed = useMemo(() => (sel ? feed.filter((e) => e.session_id === sel) : feed), [feed, sel])

  const stats = useMemo(() => {
    const total = sessions.length
    const active = sessions.filter((s) => s.status === 'ACTIVE').length
    const paid = sessions.filter((s) => s.status === 'PAID').length
    return { total, active, paid }
  }, [sessions])

  const statCards = [
    { label: 'Sessions', value: stats.total },
    { label: 'Active', value: stats.active },
    { label: 'Paid', value: stats.paid },
    { label: 'Audit checks', value: verifyCount },
  ]

  function open(sid: string) {
    setSel(sid)
    axios.get(`/buyer/session/${sid}/audit`).then(({ data }) => setEntries(data)).catch(() => setEntries([]))
  }

  async function verify() {
    if (!sel) return
    const { data } = await axios.get(`/buyer/session/${sel}/audit/verify`)
    setAuditResult(`${data.verified ? '✓ ' : '✗ '}${data.message}`)
    setVerifyCount((c) => c + 1)
  }

  function color(e: LiveEvent) {
    if (e.action_type === 'NEGOTIATION') {
      return `border-2 ${st(e.details?.status).border}`
    }
    return `border ${ACTOR_BORDER[e.actor] ?? 'border-gray-300'}`
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Negotiation audit</h1>
        <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {connected ? 'Live' : 'Reconnecting'}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="eyebrow mb-1">{s.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="eyebrow">Live events</h2>
            <div className="flex items-center gap-2 text-xs">
              {sel ? (
                <>
                  <span className="tag bg-brand-50 text-brand-700">#{sel.slice(0, 8)}</span>
                  <button onClick={() => setSel('')} className="text-gray-400 hover:text-gray-600">
                    all sessions
                  </button>
                </>
              ) : (
                <span className="text-gray-400">all sessions</span>
              )}
            </div>
          </div>
          <div className="card max-h-[600px] space-y-3 overflow-y-auto p-4">
            {visibleFeed.length === 0 && (
              <p className="text-sm text-gray-400">No events yet. Run a search in the shop.</p>
            )}
            {visibleFeed.map((e) => (
              <div key={e.id} className={`rounded-lg border bg-white p-3 ${color(e)}`}>
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {e.actor} · <span className="text-brand-700">{e.action_type}</span>
                    <span className="ml-2 font-mono text-gray-400">#{e.session_id.slice(0, 8)}</span>
                  </span>
                  <span className="font-mono">{fmtTime(e.timestamp)}</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">{formatDetails(e)}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-80">
          <div className="mb-3 flex flex-wrap gap-2">
            {FILTER_KEYS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === f.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <h2 className="eyebrow mb-2">Sessions</h2>
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{filteredSessions.length} sessions</span>
              <button onClick={verify} disabled={!sel} className="btn-ghost text-xs">
                Verify chain
              </button>
            </div>
            {auditResult && (
              <div
                className={`mb-2 rounded-lg p-2 text-xs ${
                  auditResult.startsWith('✓')
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {auditResult}
              </div>
            )}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filteredSessions.map((s) => {
                const b = bucket(s.status)
                const dot = b === 'PAID' ? 'bg-green-600' : b === 'ACTIVE' ? 'bg-brand-500 animate-pulse' : 'bg-gray-400'
                return (
                  <button
                    key={s.id}
                    onClick={() => open(s.id)}
                    className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                      sel === s.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono font-medium text-gray-700">
                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                        {s.id.slice(0, 12)}…
                      </span>
                      <span className="font-mono text-gray-400">{fmtTime(s.created_at)}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className={s.status === 'PAID' ? 'text-green-700' : s.status === 'ACTIVE' ? 'text-brand-700' : 'text-gray-500'}>
                        {s.status}
                      </span>
                      {s.final_amount_paise != null && (
                        <span className="font-semibold text-gray-700">{fmtRs(s.final_amount_paise)}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
              <div className="eyebrow mb-2">Audit chain</div>
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className={`rounded border bg-white p-2 ${colorAudit(e)}`}>
                    <div className="text-xs font-medium text-gray-700">{e.action_type}</div>
                    <div className="break-all font-mono text-[10px] text-gray-400">{hash(e.current_hash)}</div>
                  </div>
                ))}
                {sel && entries.length === 0 && <div className="text-xs text-gray-400">No entries yet</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function colorAudit(e: AuditEntry) {
  if (e.action_type === 'NEGOTIATION_RESULT') {
    try {
      const status = JSON.parse(e.details)?.status
      return `border-2 ${st(status).border}`
    } catch {
      /* fall through */
    }
  }
  return `border ${ACTOR_BORDER[e.actor] ?? 'border-gray-300'}`
}

function formatDetails(e: LiveEvent) {
  const d = e.details || {}
  if (e.action_type === 'NEGOTIATION') {
    const price = d.total_paise != null ? fmtRs(d.total_paise) : '—'
    return `${d.merchant_id ?? ''}\n→ ${statusLabel(d.status ?? '')} · ${price}\n${d.reasoning ?? ''}`
  }
  if (e.action_type === 'DISCOVERY' && Array.isArray(d.merchants)) {
    return d.merchants.join(', ')
  }
  if (e.action_type === 'SESSION_STARTED') {
    return `buyer: ${d.buyer_id ?? ''}\nintent: ${JSON.stringify(d.intent)}`
  }
  return JSON.stringify(d, null, 2)
}

function hash(h: string) {
  return h ? `# ${h.slice(0, 14)}…` : ''
}
