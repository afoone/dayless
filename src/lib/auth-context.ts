import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { db } from '@/lib/db'
import type { OrgMember, TeamMember, User, Organization } from '@prisma/client'

export type AuthContext = {
  user: User
  orgMember: OrgMember
  organization: Organization
  teamMemberships: TeamMember[]
  currentTeamMember?: TeamMember
}

type ResolveOptions = {
  teamId?: string | null
}

export async function resolveAuthContext(
  request: NextRequest,
  options: ResolveOptions = {}
): Promise<AuthContext> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'dayless-ai-secret-change-in-production',
  })

  const userId = token?.id ? String(token.id) : null
  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }

  const orgMember = await db.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!orgMember) {
    throw new Error('FORBIDDEN')
  }

  const organization = await db.organization.findUnique({
    where: { id: orgMember.organizationId },
  })
  if (!organization) {
    throw new Error('FORBIDDEN')
  }

  const teamMemberships = await db.teamMember.findMany({
    where: { orgMemberId: orgMember.id },
    orderBy: { createdAt: 'asc' },
  })

  const resolvedTeamId = options.teamId ?? request.nextUrl.searchParams.get('teamId')
  let currentTeamMember: TeamMember | undefined

  if (resolvedTeamId) {
    currentTeamMember = teamMemberships.find((m) => m.teamId === resolvedTeamId)
    if (!currentTeamMember) {
      throw new Error('FORBIDDEN')
    }
  }

  return {
    user,
    orgMember,
    organization,
    teamMemberships,
    currentTeamMember,
  }
}

export function requireOrgRole(ctx: AuthContext, role: 'owner' | 'admin'): void {
  const roles = role === 'owner' ? ['owner'] : ['owner', 'admin']
  if (!roles.includes(ctx.orgMember.role)) {
    throw new Error('FORBIDDEN')
  }
}

export function requireTeamAccess(ctx: AuthContext, teamId: string): void {
  const hasAccess = ctx.teamMemberships.some((m) => m.teamId === teamId)
  if (!hasAccess) {
    throw new Error('FORBIDDEN')
  }
}

export function requireTeamRole(ctx: AuthContext, teamId: string, role: 'lead'): void {
  const membership = ctx.teamMemberships.find((m) => m.teamId === teamId)
  if (!membership) {
    throw new Error('FORBIDDEN')
  }
  if (role === 'lead' && membership.teamRole !== 'lead') {
    throw new Error('FORBIDDEN')
  }
}
