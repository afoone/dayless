import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma, chatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('create proposal from chat action and approve as lead', async ({ page }) => {
  const unique = `${Date.now()}-proposal-approve`
  const setup = await setupChatUser(unique)
  await loginViaApi(page, setup.email, setup.password)

  const actionId = `act-${Date.now()}`
  const confirmRes = await page.request.post(`/api/chat/actions/${actionId}/confirm`, {
    data: {
      teamId: setup.team.id,
      ownerMemberId: setup.member.id,
      projectId: setup.project.id,
      senderName: setup.member.name,
      action: {
        id: actionId,
        type: 'ticket_proposal',
        title: 'Crear propuesta',
        summary: 'Necesitamos un ticket',
        payload: {
          title: 'Añadir retry en sync',
          description: 'Agregar retries para sincronización de tickets',
          priority: 'high',
        },
      },
    },
  })
  expect(confirmRes.ok()).toBeTruthy()

  const proposal = await chatPrisma.ticketProposal.findFirst({
    where: { teamId: setup.team.id, title: 'Añadir retry en sync' },
    orderBy: { createdAt: 'desc' },
  })
  expect(proposal?.id).toBeTruthy()

  const approveRes = await page.request.post(`/api/proposals/${proposal!.id}/approve`, { data: {} })
  expect(approveRes.ok()).toBeTruthy()

  const approved = await chatPrisma.ticketProposal.findUnique({ where: { id: proposal!.id } })
  expect(approved?.status).toBe('approved')
  expect(approved?.externalKey).toBeTruthy()
})
