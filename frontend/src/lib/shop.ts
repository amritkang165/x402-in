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
}

export const CATALOG: Record<string, CatalogEntry> = {
  mug_001: {
    id: 'mug_001',
    name: 'Handmade Ceramic Mug',
    desc: 'Wheel-thrown, food-safe glaze. Ships in our signature kraft box.',
    basePaise: 30000,
    merchant: 'pottery_rahul_001',
    art: 'mug',
    budgetPaise: 40000,
    tag: 'Bestseller',
  },
  bowl_001: {
    id: 'bowl_001',
    name: 'Ceramic Serving Bowl',
    desc: 'Generous 8″ bowl for salads and soups. Subtle speckle glaze.',
    basePaise: 45000,
    merchant: 'pottery_rahul_001',
    art: 'bowl',
    budgetPaise: 70000,
  },
  plate_001: {
    id: 'plate_001',
    name: 'Ceramic Dinner Plate',
    desc: '10″ dinner plate, hand-finished edges. Dishwasher safe.',
    basePaise: 20000,
    merchant: 'pottery_rahul_001',
    art: 'plate',
    budgetPaise: 30000,
  },
  candle_001: {
    id: 'candle_001',
    name: 'Hand-Poured Soy Candle',
    desc: '45-hour burn, cotton wick, light vanilla & cedar scent.',
    basePaise: 25000,
    merchant: 'candles_sneha_002',
    art: 'candle',
    budgetPaise: 35000,
    tag: '20% off 3+',
  },
}

export const FALLBACK_MERCHANTS: Record<string, string> = {
  pottery_rahul_001: "Rahul's Handmade Pottery",
  candles_sneha_002: "Sneha's Candle Studio",
}

export const MERCHANT_META: Record<string, { rating: string; reviews: string; blurb: string }> = {
  pottery_rahul_001: {
    rating: '4.8',
    reviews: '312 ratings',
    blurb: 'Small-batch pottery from Jaipur',
  },
  candles_sneha_002: {
    rating: '4.9',
    reviews: '187 ratings',
    blurb: 'Natural soy candles, hand-poured',
  },
}

export function merchantName(id: string): string {
  return FALLBACK_MERCHANTS[id] ?? id
}

export function itemName(id: string): string {
  return CATALOG[id]?.name ?? id.split('_')[0]
}

export function describeItems(items: { item_id: string; quantity: number }[] | undefined): string {
  if (!items || items.length === 0) return 'your request'
  return items.map((r) => `${r.quantity} × ${itemName(r.item_id)}`).join(', ')
}

export function entryFor(id: string): CatalogEntry | undefined {
  return CATALOG[id]
}

const PART = LiveEventPrototype()

function LiveEventPrototype(): { action_type: string; session_id: string; actor: string; timestamp: string; details: Record<string, any> } {
  return { action_type: '', session_id: '', actor: '', timestamp: '', details: {} }
}
void PART

export interface ChatMessage {
  id: string
  side: 'buyer' | 'seller' | 'system'
  actor: string
  name: string
  kind: string
  text: string
  priceLabel?: string
  meta?: string
  raw?: LiveEvent
}

const KIND_LABEL: Record<string, string> = {
  OFFER: 'Offer',
  ACCEPT: 'Accepted',
  COUNTER: 'Counter-offer',
  REJECT: 'Turned down',
  TIMEOUT: 'No response',
  ERROR: 'Issue',
}

export function humanizeEvent(ev: LiveEvent): ChatMessage | null {
  const ts = new Date(ev.timestamp)
  const clock = Number.isNaN(ts.getTime())
    ? ''
    : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (ev.action_type === 'SESSION_STARTED') {
    const intent: any = ev.details?.intent
    return {
      id: ev.id,
      side: 'buyer',
      actor: ev.actor,
      name: 'Your AI buyer',
      kind: 'start',
      text: `Heard you. Asking every matching seller on the registry for ${describeItems(intent?.items_requested)}.`,
      meta: `budget ${intent?.budget_paise != null ? (intent.budget_paise / 100).toFixed(0) : ''}· clock ${clock}`,
    }
  }
  if (ev.action_type === 'DISCOVERY') {
    const n = Array.isArray(ev.details?.merchants) ? ev.details.merchants.length : 0
    return {
      id: ev.id,
      side: 'buyer',
      actor: ev.actor,
      name: 'Your AI buyer',
      kind: 'discovery',
      text: `Found ${n} seller${n === 1 ? '' : 's'} in the registry — pitching all of them in parallel.`,
      meta: `clock ${clock}`,
    }
  }
  if (ev.action_type === 'NEGOTIATION') {
    const d = ev.details ?? {}
    const status = (d.status as string) ?? ''
    const price = d.total_paise != null ? (d.total_paise / 100).toFixed(0) : undefined
    storePrice(d)
    if (d.merchant_id && (d.merchant_id as string).includes('candle')) {
      return provide(`id-${ev.id}`, 'seller', ev.actor, merchantName(d.merchant_id as string), status, d.reasoning ?? '', price, clock)
    }
    return provide(`id-${ev.id}`, 'seller', ev.actor, merchantName(d.merchant_id as string), status, d.reasoning ?? '', price, clock)
  }
  if (ev.action_type === 'OFFER_STORED') {
    const price = ev.details?.total_paise != null ? (ev.details.total_paise / 100).toFixed(0) : undefined
    return {
      id: ev.id,
      side: 'buyer',
      actor: ev.actor,
      name: 'Your AI buyer',
      kind: 'locked',
      text: `Best price locked in: Rs ${price}. Awaiting your approval to pay.`,
      priceLabel: price != null ? `Rs ${price}` : undefined,
      meta: `clock ${clock}`,
    }
  }
  if (ev.action_type === 'NO_DEAL') {
    return {
      id: ev.id,
      side: 'buyer',
      actor: ev.actor,
      name: 'Your AI buyer',
      kind: 'nodeal',
      text: 'No seller could meet your budget. Suggest a higher budget or fewer items — happy to retry.',
      meta: `clock ${clock}`,
    }
  }
  if (ev.action_type === 'PAYMENT_CAPTURED') {
    return {
      id: ev.id,
      side: 'system',
      actor: ev.actor,
      name: 'Razorpay',
      kind: 'paid',
      text: 'Payment captured — your order is confirmed.',
      meta: `clock ${clock}`,
    }
  }
  if (ev.action_type === 'PAYMENT_FAILED') {
    return {
      id: ev.id,
      side: 'system',
      actor: ev.actor,
      name: 'Razorpay',
      kind: 'failed',
      text: 'Payment failed — the offer is still valid, you can retry.',
      meta: `clock ${clock}`,
    }
  }
  return null
}

let _lastStore = 0
function storePrice(d: any) {
  if (typeof d.total_paise === 'number') _lastStore = d.total_paise
  void _lastStore
}
function provide(
  id: string,
  side: 'buyer' | 'seller',
  actor: string,
  name: string,
  status: string,
  reason: string,
  price?: string,
  clock?: string,
): ChatMessage {
  const label = KIND_LABEL[status] ?? status
  const text =
    reason || (price != null ? `I can do Rs ${price} — my best hand-finished rate.` : 'Let me check the workshop.')
  return {
    id,
    side,
    actor,
    name,
    kind: status.toLowerCase(),
    text,
    priceLabel: price != null ? `Rs ${price}` : undefined,
    meta: `${label}· clock ${clock ?? ''}`.replace('· clock ', '').replace('clock  ·', ''),
  }
}