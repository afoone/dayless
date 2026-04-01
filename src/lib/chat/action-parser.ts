import { randomUUID } from 'crypto'
import type { ChatActionParseResult, ChatPendingAction } from '@/lib/chat/types'

function parseFirstJsonFence(text: string): { object: Record<string, unknown> | null; cleaned: string } {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i
  const match = text.match(fence)
  if (!match) return { object: null, cleaned: text }
  try {
    const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>
    const cleaned = text.replace(match[0], '\n').replace(/\n{3,}/g, '\n\n').trim()
    return { object: parsed, cleaned }
  } catch {
    return { object: null, cleaned: text }
  }
}

function buildPendingAction(type: ChatPendingAction['type'], payload: Record<string, unknown>): ChatPendingAction | null {
  if (type === 'ticket_proposal') {
    const title = String(payload.title || '').trim()
    const description = String(payload.description || '').trim()
    if (title.length < 4 || description.length < 8) return null
    return {
      id: randomUUID(),
      type,
      title: `Propuesta: ${title}`,
      summary: description,
      payload,
    }
  }
  if (type === 'knowledge_entry') {
    const key = String(payload.key || '').trim()
    const value = String(payload.value || '').trim()
    if (!key || !value) return null
    return {
      id: randomUUID(),
      type,
      title: `Guardar conocimiento: ${key}`,
      summary: value,
      payload,
    }
  }
  if (type === 'ticket_update') {
    const ticketKey = String(payload.ticketKey || '').trim()
    if (!ticketKey) return null
    return {
      id: randomUUID(),
      type,
      title: `Actualizar ticket ${ticketKey}`,
      summary: String(payload.comment || payload.description || '').trim() || 'Aplicar cambios sugeridos al ticket',
      payload,
    }
  }
  if (type === 'standup_checkin') {
    return {
      id: randomUUID(),
      type,
      title: 'Guardar standup',
      summary: String(payload.todayPlan || payload.yesterdayWork || '').trim() || 'Guardar check-in de standup',
      payload,
    }
  }
  return null
}

export function parsePendingActionFromAiText(text: string): ChatActionParseResult {
  const { object, cleaned } = parseFirstJsonFence(text)
  if (!object) return { cleanedText: text, pendingAction: null }

  const supported: Array<ChatPendingAction['type']> = [
    'ticket_proposal',
    'knowledge_entry',
    'ticket_update',
    'standup_checkin',
  ]
  for (const type of supported) {
    const payload = object[type]
    if (payload && typeof payload === 'object') {
      const pendingAction = buildPendingAction(type, payload as Record<string, unknown>)
      return { cleanedText: cleaned, pendingAction }
    }
  }

  return { cleanedText: cleaned, pendingAction: null }
}
