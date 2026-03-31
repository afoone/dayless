import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ticket = await withPrisma(async (db) => db.ticket.findUnique({ where: { id }, select: { id: true, externalRefs: true } }))
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      data: ticket.externalRefs ? JSON.parse(ticket.externalRefs) : { github: [], jira: [] },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const refs = body.externalRefs
    const updated = await withPrisma(async (db) =>
      db.ticket.update({
        where: { id },
        data: {
          externalRefs: refs ? JSON.stringify(refs) : null,
        },
        select: { id: true, externalRefs: true },
      })
    )

    return NextResponse.json({
      success: true,
      data: updated.externalRefs ? JSON.parse(updated.externalRefs) : { github: [], jira: [] },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
