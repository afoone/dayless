import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createMock, emitMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  emitMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    notification: {
      create: createMock,
    },
  },
}))

vi.mock('@/lib/sse', () => ({
  emitToMember: emitMock,
}))

import { createNotification } from '@/lib/notifications'

describe('createNotification', () => {
  beforeEach(() => {
    createMock.mockReset()
    emitMock.mockReset()
  })

  it('persists notification and emits SSE', async () => {
    const createdAt = new Date('2026-04-01T00:00:00.000Z')
    createMock.mockResolvedValue({
      id: 'notif-1',
      type: 'invitation_accepted',
      title: 'Accepted',
      createdAt,
    })

    const result = await createNotification({
      memberId: 'member-1',
      teamId: 'team-1',
      type: 'invitation_accepted',
      title: 'Accepted',
      metadata: { invitationId: 'inv-1' },
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      data: {
        memberId: 'member-1',
        teamId: 'team-1',
        type: 'invitation_accepted',
        title: 'Accepted',
      },
    })
    expect(emitMock).toHaveBeenCalledWith('member-1', 'notification', {
      id: 'notif-1',
      type: 'invitation_accepted',
      title: 'Accepted',
      createdAt: createdAt.toISOString(),
    })
    expect(result.id).toBe('notif-1')
  })
})
