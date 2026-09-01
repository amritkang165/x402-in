import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

interface LiveEvent {
  id: string
  timestamp: string
  session_id: string
  actor: string
  action_type: string
  details: Record<string, any>
  sequence?: number
}

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

const ACTOR_COLORS: Record<string, string> = {
  buyer_agent: 'bg-blue-100 border-blue-300',
  merchant_agent: 'bg-green-100 border-green-300',
  system: 'bg-slate-100 border-slate-300',
  razorpay: 'bg-purple-100 border-purple-300',
}

const STATUS_COLORS: Record<string, string> = {
  OFFER: 'bg-green-100 border-green-300',
  COUNTER: 'bg-amber-100 border-amber-300',
  REJECT: 'bg-red-100 border-red-300',
  TIMEOUT: 'bg-slate-100 border-slate-300 border-dashed',
  ERROR: 'bg-slate-100 border-slate-300',
}

export default function TheatrePage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [sel, setSel] = useState('')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [live, setLive] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [auditResult, setAuditResult] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  function refreshSessions() {
    axios.get('/sessions').then(({ data }) => setSessions(data))
  }

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 3000)
    return () => clearInterval(interval)
  }, [])

  // Live WebSocket feed — subscribe to the global room for real-time events.
  useEffect(() => {
    let ws: WebSocket | null = null
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws/theatre/*`)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 2000)
      }
      ws.onmessage = (ev) => {
        const event: LiveEvent = JSON.parse(ev.data)
        setLive((prev) =>
          prev.some((p) => p.id === event.id)
            ? prev
            : [...prev, event].slice(-200),
        )
      }
    }
    connect()
    wsRef.current = ws
    return () => ws?.close()
  }, [])

  function open(sid: string) {
    setSel(sid)
    axios.get(`/buyer/session/${sid}/audit`).then(({ data }) => setEntries(data))
  }

  async function verify() {
    if (!sel) return
    const { data } = await axios.get(`/buyer/session/${sel}/audit/verify`)
    setAuditResult(`${data.verified ? '✓ ' : '✗ '}${data.message}`)
  }

  function color(e: LiveEvent) {
    if (e.action_type === 'NEGOTIATION') {
      return STATUS_COLORS[e.details?.status] || STATUS_COLORS.ERROR
    }
    return ACTOR_COLORS[e.actor] || ACTOR_COLORS.system
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Negotiation Theatre</h1>
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {connected ? 'LIVE' : 'RECONNECTING'}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Live feed */}
        <div className="flex-1">
          <h2 className="font-semibold text-slate-600 mb-2">Live Negotiation Feed</h2>
          <div className="bg-white rounded-xl shadow p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {live.length === 0 && <p className="text-slate-400 text-sm">Waiting for events… start a search in the Buyer page.</p>}
            {live.map((e) => (
              <div key={e.id} className={`p-3 rounded-lg border ${color(e)}`}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-semibold">{e.actor}</span>
                  <span>{e.action_type} · {new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
                <pre className="text-xs whitespace-pre-wrap">
                  {formatDetails(e)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions + audit */}
        <div className="w-80">
          <h2 className="font-semibold text-slate-600 mb-2">Audit Trails</h2>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Sessions</span>
              <button onClick={verify} disabled={!sel} className="border border-indigo-500 text-indigo-600 rounded-lg px-3 py-1 text-sm hover:bg-indigo-50 disabled:opacity-40">
                Verify
              </button>
            </div>
            {auditResult && (
              <div className={`mb-2 p-2 rounded-lg text-xs ${auditResult.startsWith('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {auditResult}
              </div>
            )}
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => open(s.id)}
                  className={`w-full text-left border rounded-lg p-2 text-xs ${sel === s.id ? 'border-indigo-500 bg-indigo-50' : ''}`}
                >
                  <div className="font-medium">{s.id.slice(0, 10)}…</div>
                  <div className="text-slate-500">{s.status}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t pt-3">
              <div className="text-xs text-slate-500 mb-2">Selected audit chain</div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className={`p-2 rounded border ${colorAudit(e)}`}>
                    <div className="text-xs font-semibold">{e.action_type}</div>
                    <div className="text-[10px] text-slate-500 break-all">{hash(e.current_hash)}</div>
                  </div>
                ))}
                {sel && entries.length === 0 && <div className="text-xs text-slate-400">No entries yet</div>}
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
      return STATUS_COLORS[status] || STATUS_COLORS.ERROR
    } catch {
      /* fall through */
    }
  }
  return ACTOR_COLORS[e.actor] || ACTOR_COLORS.system
}

function formatDetails(e: LiveEvent) {
  const d = e.details || {}
  if (e.action_type === 'NEGOTIATION') {
    const price = d.total_paise != null ? `Rs. ${d.total_paise / 100}` : '—'
    return `${d.merchant_id ?? ''} → ${d.status ?? ''}  ·  ${price}\n${d.reasoning ?? ''}`
  }
  return JSON.stringify(d, null, 2)
}

function hash(h: string) {
  return h ? `# ${h.slice(0, 14)}…` : ''
}
