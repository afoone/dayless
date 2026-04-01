import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedTicket: vi.fn(),
  setRefinementState: vi.fn(),
}))

vi.mock('@/lib/ticket-cache', () => ({
  getCachedTicket: mocks.getCachedTicket,
  setRefinementState: mocks.setRefinementState,
}))

import { defaultRefinementSession, getRefinementSession, saveRefinementSession } from '@/lib/chat/refinement-state'

describe('refinement-state', () => {
  beforeEach(() => {
    mocks.getCachedTicket.mockReset()
    mocks.setRefinementState.mockReset()
  })

  it('creates default session', () => {
    const session = defaultRefinementSession()
    expect(session.phase).toBe('deteccion')
    expect(session.iteration).toBe(1)
  })

  it('reads persisted refinement session from metadata', async () => {
    mocks.getCachedTicket.mockResolvedValue({
      metadata: JSON.stringify({ refinement: { phase: 'cruce', iteration: 2, consultedMemberIds: [], openQuestions: [], acDraft: [], updatedAt: 'x' } }),
    })
    const session = await getRefinementSession('p1', 'PAY-1')
    expect(session?.phase).toBe('cruce')
  })

  it('persists session with helper', async () => {
    await saveRefinementSession('p1', 'PAY-1', defaultRefinementSession())
    expect(mocks.setRefinementState).toHaveBeenCalled()
  })
})
