import { db } from '@/lib/db'

export async function buildCrossMemberContext(teamId: string, projectId: string, currentMemberId: string): Promise<string> {
  const members = await db.teamMember.findMany({
    where: { teamId, id: { not: currentMemberId } },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  })
  if (members.length === 0) return 'Sin contexto cross-member disponible.'

  const memberIds = members.map((m) => m.id)
  const [recentStandups, projectTickets, blockers, decisions] = await Promise.all([
    db.standupCheckin.findMany({
      where: {
        memberId: { in: memberIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.ticket.findMany({
      where: {
        projectId,
        assigneeMemberId: { in: memberIds },
      },
      select: { id: true, title: true, assigneeMemberId: true, updatedAt: true },
      take: 100,
    }),
    db.knowledgeEntry.findMany({
      where: { teamId, category: 'blocker' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    db.knowledgeEntry.findMany({
      where: { teamId, category: 'decision' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const standupByMember = new Map<string, (typeof recentStandups)[number]>()
  for (const s of recentStandups) {
    if (!standupByMember.has(s.memberId)) standupByMember.set(s.memberId, s)
  }

  const ticketByMember = new Map<string, Array<{ id: string; title: string; updatedAt: Date }>>()
  for (const t of projectTickets) {
    const id = t.assigneeMemberId
    if (!id) continue
    const list = ticketByMember.get(id) || []
    list.push({ id: t.id, title: t.title, updatedAt: t.updatedAt })
    ticketByMember.set(id, list)
  }

  const memberBlocks = members.map((m) => {
    const standup = standupByMember.get(m.id)
    const tickets = ticketByMember.get(m.id) || []
    const lines: string[] = [`- ${m.name} (${m.role})`]
    if (standup) {
      if (standup.yesterdayWork) lines.push(`  Ayer: ${standup.yesterdayWork}`)
      if (standup.todayPlan) lines.push(`  Hoy: ${standup.todayPlan}`)
      if (standup.blockers) lines.push(`  Blockers: ${standup.blockers}`)
    }
    if (tickets.length > 0) {
      lines.push(`  Tickets: ${tickets.slice(0, 3).map((t) => `${t.id} "${t.title}"`).join(', ')}`)
    }
    return lines.join('\n')
  })

  const blockerLines = blockers.map((b) => `- ${b.key}: ${b.value}`).join('\n') || '- Ninguno'
  const decisionLines = decisions.map((d) => `- ${d.key}: ${d.value}`).join('\n') || '- Ninguna'

  return [
    'CONTEXTO DE OTROS MIEMBROS (datos estructurados, sin chats privados):',
    memberBlocks.join('\n'),
    '',
    'BLOCKERS ACTIVOS:',
    blockerLines,
    '',
    'DECISIONES RECIENTES:',
    decisionLines,
  ].join('\n')
}
