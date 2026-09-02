import type { ArtKind } from '../lib/shop'

const SRC: Record<ArtKind, string> = {
  mug: '/images/mug.jpg',
  bowl: '/images/bowl.jpg',
  plate: '/images/plate.jpg',
  candle: '/images/candle.jpg',
}

export default function ProductArt({ kind, size = 120, className = '' }: { kind: ArtKind; size?: number; className?: string }) {
  const fixed = size > 0
  return (
    <img
      src={SRC[kind]}
      alt={kind}
      loading="lazy"
      className={`rounded-xl object-cover ${className}`}
      style={fixed ? { width: size, height: size } : undefined}
    />
  )
}
