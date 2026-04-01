import { test, expect } from '@playwright/test'

test('register endpoint creates user + organization payload', async ({ request }) => {
  const unique = Date.now()
  const response = await request.post('/api/register', {
    data: {
      email: `e2e-register-${unique}@example.com`,
      password: 'secret123',
      name: 'E2E Register',
    },
  })

  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.data?.organization?.id).toBeTruthy()
  expect(json.data?.orgMember?.role).toBe('owner')
  expect(json.data?.onboardingRequired).toBe(true)
})
