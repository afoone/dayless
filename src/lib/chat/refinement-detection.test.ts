import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    ticket: { findMany: mocks.ticketFindMany },
  },
}))

import { getUnrefinedTickets } from '@/lib/chat/refinement-detection'

describe('getUnrefinedTickets', () => {
  beforeEach(() => {
    mocks.ticketFindMany.mockReset()
  })

  it('returns tickets without AC or estimate', async () => {
    mocks.ticketFindMany.mockResolvedValue([
      { id: '1', title: 'A', estimate: null, metadata: null, updatedAt: new Date() },
      { id: '2', title: 'B', estimate: '3', metadata: JSON.stringify({ acceptanceCriteria: ['ok'] }), updatedAt: new Date() },
    ])
    const rows = await getUnrefinedTickets('p1')
    expect(rows.map((r) => r.id)).toEqual(['1'])
  })
})
