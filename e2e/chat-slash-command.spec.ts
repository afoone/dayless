import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('slash command message is accepted by chat API', async ({ page }) => {
  const unique = `${Date.now()}-slash`
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
      content: '/standup avance backend y blocker en QA',
    },
  })

  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
})
