import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma, chatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('refinar command starts refinement flow', async ({ page }) => {
  const unique = `${Date.now()}-refinar`
  const ticketId = `PAY-${Date.now()}`
  const setup = await setupChatUser(unique)
  await chatPrisma.ticket.create({
    data: {
      id: ticketId,
      teamId: setup.team.id,
      projectId: setup.project.id,
      statusId: setup.workflow.id,
      title: 'Ticket a refinar',
      description: 'Descripción inicial',
      priority: 'medium',
      order: 1,
      createdByType: 'member',
      createdByName: setup.member.name,
      metadata: JSON.stringify({ ticketKey: ticketId, syncEnabled: false }),
    },
  })
  await loginViaApi(page, setup.email, setup.password)

  const response = await page.request.post('/api/chat', {
    data: {
      teamId: setup.team.id,
      ownerMemberId: setup.member.id,
      projectId: setup.project.id,
      senderId: setup.member.id,
      senderName: setup.member.name,
      senderType: 'member',
      content: `/refinar ${ticketId}`,
    },
  })
  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(String(json.data?.aiMessage?.content || '')).toContain('Refinamiento iniciado')
})
