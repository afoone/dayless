import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const reports = await db.dailyReport.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { date: 'desc' },
      take: 30,
    })
    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, date } = body
    if (!teamId || !date) {
      return NextResponse.json({ success: false, error: 'teamId and date are required' }, { status: 400 })
    }

    // Gather data for report
    const [team, standups, messages, knowledge, projects] = await Promise.all([
      db.team.findUnique({ where: { id: teamId }, include: { members: true } }),
      db.standupCheckin.findMany({
        where: { date, member: { teamId } },
        include: { member: { select: { name: true, role: true } } },
      }),
      db.message.findMany({
        where: { teamId, createdAt: { gte: new Date(date) } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.knowledgeEntry.findMany({
        where: { teamId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      db.project.findMany({ where: { teamId } }),
    ])

    // Check if report already exists
    const existing = await db.dailyReport.findUnique({ where: { teamId_date: { teamId, date } } })
    if (existing) {
      return NextResponse.json({ success: true, data: existing })
    }

    const report = await db.dailyReport.create({
      data: {
        teamId,
        date,
        summary: `# Daily Report - ${date}\n\nTeam: ${team?.name || 'Unknown'}\n\n## Standups (${standups.length} submitted)\n${standups.map(s => `- **${s.member.name}**: ${s.todayPlan || 'No plan'}${s.blockers ? ` ⚠️ Blocker: ${s.blockers}` : ''}`).join('\n')}\n\n## Knowledge (${knowledge.length} entries)\n${knowledge.slice(0, 5).map(k => `- ${k.key}: ${k.value.slice(0, 100)}`).join('\n')}\n\n## Projects\n${projects.map(p => `- **${p.name}** (${p.status})`).join('\n')}`,
        status: 'published',
      },
    })
    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
