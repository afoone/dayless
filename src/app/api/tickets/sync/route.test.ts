import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  getAdapter: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { project: { findUnique: mocks.projectFindUnique } },
}))
vi.mock('@/lib/ticket-source', () => ({
  getTicketSourceAdapter: mocks.getAdapter,
}))
vi.mock('@/lib/ticket-cache', () => ({
  upsertTicketCacheFromExternal: mocks.upsert,
}))

import { GET } from '@/app/api/tickets/sync/route'

describe('GET /api/tickets/sync', () => {
  it('syncs tickets and returns count', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: 'p1', teamId: 't1' })
    mocks.getAdapter.mockResolvedValue({
      type: 'manual',
      listTickets: vi.fn().mockResolvedValue([{ key: 'PAY-1', title: 'A', description: '', status: 'open' }]),
    })
    mocks.upsert.mockResolvedValue({ id: 'local-1' })

    const req = new NextRequest('http://localhost/api/tickets/sync?projectId=p1')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.syncedCount).toBe(1)
  })
})
