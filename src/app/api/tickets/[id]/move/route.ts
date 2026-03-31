import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { statusId, order, reason, actorType, actorName } = body

    if (!statusId || typeof order !== 'number') {
      return NextResponse.json({ success: false, error: 'statusId and numeric order are required' }, { status: 400 })
    }

    const existing = await withPrisma(async (db) => db.ticket.findUnique({ where: { id } }))
    if (!existing) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const moved = await withPrisma(async (db) => {
      const updated = await db.ticket.update({
        where: { id },
        data: { statusId, order },
        include: {
          status: true,
          assignee: true,
          reporter: true,
        },
      })

      if (existing.statusId !== statusId) {
        await db.ticketTransition.create({
          data: {
            ticketId: id,
            fromStatusId: existing.statusId,
            toStatusId: statusId,
            reason: reason || 'Movimiento en tablero',
            actorType: actorType || 'user',
            actorName: actorName || null,
          },
        })
      }
      return updated
    })

    return NextResponse.json({ success: true, data: moved })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
