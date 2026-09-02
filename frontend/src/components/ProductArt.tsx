import type { ArtKind } from '../lib/shop'

const PALETTES: Record<ArtKind, { grad: [string, string]; stroke: string; fill: string; accent: string }> = {
  mug:    { grad: ['#fbbf24', '#f59e0b'], stroke: '#d97706', fill: '#fde68a', accent: '#f59e0b' },
  bowl:   { grad: ['#22d3ee', '#0ea5e9'], stroke: '#0284c7', fill: '#bae6fd', accent: '#0ea5e9' },
  plate:  { grad: ['#34d399', '#10b981'], stroke: '#059669', fill: '#d1fae5', accent: '#10b981' },
  candle: { grad: ['#a78bfa', '#8b5cf6'], stroke: '#7c3aed', fill: '#ede9fe', accent: '#8b5cf6' },
}

export default function ProductArt({ kind, size = 120, className = '' }: { kind: ArtKind; size?: number; className?: string }) {
  const p = PALETTES[kind]
  const id = `art-${kind}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`rounded-2xl bg-gradient-to-br from-ink-800 to-ink-900 ${className}`}
      role="img"
      aria-label={`${kind} illustration`}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.grad[0]} />
          <stop offset="100%" stopColor={p.grad[1]} />
        </linearGradient>
      </defs>

      {kind === 'mug' && <Mug p={p} id={id} />}
      {kind === 'bowl' && <Bowl p={p} id={id} />}
      {kind === 'plate' && <Plate p={p} id={id} />}
      {kind === 'candle' && <Candle p={p} id={id} />}
    </svg>
  )
}

type P = { stroke: string; fill: string; accent: string }

function Mug({ p, id }: { p: P; id: string }) {
  return (
    <g>
      {/* body */}
      <rect x="38" y="38" width="38" height="42" rx="5" fill={`url(#${id}-g)`} stroke={p.stroke} strokeWidth="2" />
      {/* inner */}
      <ellipse cx="57" cy="42" rx="16" ry="5" fill="#0f1220" opacity="0.45" />
      {/* handle */}
      <path d="M76 50 C88 50, 90 68, 76 68" fill="none" stroke={p.stroke} strokeWidth="3" strokeLinecap="round" />
      {/* glaze band */}
      <rect x="38" y="58" width="38" height="8" rx="1" fill={p.fill} opacity="0.35" />
      {/* steam */}
      <path d="M50 32 C50 26, 54 24, 54 18" fill="none" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M60 30 C60 22, 64 20, 64 14" fill="none" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </g>
  )
}

function Bowl({ p, id }: { p: P; id: string }) {
  return (
    <g>
      {/* bowl body */}
      <path d="M30 62 C30 84, 84 84, 84 62 Z" fill={`url(#${id}-g)`} stroke={p.stroke} strokeWidth="2" />
      {/* rim ellipse */}
      <ellipse cx="57" cy="62" rx="27" ry="7" fill={p.fill} opacity="0.35" stroke={p.stroke} strokeWidth="1.5" />
      {/* shadow */}
      <ellipse cx="57" cy="86" rx="22" ry="4" fill="#06070c" opacity="0.3" />
      {/* highlight */}
      <path d="M42 70 C46 76, 52 78, 56 76" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </g>
  )
}

function Plate({ p, id }: { p: P; id: string }) {
  return (
    <g>
      <ellipse cx="57" cy="60" rx="36" ry="18" fill={`url(#${id}-g)`} stroke={p.stroke} strokeWidth="2" />
      <ellipse cx="57" cy="60" rx="24" ry="11" fill="#0f1220" opacity="0.35" stroke={p.stroke} strokeWidth="1" />
      <ellipse cx="57" cy="80" rx="30" ry="5" fill="#06070c" opacity="0.25" />
      <path d="M46 55 Q52 50 58 52" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
    </g>
  )
}

function Candle({ p, id }: { p: P; id: string }) {
  return (
    <g>
      {/* jar */}
      <rect x="40" y="42" width="34" height="44" rx="6" fill={`url(#${id}-g)`} stroke={p.stroke} strokeWidth="2" />
      {/* wax */}
      <ellipse cx="57" cy="48" rx="15" ry="5" fill={p.fill} opacity="0.5" />
      {/* wick */}
      <line x1="57" y1="43" x2="57" y2="35" stroke={p.stroke} strokeWidth="1.5" strokeLinecap="round" />
      {/* flame */}
      <ellipse cx="57" cy="30" rx="5" ry="7" fill="#fbbf24" />
      <ellipse cx="57" cy="29" rx="2.5" ry="4" fill="#fef3c7" />
      {/* label band */}
      <rect x="40" y="62" width="34" height="10" rx="1" fill="#0f1220" opacity="0.3" />
      {/* glow */}
      <circle cx="57" cy="28" r="12" fill="#fbbf24" opacity="0.08" />
    </g>
  )
}