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
    const [defaultProjectRows, assignedProjects] = await Promise.all([
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
    ])

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
        defaultProject: (defaultProjectRows as any[])[0] || null,
        projects: assignedProjects,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
