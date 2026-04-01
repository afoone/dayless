import { describe, expect, it } from 'vitest'
import { parseQuickAction } from '@/lib/chat/quick-actions'

describe('parseQuickAction', () => {
  it('parses /standup-equipo command', () => {
    const parsed = parseQuickAction('/standup-equipo')
    expect(parsed?.command).toBe('standup_team')
  })

  it('parses /refinar with args', () => {
    const parsed = parseQuickAction('/refinar PAY-123')
    expect(parsed?.command).toBe('refinar')
    expect(parsed?.args).toBe('PAY-123')
  })

  it('returns null for non-command text', () => {
    expect(parseQuickAction('hola equipo')).toBeNull()
  })
})
