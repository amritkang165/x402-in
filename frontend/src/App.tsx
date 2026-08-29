import { Routes, Route, Link } from 'react-router-dom'
import BuyerPage from './pages/BuyerPage'
import TheatrePage from './pages/TheatrePage'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-indigo-700 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">x402-IN</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/" className="hover:underline">Buy</Link>
            <Link to="/theatre" className="hover:underline">Negotiation Theatre</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<BuyerPage />} />
          <Route path="/theatre" element={<TheatrePage />} />
        </Routes>
      </main>
    </div>
  )
}
