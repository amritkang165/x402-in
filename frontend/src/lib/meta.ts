export interface StatusMeta {
  label: string
  border: string
  chip: string
  dot: string
  icon: string
  text: string
}

export const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Waiting',
    border: 'border-ink-600',
    chip: 'bg-ink-700 text-slate-400',
    dot: 'bg-slate-500',
    icon: '•',
    text: 'text-slate-400',
  },
  NEGOTIATING: {
    label: 'Negotiating',
    border: 'border-accent/40',
    chip: 'bg-accent/10 text-accent',
    dot: 'bg-accent animate-pulse',
    icon: '⟳',
    text: 'text-accent',
  },
  OFFER: {
    label: 'Offer',
    border: 'border-mint/50',
    chip: 'bg-mint/10 text-mint',
    dot: 'bg-mint',
    icon: '✓',
    text: 'text-mint',
  },
  ACCEPT: {
    label: 'Accepted',
    border: 'border-mint/50',
    chip: 'bg-mint/10 text-mint',
    dot: 'bg-mint',
    icon: '✓',
    text: 'text-mint',
  },
  COUNTER: {
    label: 'Counter',
    border: 'border-amber/50',
    chip: 'bg-amber/10 text-amber',
    dot: 'bg-amber',
    icon: '↔',
    text: 'text-amber',
  },
  REJECT: {
    label: 'Rejected',
    border: 'border-rose/50',
    chip: 'bg-rose/10 text-rose',
    dot: 'bg-rose',
    icon: '✕',
    text: 'text-rose',
  },
  TIMEOUT: {
    label: 'Timed out',
    border: 'border-ink-600 border-dashed',
    chip: 'bg-ink-700 text-slate-400',
    dot: 'bg-slate-500',
    icon: '…',
    text: 'text-slate-400',
  },
  ERROR: {
    label: 'Error',
    border: 'border-ink-600',
    chip: 'bg-ink-700 text-slate-400',
    dot: 'bg-slate-500',
    icon: '!',
    text: 'text-slate-400',
  },
}

export const ACTOR_COLORS: Record<string, string> = {
  buyer_agent: 'border-accent/40',
  merchant_agent: 'border-mint/40',
  system: 'border-ink-600',
  razorpay: 'border-violet/40',
}

export function fmtRs(paise: number | null | undefined): string {
  if (paise == null) return '—'
  return 'Rs. ' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}