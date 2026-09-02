import type { LiveEvent } from '../types/live'

export function liveUrl(sessionId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/theatre/${sessionId}`
}

/**
 * Open a live theatre feed for a session (or '*' for all sessions).
 * Auto-reconnects every 2s on disconnect. Returns a cleanup function.
 */
export function openLiveFeed(
  sessionId: string,
  onEvent: (ev: LiveEvent) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let retry: number | undefined
  let attempting = false

  const connect = () => {
    if (closed || attempting) return
    attempting = true
    try {
      ws = new WebSocket(liveUrl(sessionId))
    } catch {
      retry = window.setTimeout(connect, 2000)
      return
    }
    ws.onopen = () => {
      attempting = false
      onStatus?.(true)
    }
    ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data) as LiveEvent)
      } catch {
        /* ignore malformed messages */
      }
    }
    ws.onerror = () => {
      /* onclose will handle the retry */
    }
    ws.onclose = () => {
      attempting = false
      onStatus?.(false)
      if (!closed) retry = window.setTimeout(connect, 2000)
    }
  }

  connect()

  return () => {
    closed = true
    if (retry) window.clearTimeout(retry)
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
  }
}