import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

/** POST: notifica standup en el hilo de chat (IA) de cada miembro del equipo que posee el proyecto. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId || '')
    const initiatorMemberId = String(body.initiatorMemberId || '')
    if (!projectId || !initiatorMemberId) {
      return NextResponse.json(
        { success: false, error: 'projectId y initiatorMemberId son obligatorios' },
        { status: 400 }
      )
    }

    const project = await withPrisma((db) =>
      db.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, teamId: true },
      })
    )
    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const initiator = await withPrisma((db) =>
      db.teamMember.findUnique({ where: { id: initiatorMemberId }, include: { team: true } })
    )
    if (!initiator) {
      return NextResponse.json({ success: false, error: 'Miembro no encontrado' }, { status: 404 })
    }
    if (initiator.teamId !== project.teamId) {
      return NextResponse.json(
        { success: false, error: 'El proyecto no pertenece al equipo de este miembro' },
        { status: 403 }
      )
    }

    // Todo el equipo del mismo team que el proyecto (no solo ProjectAssignment):
    // si no, miembros como Ana sin fila en ProjectAssignment nunca recibían el aviso.
    const allTeam = await withPrisma((db) =>
      db.teamMember.findMany({ where: { teamId: project.teamId }, select: { id: true } })
    )
    const memberIds = allTeam.map((m) => m.id)

    const dateKey = new Date().toISOString().slice(0, 10)
    const content = `📣 **Standup del proyecto «${project.name}»**

**${initiator.name}** pide el check-in del equipo para hoy (${dateKey}).

Por favor comparte:
- ¿Qué hiciste ayer?
- ¿Qué harás hoy?
- ¿Bloqueos?

Puedes usar **/standup** en este chat para abrir el formulario, o responder aquí en un mensaje.`
    const metadata = JSON.stringify({
      type: 'standup_broadcast',
      projectId,
      initiatorMemberId,
      date: dateKey,
    })

    let notified = 0
    for (const ownerMemberId of memberIds) {
      await withPrisma((db) =>
        db.message.create({
          data: {
            team: { connect: { id: project.teamId } },
            owner: { connect: { id: ownerMemberId } },
            project: { connect: { id: projectId } },
            senderId: null,
            senderName: 'Dayless',
            senderType: 'system',
            content,
            metadata,
          },
        })
      )
      notified++
    }

    return NextResponse.json({ success: true, data: { notified, memberIds } })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
