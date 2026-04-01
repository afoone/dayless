import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTicketSourceAdapter } from '@/lib/ticket-source'
import { upsertTicketCacheFromExternal } from '@/lib/ticket-cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, teamId: true } })
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })

    const adapter = await getTicketSourceAdapter(projectId)
    const externalTickets = await adapter.listTickets(projectId)
    const synced: string[] = []
    for (const ticket of externalTickets) {
      const row = await upsertTicketCacheFromExternal(projectId, project.teamId, adapter.type, ticket)
      if (row) synced.push(row.id)
    }

    return NextResponse.json({
      success: true,
      data: { syncedCount: synced.length, source: adapter.type },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
