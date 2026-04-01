import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma, chatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('tickets sync endpoint syncs manual source to cache', async ({ page }) => {
  const unique = `${Date.now()}-sync`
  const setup = await setupChatUser(unique)
  await chatPrisma.ticket.create({
    data: {
      teamId: setup.team.id,
      projectId: setup.project.id,
      statusId: setup.workflow.id,
      title: 'Manual ticket',
      description: 'seed',
      priority: 'medium',
      order: 1,
      createdByType: 'member',
      createdByName: setup.member.name,
    },
  })
  await loginViaApi(page, setup.email, setup.password)

  const res = await page.request.get(`/api/tickets/sync?projectId=${encodeURIComponent(setup.project.id)}`)
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json.success).toBe(true)
  expect(json.data?.syncedCount).toBeGreaterThan(0)
})
