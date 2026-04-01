import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAdapter: vi.fn(),
  projectFindUnique: vi.fn(),
  integrationCreate: vi.fn(),
}))

vi.mock('@/lib/ticket-source', () => ({
  getTicketSourceAdapter: mocks.getAdapter,
}))
vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    integrationLog: { create: mocks.integrationCreate },
  },
}))

import { POST } from '@/app/api/tickets/cache/[key]/comment/route'

describe('POST /api/tickets/cache/[key]/comment', () => {
  it('adds comment through adapter', async () => {
    mocks.getAdapter.mockResolvedValue({ type: 'manual', addComment: vi.fn().mockResolvedValue(true) })
    mocks.projectFindUnique.mockResolvedValue({ teamId: 't1' })
    const req = new NextRequest('http://localhost/api/tickets/cache/PAY-1/comment', {
      method: 'POST',
      body: JSON.stringify({ projectId: 'p1', comment: 'hola' }),
    })
    const res = await POST(req, { params: Promise.resolve({ key: 'PAY-1' }) })
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
