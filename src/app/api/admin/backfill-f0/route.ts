import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_BACKFILL_KEY

    if (!expectedKey || authHeader !== expectedKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const users = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    })

    let defaultOrg = await db.organization.findFirst({
      where: { slug: 'default-org' },
      select: { id: true },
    })

    if (!defaultOrg) {
      defaultOrg = await db.organization.create({
        data: {
          name: 'Default Org',
          slug: 'default-org',
          plan: 'free',
          maxUsers: 25,
        },
        select: { id: true },
      })
    }

    const teamsWithoutOrg = await db.team.findMany({
      where: { organizationId: null },
      select: { id: true },
    })

    if (teamsWithoutOrg.length > 0) {
      await db.team.updateMany({
        where: { organizationId: null },
        data: { organizationId: defaultOrg.id },
      })
    }

    let createdOrgMembers = 0
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      const existing = await db.orgMember.findFirst({
        where: { userId: user.id, organizationId: defaultOrg.id },
        select: { id: true },
      })
      if (!existing) {
        await db.orgMember.create({
          data: {
            userId: user.id,
            organizationId: defaultOrg.id,
            role: i === 0 ? 'owner' : 'member',
          },
        })
        createdOrgMembers++
      }
    }

    // Ensure every TeamMember with userId has orgMemberId and a normalized teamRole.
    const teamMembers = await db.teamMember.findMany({
      where: { userId: { not: null } },
      select: { id: true, userId: true, role: true, teamRole: true, orgMemberId: true },
    })

    let updatedTeamMembers = 0
    for (const member of teamMembers) {
      const orgMember = await db.orgMember.findFirst({
        where: { userId: member.userId ?? undefined, organizationId: defaultOrg.id },
        select: { id: true },
      })
      if (!orgMember) continue

      const normalizedRole =
        member.role.toLowerCase().includes('lead') || member.role.toLowerCase().includes('manager')
          ? 'lead'
          : member.teamRole || 'member'

      await db.teamMember.update({
        where: { id: member.id },
        data: {
          orgMemberId: member.orgMemberId ?? orgMember.id,
          teamRole: normalizedRole,
          jobTitle: member.role,
        },
      })
      updatedTeamMembers++
    }

    // Create org per team if desired by name to avoid single-org deployments.
    // Kept idempotent and disabled by default for F0; can be enabled by request body.
    const body = await request.json().catch(() => ({} as { splitOrgsByTeam?: boolean }))
    if (body?.splitOrgsByTeam) {
      const teams = await db.team.findMany({
        select: { id: true, name: true, organizationId: true },
      })
      for (const team of teams) {
        if (team.organizationId && team.organizationId !== defaultOrg.id) continue
        const teamSlug = `${slugify(team.name)}-org`.slice(0, 40) || `org-${team.id.slice(0, 6)}`
        const existing = await db.organization.findFirst({ where: { slug: teamSlug }, select: { id: true } })
        const org =
          existing ??
          (await db.organization.create({
            data: { name: `${team.name} Org`, slug: teamSlug, plan: 'free', maxUsers: 25 },
            select: { id: true },
          }))
        await db.team.update({ where: { id: team.id }, data: { organizationId: org.id } })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        defaultOrganizationId: defaultOrg.id,
        usersCount: users.length,
        teamsAssignedToOrg: teamsWithoutOrg.length,
        createdOrgMembers,
        updatedTeamMembers,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
