export type ChatActionType =
  | 'ticket_proposal'
  | 'knowledge_entry'
  | 'ticket_update'
  | 'standup_checkin'

export type ChatPendingAction = {
  id: string
  type: ChatActionType
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type ChatActionParseResult = {
  cleanedText: string
  pendingAction: ChatPendingAction | null
}
