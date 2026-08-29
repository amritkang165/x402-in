import { useEffect, useState } from 'react'
import axios from 'axios'

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

export default function TheatrePage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [sel, setSel] = useState('')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [auditResult, setAuditResult] = useState('')

  function refreshSessions() {
    axios.get('/sessions').then(({ data }) => setSessions(data))
  }

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 3000)
    return () => clearInterval(interval)
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Negotiation Theatre</h1>
      <div className="flex gap-6">
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
                  <div key={e.id} className={`p-2 rounded border ${ACTOR_COLORS[e.actor] || ACTOR_COLORS.system}`}>
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

function hash(h: string) {
  return h ? `# ${h.slice(0, 14)}…` : ''
}
