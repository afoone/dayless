import { describe, expect, it } from 'vitest'
import { parsePendingActionFromAiText } from '@/lib/chat/action-parser'

describe('parsePendingActionFromAiText', () => {
  it('extracts ticket_proposal action from fenced json', () => {
    const result = parsePendingActionFromAiText(`
Texto previo
\`\`\`json
{"ticket_proposal":{"title":"Nuevo ticket","description":"Descripción suficiente para validar acción."}}
\`\`\`
`)
    expect(result.pendingAction?.type).toBe('ticket_proposal')
    expect(result.pendingAction?.title).toContain('Nuevo ticket')
    expect(result.cleanedText).not.toContain('```json')
  })

  it('returns null when no supported json action exists', () => {
    const result = parsePendingActionFromAiText('Sin acciones')
    expect(result.pendingAction).toBeNull()
  })
})
