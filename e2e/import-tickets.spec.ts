import { test, expect } from '@playwright/test'
import { setupChatUser, loginViaApi, closeChatPrisma } from './helpers/chat-auth'

test.afterAll(async () => {
  await closeChatPrisma()
})

test('import tickets endpoint imports json tickets', async ({ page }) => {
  const unique = `${Date.now()}-import`
  const setup = await setupChatUser(unique)
  await loginViaApi(page, setup.email, setup.password)

  const importRes = await page.request.post('/api/import/tickets', {
    data: {
      projectId: setup.project.id,
      format: 'json',
      tickets: [
        { key: 'IMP-1', title: 'Imported 1', description: 'A' },
        { key: 'IMP-2', title: 'Imported 2', description: 'B' },
      ],
    },
  })
  expect(importRes.ok()).toBeTruthy()
  const importJson = await importRes.json()
  expect(importJson.success).toBe(true)
  expect(importJson.data?.importedCount).toBe(2)

  const cachedRes = await page.request.get(
    `/api/tickets/cache/${encodeURIComponent('IMP-1')}?projectId=${encodeURIComponent(setup.project.id)}`
  )
  expect(cachedRes.ok()).toBeTruthy()
  const cachedJson = await cachedRes.json()
  expect(cachedJson.success).toBe(true)
})
