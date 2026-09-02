export interface LiveEvent {
  id: string
  timestamp: string
  session_id: string
  actor: string
  action_type: string
  details: Record<string, any>
  sequence?: number
}