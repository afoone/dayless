import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  teamMemberFindMany: vi.fn(),
  standupFindMany: vi.fn(),
  ticketFindMany: vi.fn(),
  knowledgeFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    teamMember: { findMany: mocks.teamMemberFindMany },
    standupCheckin: { findMany: mocks.standupFindMany },
    ticket: { findMany: mocks.ticketFindMany },
    knowledgeEntry: { findMany: mocks.knowledgeFindMany },
  },
}))

import { buildCrossMemberContext } from '@/lib/chat/cross-member-context'

describe('buildCrossMemberContext', () => {
  beforeEach(() => {
    mocks.teamMemberFindMany.mockReset()
    mocks.standupFindMany.mockReset()
    mocks.ticketFindMany.mockReset()
    mocks.knowledgeFindMany.mockReset()
  })

  it('builds deterministic context from structured data', async () => {
    mocks.teamMemberFindMany.mockResolvedValue([{ id: 'm2', name: 'Ana', role: 'lead' }])
    mocks.standupFindMany.mockResolvedValue([{ memberId: 'm2', yesterdayWork: 'Bugfix', todayPlan: 'Deploy', blockers: null }])
    mocks.ticketFindMany.mockResolvedValue([{ id: 't1', title: 'Fix auth', assigneeMemberId: 'm2', updatedAt: new Date() }])
    mocks.knowledgeFindMany
      .mockResolvedValueOnce([{ key: 'Blocker', value: 'API caído' }])
      .mockResolvedValueOnce([{ key: 'Decision', value: 'Usar cache' }])

    const context = await buildCrossMemberContext('team1', 'proj1', 'm1')
    expect(context).toContain('CONTEXTO DE OTROS MIEMBROS')
    expect(context).toContain('Ana')
    expect(context).toContain('Fix auth')
    expect(context).toContain('DECISIONES RECIENTES')
  })
})
