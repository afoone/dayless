import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getToken } from 'next-auth/jwt'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

const acceptSchema = z.object({
  name: z.string().min(2).optional(),
  password: z.string().min(6).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }

    const invitation = await db.invitation.findUnique({ where: { token } })
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Invitation is not pending' }, { status: 409 })
    }
    if (invitation.expiresAt <= new Date()) {
      await db.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } })
      return NextResponse.json({ success: false, error: 'Invitation expired' }, { status: 410 })
    }

    const org = await db.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { id: true, maxUsers: true },
    })
    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const currentMembers = await db.orgMember.count({ where: { organizationId: org.id } })
    if (currentMembers >= org.maxUsers) {
      return NextResponse.json({ success: false, error: 'Max users limit reached' }, { status: 403 })
    }

    const sessionToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'dayless-ai-secret-change-in-production',
    })

    let userId = sessionToken?.id ? String(sessionToken.id) : null
    let userEmail = sessionToken?.email ? String(sessionToken.email).toLowerCase() : null

    if (!userId) {
      const name = parsed.data.name
      const password = parsed.data.password
      if (!name || !password) {
        return NextResponse.json(
          { success: false, error: 'Name and password are required when unauthenticated' },
          { status: 400 }
        )
      }

      let user = await db.user.findUnique({
        where: { email: invitation.email.toLowerCase() },
      })
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 12)
        user = await db.user.create({
          data: {
            email: invitation.email.toLowerCase(),
            name,
            password: hashedPassword,
          },
        })
      }
      userId = user.id
      userEmail = user.email.toLowerCase()
    }

    if (userEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Logged user does not match invitation email' },
        { status: 403 }
      )
    }

    const [orgMember] = await Promise.all([
      db.orgMember.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invitation.organizationId,
          },
        },
        update: {},
        create: {
          userId,
          organizationId: invitation.organizationId,
          role: 'member',
        },
      }),
      db.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ])

    const existingTeamMember = await db.teamMember.findFirst({
      where: { teamId: invitation.teamId, userId },
      select: { id: true },
    })
    if (!existingTeamMember) {
      await db.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          orgMemberId: orgMember.id,
          teamRole: invitation.teamRole,
          jobTitle: invitation.jobTitle,
          name: parsed.data.name || invitation.email.split('@')[0],
          role: invitation.teamRole === 'lead' ? 'Lead' : 'Developer',
          email: invitation.email,
          status: 'active',
        },
      })
    }

    const inviterMembership = await db.teamMember.findFirst({
      where: { orgMemberId: invitation.invitedById, teamId: invitation.teamId },
      select: { id: true, teamId: true },
    })
    if (inviterMembership) {
      await createNotification({
        memberId: inviterMembership.id,
        teamId: inviterMembership.teamId,
        type: 'invitation_accepted',
        title: `${invitation.email} accepted the invitation`,
        metadata: { invitationId: invitation.id, organizationId: org.id },
      })
    }

    return NextResponse.json({ success: true, data: { accepted: true, organizationId: org.id } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Accept failed' },
      { status: 500 }
    )
  }
}
