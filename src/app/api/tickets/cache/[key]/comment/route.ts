import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTicketSourceAdapter } from '@/lib/ticket-source'

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const body = (await request.json()) as { projectId?: string; comment?: string }
    if (!body.projectId || !body.comment?.trim()) {
      return NextResponse.json({ success: false, error: 'projectId and comment are required' }, { status: 400 })
    }
    const adapter = await getTicketSourceAdapter(body.projectId)
    const ok = await adapter.addComment(body.projectId, key, body.comment.trim())
    if (!ok) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const project = await db.project.findUnique({ where: { id: body.projectId }, select: { teamId: true } })
    if (project) {
      await db.integrationLog.create({
        data: {
          teamId: project.teamId,
          type: adapter.type,
          action: 'ticket_commented',
          externalId: key,
          status: 'success',
          data: JSON.stringify({ projectId: body.projectId }),
        },
      })
    }
    return NextResponse.json({ success: true, data: { key, commented: true } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
