import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketFindFirst: vi.fn(),
  ticketUpdate: vi.fn(),
  githubListIssues: vi.fn(),
  jiraSearchIssues: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    ticket: {
      findMany: mocks.ticketFindMany,
      findFirst: mocks.ticketFindFirst,
      update: mocks.ticketUpdate,
    },
  },
}))

vi.mock('@/lib/github', () => ({
  buildConfigFromProject: vi.fn(() => ({ owner: 'o', repo: 'r', token: 't' })),
  listIssues: mocks.githubListIssues,
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
  addIssueComment: vi.fn(),
}))

vi.mock('@/lib/jira', () => ({
  buildConfigFromProject: vi.fn(() => ({ config: { baseUrl: 'x', token: 'y', email: '' }, projectKey: 'PAY' })),
  searchIssues: mocks.jiraSearchIssues,
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
  addComment: vi.fn(),
}))

import { getTicketSourceAdapter } from '@/lib/ticket-source'

describe('ticket-source adapter factory', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset())
  })

  it('returns jira adapter when jira configured', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: 'p1', jiraBaseUrl: 'https://jira', jiraToken: 'x', jiraProjectKey: 'PAY' })
    mocks.jiraSearchIssues.mockResolvedValue({ issues: [], total: 0 })
    const adapter = await getTicketSourceAdapter('p1')
    expect(adapter.type).toBe('jira')
    await expect(adapter.listTickets('p1')).resolves.toEqual([])
  })

  it('returns manual adapter when no integration', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: 'p1', jiraBaseUrl: null, jiraToken: null, jiraProjectKey: null, githubRepo: null, githubToken: null })
    mocks.ticketFindMany.mockResolvedValue([])
    const adapter = await getTicketSourceAdapter('p1')
    expect(adapter.type).toBe('manual')
    await expect(adapter.listTickets('p1')).resolves.toEqual([])
  })
})
