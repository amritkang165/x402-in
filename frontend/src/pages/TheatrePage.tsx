import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { openLiveFeed } from '../lib/live'
import type { LiveEvent } from '../types/live'
import { ACTOR_COLORS, fmtRs, fmtTime, STATUS_META } from '../lib/meta'

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
    return { total, active, paid, closed: total - active - paid }
  }, [sessions])

  const statCards = [
    { label: 'Sessions', value: stats.total, accent: 'text-accent' },
    { label: 'Active', value: stats.active, accent: 'text-accent' },
    { label: 'Paid', value: stats.paid, accent: 'text-mint' },
    { label: 'Audit checks', value: verifyCount, accent: 'text-violet' },
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
      const meta = STATUS_META[e.details?.status]
      return `border-2 ${meta?.border ?? 'border-ink-600'}`
    }
    return `border ${ACTOR_COLORS[e.actor] ?? 'border-ink-600'}`
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-white">
          Negotiation <span className="text-accent">Theatre</span>
        </h1>
        <span className="flex items-center gap-2 font-mono text-xs font-medium">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connected ? 'bg-mint shadow-glow-mint animate-pulse' : 'bg-rose'
            }`}
          />
          {connected ? 'LIVE' : 'RECONNECTING'}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="panel p-4">
            <div className="card-title mb-1">{s.label}</div>
            <div className={`font-mono text-2xl font-bold ${s.accent}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="card-title">Live Negotiation Feed</h2>
            <div className="flex items-center gap-2 font-mono text-xs">
              {sel ? (
                <>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
                    #{sel.slice(0, 8)}
                  </span>
                  <button onClick={() => setSel('')} className="text-slate-400 hover:text-accent">
                    all sessions
                  </button>
                </>
              ) : (
                <span className="text-slate-500">all sessions</span>
              )}
            </div>
          </div>
          <div className="panel max-h-[600px] space-y-3 overflow-y-auto p-4">
            {visibleFeed.length === 0 && (
              <p className="text-sm text-slate-500">Waiting for events… start a search in the Buyer page.</p>
            )}
            {visibleFeed.map((e) => (
              <div key={e.id} className={`rounded-lg border bg-ink-850 p-3 ${color(e)}`}>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {e.actor} · <span className="text-accent">{e.action_type}</span>
                    <span className="ml-2 font-mono text-slate-500">#{e.session_id.slice(0, 8)}</span>
                  </span>
                  <span className="font-mono">{fmtTime(e.timestamp)}</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{formatDetails(e)}</pre>
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
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink-600 text-slate-400 hover:border-accent/50 hover:text-accent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <h2 className="card-title mb-2">Audit Trails</h2>
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-slate-400">
                Sessions ({filteredSessions.length})
              </span>
              <button onClick={verify} disabled={!sel} className="btn-ghost text-xs">
                Verify
              </button>
            </div>
            {auditResult && (
              <div
                className={`mb-2 rounded-lg p-2 font-mono text-xs ${
                  auditResult.startsWith('✓')
                    ? 'border border-mint/40 bg-mint/10 text-mint'
                    : 'border border-rose/40 bg-rose/10 text-rose'
                }`}
              >
                {auditResult}
              </div>
            )}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filteredSessions.map((s) => {
                const b = bucket(s.status)
                const dot =
                  b === 'PAID' ? 'bg-mint' : b === 'ACTIVE' ? 'bg-accent animate-pulse' : 'bg-slate-500'
                return (
                  <button
                    key={s.id}
                    onClick={() => open(s.id)}
                    className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                      sel === s.id
                        ? 'border-accent/60 bg-accent/5'
                        : 'border-ink-600 hover:border-ink-500 hover:bg-ink-850'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono font-medium text-slate-200">
                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                        {s.id.slice(0, 12)}…
                      </span>
                      <span className="font-mono text-slate-500">{fmtTime(s.created_at)}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span
                        className={
                          s.status === 'PAID' ? 'text-mint' : s.status === 'ACTIVE' ? 'text-accent' : 'text-slate-400'
                        }
                      >
                        {s.status}
                      </span>
                      {s.final_amount_paise != null && (
                        <span className="font-semibold text-slate-200">{fmtRs(s.final_amount_paise)}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 border-t border-ink-700 pt-3">
              <div className="card-title mb-2">Selected audit chain</div>
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className={`rounded border bg-ink-850 p-2 ${colorAudit(e)}`}>
                    <div className="text-xs font-semibold text-slate-200">{e.action_type}</div>
                    <div className="break-all font-mono text-[10px] text-slate-500">{hash(e.current_hash)}</div>
                  </div>
                ))}
                {sel && entries.length === 0 && <div className="text-xs text-slate-500">No entries yet</div>}
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
      const meta = STATUS_META[status]
      return meta ? `border-2 ${meta.border}` : ACTOR_COLORS[e.actor] ?? 'border-ink-600'
    } catch {
      /* fall through */
    }
  }
  return ACTOR_COLORS[e.actor] ?? 'border-ink-600'
}

function formatDetails(e: LiveEvent) {
  const d = e.details || {}
  if (e.action_type === 'NEGOTIATION') {
    const status = d.status ? (STATUS_META[d.status]?.label ?? d.status) : ''
    const price = d.total_paise != null ? fmtRs(d.total_paise) : '—'
    return `${d.merchant_id ?? ''}\n→ ${status} · ${price}\n${d.reasoning ?? ''}`
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