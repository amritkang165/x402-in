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
