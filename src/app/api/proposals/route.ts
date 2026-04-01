import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { resolveAuthContext, requireTeamAccess } from '@/lib/auth-context'
import { createNotification } from '@/lib/notifications'

const createProposalSchema = z.object({
  teamId: z.string().min(1),
  projectId: z.string().min(1),
  proposerMemberId: z.string().min(1),
  title: z.string().min(4),
  description: z.string().min(8),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.string().optional(),
  origin: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    if (!teamId) return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 })
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const ctx = await resolveAuthContext(request, { teamId })
    requireTeamAccess(ctx, teamId)
    const isLead = ctx.currentTeamMember?.teamRole === 'lead'
    const rows = await db.ticketProposal.findMany({
      where: {
        teamId,
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(!isLead && ctx.currentTeamMember ? { proposerMemberId: ctx.currentTeamMember.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 })
    }
    const data = parsed.data
    const ctx = await resolveAuthContext(request, { teamId: data.teamId })
    requireTeamAccess(ctx, data.teamId)

    const proposal = await db.ticketProposal.create({
      data: {
        teamId: data.teamId,
        projectId: data.projectId,
        proposerMemberId: data.proposerMemberId,
        title: data.title,
        description: data.description,
        acceptanceCriteria: JSON.stringify(data.acceptanceCriteria || []),
        priority: data.priority || 'medium',
        origin: data.origin || 'chat',
        status: 'pending_review',
      },
    })

    const leads = await db.teamMember.findMany({
      where: { teamId: data.teamId, teamRole: 'lead' },
      select: { id: true },
    })
    await Promise.all(
      leads.map((lead) =>
        createNotification({
          memberId: lead.id,
          teamId: data.teamId,
          type: 'proposal_pending_review',
          title: `Nueva propuesta: ${data.title}`,
          body: 'Hay una propuesta pendiente de revisión en tu equipo.',
          metadata: { proposalId: proposal.id },
        })
      )
    )

    return NextResponse.json({ success: true, data: proposal })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
