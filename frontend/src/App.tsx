import { Routes, Route, Link, useLocation } from 'react-router-dom'
import BuyerPage from './pages/BuyerPage'
import TheatrePage from './pages/TheatrePage'
import SuccessPage from './pages/SuccessPage'

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="url(#g)" />
      <text x="16" y="22" fontSize="14" textAnchor="middle" fill="#06070c" fontFamily="sans-serif" fontWeight="800">x4</text>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: 'Buy' },
    { to: '/success', label: 'Success', hidden: true },
    { to: '/theatre', label: 'Theatre' },
  ]

  return (
    <div className="min-h-screen bg-grid bg-ink-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />

      <nav className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-mono text-lg font-bold tracking-tight text-white">
              x402<span className="text-accent">-IN</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            {links
              .filter((l) => !l.hidden)
              .map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    pathname === l.to
                      ? 'bg-accent/10 text-accent'
                      : 'text-slate-300 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8">
        <Routes>
          <Route path="/" element={<BuyerPage />} />
          <Route path="/theatre" element={<TheatrePage />} />
          <Route path="/success" element={<SuccessPage />} />
        </Routes>
      </main>

      <footer className="relative z-10 border-t border-ink-700 py-6 text-center">
        <p className="font-mono text-xs text-slate-500">
          ai proposes <span className="text-slate-600">·</span> rules decide{' '}
          <span className="text-slate-600">·</span> humans authorize money
        </p>
      </footer>
    </div>
  )
}