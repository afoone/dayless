import { describe, expect, it } from 'vitest'
import { buildChatPromptContext } from '@/lib/chat/prompt-builder'

describe('buildChatPromptContext', () => {
  it('includes required sections', () => {
    const prompt = buildChatPromptContext({
      teamName: 'Core Team',
      organizationName: 'Org',
      projectName: 'Payments',
      members: [{ name: 'Ana', role: 'lead' }],
      knowledgeEntries: [{ key: 'API', value: 'REST' }],
      projectSummary: '- Payments',
      crossMemberContext: 'CTX',
      storyPointGuide: '1,2,3',
    })

    expect(prompt).toContain('IDENTIDAD:')
    expect(prompt).toContain('EQUIPO:')
    expect(prompt).toContain('CONOCIMIENTO:')
    expect(prompt).toContain('ACCIONES DISPONIBLES:')
    expect(prompt).toContain('ticket_proposal')
  })
})
