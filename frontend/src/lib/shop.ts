import type { LiveEvent } from '../types/live'

export type ArtKind = 'mug' | 'bowl' | 'plate' | 'candle'

export interface CatalogEntry {
  id: string
  name: string
  desc: string
  basePaise: number
  merchant: string
  art: ArtKind
  budgetPaise: number
  tag?: string
  mrpPaise: number
  sold: string
}

export const CATALOG: Record<string, CatalogEntry> = {
  mug_001: {
    id: 'mug_001',
    name: 'Ceramic mug, handmade',
    desc: 'Hand-thrown on the wheel, food-safe glaze. Around 350 ml.',
    basePaise: 30000,
    merchant: 'pottery_rahul_001',
    art: 'mug',
    budgetPaise: 40000,
    tag: 'Bestseller',
    mrpPaise: 39900,
    sold: '1.2k sold',
  },
  bowl_001: {
    id: 'bowl_001',
    name: 'Ceramic serving bowl',
    desc: 'Stoneware bowl for salads and soups. 8 inch diameter.',
    basePaise: 45000,
    merchant: 'pottery_rahul_001',
    art: 'bowl',
    budgetPaise: 70000,
    mrpPaise: 59900,
    sold: '430 sold',
  },
  plate_001: {
    id: 'plate_001',
    name: 'Ceramic dinner plate',
    desc: '10 inch plate, hand-finished rim. Dishwasher safe.',
    basePaise: 20000,
    merchant: 'pottery_rahul_001',
    art: 'plate',
    budgetPaise: 30000,
    mrpPaise: 29900,
    sold: '870 sold',
  },
  candle_001: {
    id: 'candle_001',
    name: 'Soy wax candle, vanilla',
    desc: 'Hand-poured soy wax, cotton wick. Burns about 45 hours.',
    basePaise: 25000,
    merchant: 'candles_sneha_002',
    art: 'candle',
    budgetPaise: 35000,
    sold: '2.3k sold',
    mrpPaise: 34900,
  },
}

export const FALLBACK_MERCHANTS: Record<string, string> = {
  pottery_rahul_001: "Rahul's Handmade Pottery",
  candles_sneha_002: "Sneha's Candle Studio",
}

export const MERCHANT_META: Record<string, { rating: number; reviews: string; city: string; blurb: string }> = {
  pottery_rahul_001: {
    rating: 4.6,
    reviews: '312 ratings',
    city: 'Jaipur',
    blurb: 'Small-batch pottery, made to order in Jaipur.',
  },
  candles_sneha_002: {
    rating: 4.8,
    reviews: '187 ratings',
    city: 'Pune',
    blurb: 'Natural soy candles, hand-poured in small batches.',
  },
}

export type Category = 'mugs' | 'tableware' | 'candles'

export interface Product {
  id: string
  itemId: string
  name: string
  desc: string
  pricePaise: number
  mrpPaise: number
  image: string
  category: Category
  merchant: string
  rating: number
  reviews: string
  sold: string
  tag?: string
  swatches?: string[]
}

const P = (id: string, itemId: string, name: string, desc: string, pricePaise: number, mrpPaise: number, image: string, category: Category, merchant: string, tag?: string, swatches?: string[], sold = '', rating = 4.5): Product => ({
  id,
  itemId,
  name,
  desc,
  pricePaise,
  mrpPaise,
  image,
  category,
  merchant,
  rating,
  reviews: rating >= 4.6 ? `${Math.round(rating * 80 + 60)} ratings` : `${Math.round(rating * 80 + 40)} ratings`,
  sold: sold || `${Math.round(rating * 400 + 180)} sold`,
  tag,
  swatches,
})

export const PRODUCTS: Product[] = [
  // Mugs
  P('mug_natural', 'mug_001', 'Stoneware mug, natural glaze', 'Hand-thrown, speckled finish. 350 ml.',
    30000, 39900, '/images/mug.jpg', 'mugs', 'pottery_rahul_001', 'Bestseller', ['#c8b89a', '#8a7a5a'], '1.8k sold', 4.7),
  P('mug_blue', 'mug_001', 'Ceramic mug, sea blue', 'Matte blue glaze, food-safe. 350 ml.',
    32000, 44900, '/images/mug2.jpg', 'mugs', 'pottery_rahul_001', undefined, ['#2b6cb0', '#63b3ed'], '940 sold', 4.5),
  P('mug_terra', 'mug_001', 'Terracotta mug, hand-painted', 'Ochre glazed mug with hand-painted rings. 300 ml.',
    34000, 47900, '/images/mug2.jpg', 'mugs', 'pottery_rahul_001', 'New', ['#c05b2e', '#e08b4a'], '310 sold', 4.4),
  // Tableware
  P('bowl_cream', 'bowl_001', 'Serving bowl, cream', 'Stoneware, 8 inch. For salads and soups.',
    45000, 59900, '/images/bowl.jpg', 'tableware', 'pottery_rahul_001', undefined, ['#efe6d8'], '430 sold', 4.6),
  P('bowl_green', 'bowl_001', 'Serving bowl, sage', 'Speckled matte glaze. 8 inch.',
    48000, 64900, '/images/bowl2.jpg', 'tableware', 'pottery_rahul_001', undefined, ['#8a9a5b'], '210 sold', 4.5),
  P('plate_dinner', 'plate_001', 'Dinner plate, 10 inch', 'Dishwasher safe, hand-finished rim.',
    20000, 29900, '/images/plate.jpg', 'tableware', 'pottery_rahul_001', 'Bestseller', ['#f5f3ef'], '870 sold', 4.6),
  // Candles
  P('candle_vanilla', 'candle_001', 'Soy candle, vanilla & cedar', 'Cotton wick, 45 hr burn.',
    25000, 34900, '/images/candle.jpg', 'candles', 'candles_sneha_002', 'Bestseller', [], '2.3k sold', 4.8),
  P('candle_mint', 'candle_001', 'Soy candle, sea salt & mint', 'Hand-poured, cool scent. 40 hr burn.',
    26000, 36900, '/images/candle2.jpg', 'candles', 'candles_sneha_002', undefined, [], '760 sold', 4.6),
  P('candle_amber', 'candle_001', 'Soy candle, amber & sandalwood', 'Warm evening scent. 45 hr burn.',
    28000, 39900, '/images/candle.jpg', 'candles', 'candles_sneha_002', 'New', [], '180 sold', 4.4),
]

export const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mugs', label: 'Mugs' },
  { id: 'tableware', label: 'Tableware' },
  { id: 'candles', label: 'Candles' },
]

export function merchantName(id: string): string {
  return FALLBACK_MERCHANTS[id] ?? id
}

export function itemName(id: string): string {
  return CATALOG[id]?.name ?? id.split('_')[0]
}

function itemShort(id: string): string {
  const e = CATALOG[id]
  if (!e) return id
  return e.name.replace('Ceramic ', '').replace(' hand', '').toLowerCase()
}

export function describeItems(items: { item_id: string; quantity: number }[] | undefined): string {
  if (!items || items.length === 0) return 'your request'
  return items.map((r) => `${r.quantity} ${itemShort(r.item_id)}${r.quantity > 1 ? 's' : ''}`).join(', ')
}

export interface ChatMessage {
  id: string
  side: 'buyer' | 'seller'
  name: string
  kind: string
  text: string
  price?: number
  time: string
}

export function humanizeEvent(ev: LiveEvent): ChatMessage | null {
  const ts = new Date(ev.timestamp)
  const time = Number.isNaN(ts.getTime())
    ? ''
    : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const intent: any = ev.details?.intent

  switch (ev.action_type) {
    case 'SESSION_STARTED':
      return {
        id: ev.id,
        side: 'buyer',
        name: 'Your buyer agent',
        kind: 'info',
        text: `Looking for ${describeItems(intent?.items_requested)} within Rs ${intent?.budget_paise != null ? (intent.budget_paise / 100).toFixed(0) : ''}. Contacting sellers now.`,
        time,
      }
    case 'DISCOVERY': {
      const n = Array.isArray(ev.details?.merchants) ? ev.details.merchants.length : 0
      return {
        id: ev.id,
        side: 'buyer',
        name: 'Your buyer agent',
        kind: 'info',
        text: `${n} seller${n === 1 ? '' : 's'} on the registry. Asking them all for a quote.`,
        time,
      }
    }
    case 'NEGOTIATION': {
      const d = ev.details ?? {}
      const price = d.total_paise != null ? d.total_paise : undefined
      return {
        id: ev.id,
        side: 'seller',
        name: merchantName(d.merchant_id as string),
        kind: (d.status as string) ?? '',
        text: (d.reasoning as string) ?? '',
        price,
        time,
      }
    }
    case 'OFFER_STORED': {
      const p = ev.details?.total_paise
      return {
        id: ev.id,
        side: 'buyer',
        name: 'Your buyer agent',
        kind: 'offer',
        text: p != null ? `Best price found: Rs ${(p / 100).toFixed(0)}. Reviewing it with you now.` : 'Best price found.',
        price: p ?? undefined,
        time,
      }
    }
    case 'NO_DEAL':
      return {
        id: ev.id,
        side: 'buyer',
        name: 'Your buyer agent',
        kind: 'info',
        text: 'None of the sellers could match your budget. You can try a higher budget or fewer items.',
        time,
      }
    case 'PAYMENT_CAPTURED':
      return {
        id: ev.id,
        side: 'seller',
        name: 'Razorpay',
        kind: 'paid',
        text: 'Payment received. Your order is confirmed.',
        time,
      }
    case 'PAYMENT_FAILED':
      return {
        id: ev.id,
        side: 'seller',
        name: 'Razorpay',
        kind: 'failed',
        text: 'Payment didn\'t go through. The offer is still valid if you want to try again.',
        time,
      }
    default:
      return null
  }
}
