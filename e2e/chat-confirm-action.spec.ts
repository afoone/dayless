import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma, chatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('confirm chat action persists knowledge entry', async ({ page }) => {
  const unique = `${Date.now()}-confirm`
  const setup = await setupChatUser(unique)
  await loginViaApi(page, setup.email, setup.password)

  const actionId = `act-${Date.now()}`
  const response = await page.request.post(`/api/chat/actions/${actionId}/confirm`, {
    data: {
      teamId: setup.team.id,
      ownerMemberId: setup.member.id,
      projectId: setup.project.id,
      senderName: setup.member.name,
      action: {
        id: actionId,
        type: 'knowledge_entry',
        title: 'Guardar decisión',
        summary: 'Usar caché',
        payload: { key: 'Cache policy', value: 'Enable in gateway', category: 'decision' },
      },
    },
  })

  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)

  const entry = await chatPrisma.knowledgeEntry.findFirst({
    where: { teamId: setup.team.id, key: 'Cache policy' },
    select: { id: true },
  })
  expect(entry?.id).toBeTruthy()
})
