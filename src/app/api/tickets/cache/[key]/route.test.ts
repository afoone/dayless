import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCachedTicket: vi.fn(),
  isCacheExpired: vi.fn(),
  upsert: vi.fn(),
  getAdapter: vi.fn(),
  projectFindUnique: vi.fn(),
}))

vi.mock('@/lib/ticket-cache', () => ({
  getCachedTicket: mocks.getCachedTicket,
  isCacheExpired: mocks.isCacheExpired,
  upsertTicketCacheFromExternal: mocks.upsert,
}))
vi.mock('@/lib/ticket-source', () => ({
  getTicketSourceAdapter: mocks.getAdapter,
}))
vi.mock('@/lib/db', () => ({
  db: { project: { findUnique: mocks.projectFindUnique }, integrationLog: { create: vi.fn() } },
}))

import { GET } from '@/app/api/tickets/cache/[key]/route'

describe('GET /api/tickets/cache/[key]', () => {
  it('returns cached ticket when available', async () => {
    mocks.getCachedTicket.mockResolvedValue({ id: 't1', title: 'Cached', metadata: '{}' })
    mocks.isCacheExpired.mockReturnValue(false)
    const req = new NextRequest('http://localhost/api/tickets/cache/PAY-1?projectId=p1')
    const res = await GET(req, { params: Promise.resolve({ key: 'PAY-1' }) })
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('t1')
  })
})
