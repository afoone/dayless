import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  resolveAuthContext: vi.fn(),
  requireTeamAccess: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  teamMemberFindMany: vi.fn(),
  createNotification: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  resolveAuthContext: mocks.resolveAuthContext,
  requireTeamAccess: mocks.requireTeamAccess,
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: mocks.createNotification,
}))
vi.mock('@/lib/db', () => ({
  db: {
    ticketProposal: {
      findMany: mocks.findMany,
      create: mocks.create,
    },
    teamMember: {
      findMany: mocks.teamMemberFindMany,
    },
  },
}))

import { GET, POST } from '@/app/api/proposals/route'

describe('proposals route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET limits non-lead user to own proposals', async () => {
    mocks.resolveAuthContext.mockResolvedValue({
      currentTeamMember: { id: 'm1', teamRole: 'member' },
    })
    mocks.findMany.mockResolvedValue([])
    const req = new NextRequest('http://localhost/api/proposals?teamId=t1')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ proposerMemberId: 'm1' }),
      })
    )
  })

  it('POST creates proposal and notifies leads', async () => {
    mocks.resolveAuthContext.mockResolvedValue({ currentTeamMember: { id: 'm1', teamRole: 'member' } })
    mocks.create.mockResolvedValue({ id: 'p1' })
    mocks.teamMemberFindMany.mockResolvedValue([{ id: 'lead1' }])
    const req = new NextRequest('http://localhost/api/proposals', {
      method: 'POST',
      body: JSON.stringify({
        teamId: 't1',
        projectId: 'pr1',
        proposerMemberId: 'm1',
        title: 'Nueva idea',
        description: 'Descripción válida para crear propuesta',
      }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mocks.createNotification).toHaveBeenCalled()
  })
})
