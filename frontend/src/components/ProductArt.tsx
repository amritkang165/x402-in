import type { ArtKind } from '../lib/shop'

const STROKE: Record<ArtKind, string> = {
  mug: '#b45309',
  bowl: '#155e75',
  plate: '#15803d',
  candle: '#6d28d9',
}

const TINT: Record<ArtKind, string> = {
  mug: '#fff7ed',
  bowl: '#ecfeff',
  plate: '#f0fdf4',
  candle: '#f5f3ff',
}

export default function ProductArt({ kind, size = 120, className = '' }: { kind: ArtKind; size?: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, background: TINT[kind] }}
    >
      <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 64 64" fill="none">
        {kind === 'mug' && <Mug stroke={STROKE.mug} />}
        {kind === 'bowl' && <Bowl stroke={STROKE.bowl} />}
        {kind === 'plate' && <Plate stroke={STROKE.plate} />}
        {kind === 'candle' && <Candle stroke={STROKE.candle} />}
      </svg>
    </div>
  )
}

function Mug({ stroke }: { stroke: string }) {
  return (
    <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 24 h20 a3 3 0 0 1 3 3 v14 a12 12 0 0 1 -12 12 h-1 a12 12 0 0 1 -12 -12 v-14 a3 3 0 0 1 3 -3 z" />
      <path d="M42 28 h3 a6 6 0 0 1 0 12 h-3" />
      <path d="M31 20 v-4" opacity="0.5" />
    </g>
  )
}

function Bowl({ stroke }: { stroke: string }) {
  return (
    <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 38 a20 20 0 0 0 40 0 z" />
      <path d="M18 28 h28 a14 14 0 0 1 -28 0 z" opacity="0.55" />
    </g>
  )
}

function Plate({ stroke }: { stroke: string }) {
  return (
    <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round">
      <ellipse cx="32" cy="32" rx="24" ry="12" />
      <ellipse cx="32" cy="32" rx="16" ry="8" opacity="0.55" />
    </g>
  )
}

function Candle({ stroke }: { stroke: string }) {
  return (
    <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M26 22 h12 a2 2 0 0 1 2 2 v18 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 v-18 a2 2 0 0 1 2 -2 z" />
      <path d="M32 20 v-5" />
      <path d="M32 13 l2 4 h-4 z" />
      <path d="M26 34 h12" opacity="0.5" />
    </g>
  )
}
