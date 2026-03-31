import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ticket = await withPrisma(async (db) =>
      db.ticket.findUnique({
        where: { id },
        include: {
          status: true,
          targetTeam: true,
          assignee: true,
          reporter: true,
          project: { select: { id: true, name: true } },
          transitions: {
            include: { fromStatus: true, toStatus: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })
    )
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await withPrisma(async (db) => db.ticket.findUnique({ where: { id } }))
    if (!existing) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const nextStatusId = body.statusId || existing.statusId
    const nextOrder = typeof body.order === 'number' ? body.order : existing.order

    const ticket = await withPrisma(async (db) => {
      const updated = await db.ticket.update({
        where: { id },
        data: {
          title: body.title ?? existing.title,
          description: body.description ?? existing.description,
          priority: body.priority ?? existing.priority,
          estimate: body.estimate ?? existing.estimate,
          progress: body.progress ?? existing.progress,
          order: nextOrder,
          statusId: nextStatusId,
          targetTeamId: body.targetTeamId ?? existing.targetTeamId,
          assigneeMemberId: body.assigneeMemberId ?? existing.assigneeMemberId,
          reporterMemberId: body.reporterMemberId ?? existing.reporterMemberId,
          externalRefs: body.externalRefs ? JSON.stringify(body.externalRefs) : existing.externalRefs,
          metadata: body.metadata ? JSON.stringify(body.metadata) : existing.metadata,
        },
        include: {
          status: true,
          targetTeam: true,
          assignee: true,
          reporter: true,
          project: { select: { id: true, name: true } },
        },
      })

      if (existing.statusId !== nextStatusId) {
        await db.ticketTransition.create({
          data: {
            ticketId: id,
            fromStatusId: existing.statusId,
            toStatusId: nextStatusId,
            reason: body.transitionReason || 'Cambio de estado',
            actorType: body.actorType || 'user',
            actorName: body.actorName || null,
          },
        })
      }
      return updated
    })

    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await withPrisma(async (db) => db.ticket.delete({ where: { id } }))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
