import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('chat api returns persisted user + ai messages', async ({ page }) => {
  const unique = `${Date.now()}-send`
  const setup = await setupChatUser(unique)
  await loginViaApi(page, setup.email, setup.password)

  const response = await page.request.post('/api/chat', {
    data: {
      teamId: setup.team.id,
      ownerMemberId: setup.member.id,
      projectId: setup.project.id,
      senderId: setup.member.id,
      senderName: setup.member.name,
      senderType: 'member',
      content: 'Hola Dayless, hazme un resumen rápido',
    },
  })

  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.data?.userMessage?.id).toBeTruthy()
  expect(json.data?.aiMessage?.id).toBeTruthy()
})
