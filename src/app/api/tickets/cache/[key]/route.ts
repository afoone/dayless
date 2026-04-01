import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCachedTicket, isCacheExpired, upsertTicketCacheFromExternal } from '@/lib/ticket-cache'
import { getTicketSourceAdapter } from '@/lib/ticket-source'

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })

    let row = await getCachedTicket(projectId, key)
    if (!row) {
      const adapter = await getTicketSourceAdapter(projectId)
      const project = await db.project.findUnique({ where: { id: projectId }, select: { teamId: true } })
      if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
      const external = await adapter.getTicket(projectId, key)
      if (!external) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      row = await upsertTicketCacheFromExternal(projectId, project.teamId, adapter.type, external)
    } else if (isCacheExpired(row.metadata)) {
      const adapter = await getTicketSourceAdapter(projectId)
      const external = await adapter.getTicket(projectId, key)
      if (external) {
        const project = await db.project.findUnique({ where: { id: projectId }, select: { teamId: true } })
        if (project) row = await upsertTicketCacheFromExternal(projectId, project.teamId, adapter.type, external)
      }
    }

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const body = (await request.json()) as {
      projectId?: string
      title?: string
      description?: string
      status?: string
      priority?: string
      estimate?: string
    }
    if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })

    const adapter = await getTicketSourceAdapter(body.projectId)
    const updated = await adapter.updateTicket(body.projectId, key, {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      estimate: body.estimate,
    })
    if (!updated) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { teamId: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    const cached = await upsertTicketCacheFromExternal(body.projectId, project.teamId, adapter.type, updated)
    await db.integrationLog.create({
      data: {
        teamId: project.teamId,
        type: adapter.type,
        action: 'ticket_updated',
        externalId: key,
        status: 'success',
        data: JSON.stringify({ projectId: body.projectId }),
      },
    })
    return NextResponse.json({ success: true, data: cached })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
