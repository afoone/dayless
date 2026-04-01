import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('accept invitation via token as unauthenticated user', async ({ request }) => {
  const unique = Date.now()
  const ownerEmail = `e2e-owner-${unique}@example.com`
  const inviteEmail = `e2e-invitee-${unique}@example.com`
  const token = `e2e-token-${unique}`

  const setup = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: ownerEmail,
        password: 'hashed-placeholder',
        name: 'Owner E2E',
      },
    })
    const organization = await tx.organization.create({
      data: {
        name: `Org E2E ${unique}`,
        slug: `org-e2e-${unique}`,
        plan: 'free',
        maxUsers: 50,
      },
    })
    const ownerOrgMember = await tx.orgMember.create({
      data: {
        userId: owner.id,
        organizationId: organization.id,
        role: 'owner',
      },
    })
    const team = await tx.team.create({
      data: {
        name: `Team E2E ${unique}`,
        color: '#10b981',
        organizationId: organization.id,
      },
    })
    await tx.teamMember.create({
      data: {
        teamId: team.id,
        userId: owner.id,
        orgMemberId: ownerOrgMember.id,
        name: 'Owner E2E',
        role: 'Lead',
        teamRole: 'lead',
        email: ownerEmail,
        status: 'active',
      },
    })
    const invitation = await tx.invitation.create({
      data: {
        organizationId: organization.id,
        teamId: team.id,
        email: inviteEmail,
        teamRole: 'member',
        token,
        invitedById: ownerOrgMember.id,
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    return { invitationId: invitation.id }
  })

  const response = await request.post(`/api/invitations/accept/${token}`, {
    data: {
      name: 'Invitee E2E',
      password: 'secret123',
    },
  })

  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.data?.accepted).toBe(true)

  const invitation = await prisma.invitation.findUnique({
    where: { id: setup.invitationId },
    select: { status: true, acceptedAt: true },
  })
  expect(invitation?.status).toBe('accepted')
  expect(invitation?.acceptedAt).toBeTruthy()

  const invitee = await prisma.user.findUnique({
    where: { email: inviteEmail },
    select: { id: true },
  })
  expect(invitee?.id).toBeTruthy()
})
