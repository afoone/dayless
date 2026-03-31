import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const workflows = await db.$queryRawUnsafe(
      'SELECT id, "projectId", name, position, color, "isDone", "isQa", "createdAt", "updatedAt" FROM "TicketWorkflow" WHERE "projectId" = ? ORDER BY position ASC',
      projectId
    )
    return NextResponse.json({ success: true, data: workflows })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, workflows } = body as { projectId?: string; workflows?: Array<any> }

    if (!projectId || !Array.isArray(workflows)) {
      return NextResponse.json({ success: false, error: 'projectId and workflows are required' }, { status: 400 })
    }

    const projectRows = await db.$queryRawUnsafe(
      'SELECT id FROM "Project" WHERE id = ? LIMIT 1',
      projectId
    ) as Array<{ id: string }>
    const project = projectRows[0]
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    for (let i = 0; i < workflows.length; i++) {
      const w = workflows[i]
      const id = w.id || ('twf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
      const name = String(w.name || '').trim() || `Estado ${i + 1}`
      const position = typeof w.position === 'number' ? w.position : i
      const color = w.color || '#10b981'
      const isDone = Boolean(w.isDone) ? 1 : 0
      const isQa = Boolean(w.isQa) ? 1 : 0
      const nowIso = new Date().toISOString()

      const existing = await db.$queryRawUnsafe(
        'SELECT id FROM "TicketWorkflow" WHERE id = ? AND "projectId" = ? LIMIT 1',
        id,
        projectId
      ) as Array<{ id: string }>

      if (existing.length > 0) {
        await db.$executeRawUnsafe(
          'UPDATE "TicketWorkflow" SET name = ?, position = ?, color = ?, "isDone" = ?, "isQa" = ?, "updatedAt" = ? WHERE id = ? AND "projectId" = ?',
          name,
          position,
          color,
          isDone,
          isQa,
          nowIso,
          id,
          projectId
        )
      } else {
        await db.$executeRawUnsafe(
          'INSERT INTO "TicketWorkflow" (id, "projectId", name, position, color, "isDone", "isQa", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          id,
          projectId,
          name,
          position,
          color,
          isDone,
          isQa,
          nowIso,
          nowIso
        )
      }
    }

    const saved = await db.$queryRawUnsafe(
      'SELECT id, "projectId", name, position, color, "isDone", "isQa", "createdAt", "updatedAt" FROM "TicketWorkflow" WHERE "projectId" = ? ORDER BY position ASC',
      projectId
    )
    return NextResponse.json({ success: true, data: saved })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
