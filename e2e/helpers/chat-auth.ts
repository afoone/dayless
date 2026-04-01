import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import type { Page } from '@playwright/test'

const prisma = new PrismaClient()

export async function setupChatUser(unique: string) {
  const email = `chat-e2e-${unique}@example.com`
  const password = 'secret123'
  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { email, password: passwordHash, name: `Chat E2E ${unique}` },
  })
  const organization = await prisma.organization.create({
    data: {
      name: `Org Chat ${unique}`,
      slug: `org-chat-${unique}`,
      plan: 'free',
      maxUsers: 10,
    },
  })
  const orgMember = await prisma.orgMember.create({
    data: { userId: user.id, organizationId: organization.id, role: 'owner' },
  })
  const team = await prisma.team.create({
    data: { name: `Team Chat ${unique}`, color: '#10b981', organizationId: organization.id },
  })
  const member = await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: user.id,
      orgMemberId: orgMember.id,
      name: `Chat E2E ${unique}`,
      role: 'Lead',
      teamRole: 'lead',
      email,
      status: 'active',
    },
  })
  const project = await prisma.project.create({
    data: { teamId: team.id, name: `Project Chat ${unique}`, status: 'active' },
  })
  const workflow = await prisma.ticketWorkflow.create({
    data: {
      projectId: project.id,
      name: 'Todo',
      position: 0,
      color: '#10b981',
    },
  })
  await prisma.teamMember.update({
    where: { id: member.id },
    data: { defaultProjectId: project.id },
  })

  return { email, password, team, member, project, workflow }
}

export async function loginViaApi(page: Page, email: string, password: string) {
  const csrfRes = await page.request.get('/api/auth/csrf')
  const csrfJson = await csrfRes.json()
  const csrfToken = csrfJson?.csrfToken as string

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: 'http://localhost:3000/',
    json: 'true',
  })

  const signInRes = await page.request.post('/api/auth/callback/credentials', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: body.toString(),
  })

  if (!signInRes.ok()) {
    throw new Error(`Sign-in failed with status ${signInRes.status()}`)
  }
}

export async function closeChatPrisma() {
  await prisma.$disconnect()
}

export { prisma as chatPrisma }
