import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { resolveAuthContext, requireOrgRole } from '@/lib/auth-context'

const createInvitationSchema = z.object({
  teamId: z.string().min(1),
  email: z.string().email(),
  teamRole: z.enum(['lead', 'member']).default('member'),
  jobTitle: z.string().max(120).optional(),
})

function toApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    requireOrgRole(ctx, 'admin')

    const status = request.nextUrl.searchParams.get('status')
    const invitations = await db.invitation.findMany({
      where: {
        organizationId: ctx.organization.id,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: invitations })
  } catch (error) {
    return toApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    requireOrgRole(ctx, 'admin')

    const body = await request.json()
    const parsed = createInvitationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }

    const { teamId, email, teamRole, jobTitle } = parsed.data
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { id: true, organizationId: true, name: true },
    })
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }
    if (!team.organizationId || team.organizationId !== ctx.organization.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const activeMembers = await db.orgMember.count({
      where: { organizationId: ctx.organization.id },
    })
    if (activeMembers >= ctx.organization.maxUsers) {
      return NextResponse.json({ success: false, error: 'Max users limit reached' }, { status: 403 })
    }

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    })
    if (existingUser) {
      const existingOrgMember = await db.orgMember.findFirst({
        where: {
          userId: existingUser.id,
          organizationId: ctx.organization.id,
        },
        select: { id: true },
      })
      if (existingOrgMember) {
        return NextResponse.json(
          { success: false, error: 'User already belongs to this organization' },
          { status: 409 }
        )
      }
    }

    const pending = await db.invitation.findFirst({
      where: {
        organizationId: ctx.organization.id,
        teamId,
        email: email.toLowerCase(),
        status: 'pending',
      },
      select: { id: true, token: true, expiresAt: true },
    })
    if (pending && pending.expiresAt > new Date()) {
      return NextResponse.json({
        success: true,
        data: {
          id: pending.id,
          token: pending.token,
          inviteUrl: `/invite/${pending.token}`,
          reused: true,
        },
      })
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invitation = await db.invitation.create({
      data: {
        organizationId: ctx.organization.id,
        teamId,
        email: email.toLowerCase(),
        teamRole,
        jobTitle,
        token,
        invitedById: ctx.orgMember.id,
        status: 'pending',
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...invitation,
        inviteUrl: `/invite/${token}`,
      },
    })
  } catch (error) {
    return toApiError(error)
  }
}
