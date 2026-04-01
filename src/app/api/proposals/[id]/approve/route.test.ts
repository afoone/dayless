import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  integrationCreate: vi.fn(),
  resolveAuthContext: vi.fn(),
  requireTeamRole: vi.fn(),
  getAdapter: vi.fn(),
  markManual: vi.fn(),
  createNotification: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    ticketProposal: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    integrationLog: {
      create: mocks.integrationCreate,
    },
  },
}))
vi.mock('@/lib/auth-context', () => ({
  resolveAuthContext: mocks.resolveAuthContext,
  requireTeamRole: mocks.requireTeamRole,
}))
vi.mock('@/lib/ticket-source', () => ({
  getTicketSourceAdapter: mocks.getAdapter,
}))
vi.mock('@/lib/ticket-cache', () => ({
  markImportedManualTicket: mocks.markManual,
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: mocks.createNotification,
}))

import { POST } from '@/app/api/proposals/[id]/approve/route'

describe('approve proposal route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves pending proposal and writes integration log', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'prop-1',
      teamId: 't1',
      projectId: 'p1',
      proposerMemberId: 'm1',
      title: 'Refinar endpoint',
      description: 'Desc',
      priority: 'high',
    })
    mocks.resolveAuthContext.mockResolvedValue({ currentTeamMember: { id: 'lead-1' } })
    mocks.getAdapter.mockResolvedValue({ type: 'manual' })
    mocks.markManual.mockResolvedValue({ id: 'tk1' })
    mocks.update.mockResolvedValue({ id: 'prop-1', status: 'approved' })
    const req = new NextRequest('http://localhost/api/proposals/prop-1/approve', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'prop-1' }) })
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mocks.requireTeamRole).toHaveBeenCalled()
    expect(mocks.integrationCreate).toHaveBeenCalled()
  })
})
