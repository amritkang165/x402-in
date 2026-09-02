import { Routes, Route, Link, useLocation } from 'react-router-dom'
import BuyerPage from './pages/BuyerPage'
import TheatrePage from './pages/TheatrePage'
import SuccessPage from './pages/SuccessPage'

export default function App() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: 'Shop' },
    { to: '/success', label: 'Orders', hidden: true },
    { to: '/theatre', label: 'Protocol' },
  ]

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 22V12m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-base font-semibold text-gray-900">Parley</span>
            <span className="text-xs text-gray-400">homeware</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {links
              .filter((l) => !l.hidden)
              .map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    pathname === l.to ? 'text-brand-700' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Routes>
          <Route path="/" element={<BuyerPage />} />
          <Route path="/theatre" element={<TheatrePage />} />
          <Route path="/success" element={<SuccessPage />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <p className="text-xs text-gray-400">
            Your AI buyer negotiates and settles via the x402-IN protocol · Powered by Razorpay
          </p>
        </div>
      </footer>
    </div>
  )
}
