import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const projectId = searchParams.get('projectId')

    const where: { teamId?: string; projectId?: string; targetTeamId?: string } = {}
    if (teamId) where.teamId = teamId
    if (projectId) where.projectId = projectId
    const targetTeamId = searchParams.get('targetTeamId')
    if (targetTeamId) where.targetTeamId = targetTeamId

    const tickets = await withPrisma(async (db) =>
      db.ticket.findMany({
        where,
        include: {
          status: true,
          targetTeam: true,
          assignee: true,
          reporter: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      })
    )
    return NextResponse.json({ success: true, data: tickets })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      teamId,
      targetTeamId,
      projectId,
      title,
      description,
      statusId,
      priority,
      estimate,
      progress,
      assigneeMemberId,
      reporterMemberId,
      createdByType: bodyCreatedByType,
      createdByName: bodyCreatedByName,
      externalRefs,
      metadata,
    } = body

    if (!teamId || !projectId || !title) {
      return NextResponse.json({ success: false, error: 'teamId, projectId and title are required' }, { status: 400 })
    }

    const project = await withPrisma(async (db) => db.project.findUnique({ where: { id: projectId } }))
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })

    const workflow = statusId
      ? await withPrisma(async (db) => db.ticketWorkflow.findUnique({ where: { id: statusId } }))
      : await withPrisma(async (db) => db.ticketWorkflow.findFirst({ where: { projectId }, orderBy: { position: 'asc' } }))

    if (!workflow) {
      return NextResponse.json({ success: false, error: 'No workflow found for this project. Create states first.' }, { status: 400 })
    }

    const lastTicket = await withPrisma(async (db) =>
      db.ticket.findFirst({
        where: { projectId, statusId: workflow.id },
        orderBy: { order: 'desc' },
      })
    )
    const nextOrder = (lastTicket?.order || 0) + 1

    const repId = reporterMemberId || null
    const createdByType =
      bodyCreatedByType === 'ai' || bodyCreatedByType === 'system' || bodyCreatedByType === 'member'
        ? bodyCreatedByType
        : repId
          ? 'member'
          : 'system'
    const createdByName =
      bodyCreatedByName !== undefined && bodyCreatedByName !== ''
        ? bodyCreatedByName
        : createdByType === 'ai'
          ? 'Dayless.ai'
          : createdByType === 'system' && !repId
            ? 'Sistema'
            : null

    const ticket = await withPrisma(async (db) => {
      const created = await db.ticket.create({
        data: {
          teamId,
          targetTeamId: targetTeamId || null,
          projectId,
          statusId: workflow.id,
          title,
          description: description || null,
          priority: priority || 'medium',
          estimate: estimate || null,
          progress: progress || null,
          order: nextOrder,
          assigneeMemberId: assigneeMemberId || null,
          reporterMemberId: repId,
          createdByType,
          createdByName,
          externalRefs: externalRefs ? JSON.stringify(externalRefs) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
        include: {
          status: true,
          targetTeam: true,
          assignee: true,
          reporter: true,
          project: { select: { id: true, name: true } },
        },
      })

      await db.ticketTransition.create({
        data: {
          ticketId: created.id,
          toStatusId: created.statusId,
          reason: 'Ticket creado',
          actorType: 'system',
          actorName: 'System',
        },
      })
      return created
    })

    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
