export interface ProtocolMessage {
  protocol: 'x402-in'
  version: string
  message_id: string
  session_id: string
  sender: string
  recipient: string
  type: string
  timestamp: string
  payload: Record<string, unknown>
}

export interface CatalogItem {
  id: string
  name: string
  base_price_paise: number
  floor_price_paise: number
  currency: 'INR'
  available: boolean
  stock: number
  variants: string[]
  description?: string
}

export interface DiscountDetail {
  rule: string
  amount_paise: number
  description: string
}

export interface PricingBreakdown {
  subtotal_paise: number
  discounts: DiscountDetail[]
  total_paise: number
  currency: 'INR'
}

export interface NegotiateResponse {
  merchant_id: string
  session_id: string
  offer_id?: string
  status: 'OFFER' | 'COUNTER' | 'REJECT' | 'ACCEPT'
  items: { item_id: string; quantity: number }[]
  pricing?: PricingBreakdown
  reasoning: string
  round: number
  next_action?: string
  suggested_alternatives?: Record<string, unknown>[]
  expires_at?: string
}
