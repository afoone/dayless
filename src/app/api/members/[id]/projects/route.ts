import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type MemberRow = {
  id: string
  name: string
  role: string
  email: string | null
  teamId: string
  defaultProjectId: string | null
  userId: string | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    let memberRows = (await db.$queryRawUnsafe(
      'SELECT id, name, role, email, "teamId", "defaultProjectId", "userId" FROM "TeamMember" WHERE id = ?',
      id
    )) as MemberRow[]

    if (!memberRows[0]) {
      memberRows = (await db.$queryRawUnsafe(
        'SELECT id, name, role, email, "teamId", "defaultProjectId", "userId" FROM "TeamMember" WHERE "userId" = ? ORDER BY "createdAt" ASC',
        id
      )) as MemberRow[]
    }

    const primary = memberRows[0]
    if (!primary) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const memberIds = [...new Set(memberRows.map((m) => m.id))]
    const defaultProjectId =
      memberRows.find((m) => m.defaultProjectId)?.defaultProjectId ?? primary.defaultProjectId

    const inList = memberIds.map(() => '?').join(', ')
    const [defaultProjectRows, assignedProjects, messageProjects] = await Promise.all([
      defaultProjectId
        ? db.$queryRawUnsafe(
            `SELECT p.id, p.name, p.description, p.status, p."teamId", p."githubRepo", p."jiraProjectKey", t.name AS "teamName"
             FROM "Project" p JOIN "Team" t ON t.id = p."teamId" WHERE p.id = ? LIMIT 1`,
            defaultProjectId
          )
        : Promise.resolve([]),
      db.$queryRawUnsafe(
        `SELECT DISTINCT p.id, p.name, p.description, p.status, p."teamId", p."githubRepo", p."jiraProjectKey", t.name AS "teamName"
         FROM "ProjectAssignment" pa
         JOIN "Project" p ON p.id = pa."projectId"
         JOIN "Team" t ON t.id = p."teamId"
         WHERE pa."memberId" IN (${inList})
         ORDER BY t.name ASC, p.name ASC`,
        ...memberIds
      ),
      db.$queryRawUnsafe(
        `SELECT DISTINCT p.id, p.name, p.description, p.status, p."teamId", p."githubRepo", p."jiraProjectKey", t.name AS "teamName"
         FROM "Message" m
         JOIN "Project" p ON p.id = m."projectId"
         JOIN "Team" t ON t.id = p."teamId"
         WHERE m."ownerMemberId" IN (${inList}) AND p."teamId" = ?
         ORDER BY t.name ASC, p.name ASC`,
        ...memberIds,
        primary.teamId
      ),
    ])

    type ProjRow = {
      id: string
      name: string
      description: string | null
      status: string
      teamId: string
      githubRepo: string | null
      jiraProjectKey: string | null
      teamName: string
    }
    const fromAssign = assignedProjects as unknown as ProjRow[]
    const fromMsgs = messageProjects as unknown as ProjRow[]
    const mergedMap = new Map<string, ProjRow>()
    for (const p of fromAssign) {
      mergedMap.set(p.id, p)
    }
    for (const p of fromMsgs) {
      if (!mergedMap.has(p.id)) {
        mergedMap.set(p.id, p)
      }
    }
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
      const c = (a.teamName || '').localeCompare(b.teamName || '')
      return c !== 0 ? c : a.name.localeCompare(b.name)
    })

    const member = {
      id: primary.id,
      name: primary.name,
      role: primary.role,
      email: primary.email,
      teamId: primary.teamId,
      defaultProjectId: primary.defaultProjectId,
    }

    return NextResponse.json({
      success: true,
      data: {
        member,
        defaultProject: (defaultProjectRows as ProjRow[])[0] || null,
        projects: mergedList,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
