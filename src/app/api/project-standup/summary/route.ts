import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** GET: resumen del standup del día para miembros asociados al proyecto (check-ins guardados). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const requesterMemberId = searchParams.get('requesterMemberId')
    const date = searchParams.get('date') || todayYmd()
    if (!projectId || !requesterMemberId) {
      return NextResponse.json(
        { success: false, error: 'projectId y requesterMemberId requeridos' },
        { status: 400 }
      )
    }

    const member = await withPrisma((db) => db.teamMember.findUnique({ where: { id: requesterMemberId } }))
    if (!member) {
      return NextResponse.json({ success: false, error: 'Miembro no encontrado' }, { status: 404 })
    }

    const project = await withPrisma((db) =>
      db.project.findUnique({ where: { id: projectId }, select: { name: true, teamId: true } })
    )
    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyecto no encontrado' }, { status: 404 })
    }
    if (member.teamId !== project.teamId) {
      return NextResponse.json(
        { success: false, error: 'El proyecto no pertenece al equipo de este miembro' },
        { status: 403 }
      )
    }

    const roster = await withPrisma((db) =>
      db.teamMember.findMany({ where: { teamId: project.teamId }, orderBy: { name: 'asc' } })
    )

    const memberIds = roster.map((m) => m.id)
    const standups = await withPrisma((db) =>
      db.standupCheckin.findMany({
        where: { memberId: { in: memberIds }, date },
        include: { member: true },
      })
    )
    const byMember = new Map(standups.map((s) => [s.memberId, s]))
    const lines: string[] = []
    lines.push(`## Standup ${date} — ${project.name}`, '')
    for (const m of roster) {
      const s = byMember.get(m.id)
      lines.push(`### ${m.name}`)
      if (s) {
        lines.push(`- Ayer: ${s.yesterdayWork || '—'}`)
        lines.push(`- Hoy: ${s.todayPlan || '—'}`)
        lines.push(`- Bloqueos: ${s.blockers || '—'}`)
        lines.push(`- Estado: ${s.mood}`)
      } else {
        lines.push('- *(Sin enviar todavía)*')
      }
      lines.push('')
    }

    return NextResponse.json({
      success: true,
      data: {
        date,
        projectName: project.name,
        markdown: lines.join('\n'),
        members: roster.map((m) => ({
          memberId: m.id,
          name: m.name,
          submitted: byMember.has(m.id),
          checkin: byMember.get(m.id) ?? null,
        })),
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
