import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma, chatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('lead rejects proposal and author receives status update', async ({ page }) => {
  const unique = `${Date.now()}-proposal-reject`
  const setup = await setupChatUser(unique)
  await loginViaApi(page, setup.email, setup.password)

  const proposal = await chatPrisma.ticketProposal.create({
    data: {
      teamId: setup.team.id,
      projectId: setup.project.id,
      proposerMemberId: setup.member.id,
      title: 'Spike de cache',
      description: 'Evaluar estrategia de cache del adapter',
      status: 'pending_review',
    },
  })

  const rejectRes = await page.request.post(`/api/proposals/${proposal.id}/reject`, {
    data: { reason: 'No prioritaria en este sprint' },
  })
  expect(rejectRes.ok()).toBeTruthy()

  const updated = await chatPrisma.ticketProposal.findUnique({ where: { id: proposal.id } })
  expect(updated?.status).toBe('rejected')
  expect(updated?.rejectReason).toContain('No prioritaria')

  const notification = await chatPrisma.notification.findFirst({
    where: {
      memberId: setup.member.id,
      teamId: setup.team.id,
      type: 'proposal_rejected',
    },
    orderBy: { createdAt: 'desc' },
  })
  expect(notification?.id).toBeTruthy()
})
