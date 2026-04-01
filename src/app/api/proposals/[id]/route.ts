import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { resolveAuthContext, requireTeamAccess } from '@/lib/auth-context'

const updateProposalSchema = z.object({
  title: z.string().min(4).optional(),
  description: z.string().min(8).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 })
    }

    const proposal = await db.ticketProposal.findUnique({ where: { id } })
    if (!proposal) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 })

    const ctx = await resolveAuthContext(request, { teamId: proposal.teamId })
    requireTeamAccess(ctx, proposal.teamId)
    const isLead = ctx.currentTeamMember?.teamRole === 'lead'
    if (!isLead && ctx.currentTeamMember?.id !== proposal.proposerMemberId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const updated = await db.ticketProposal.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        acceptanceCriteria: parsed.data.acceptanceCriteria
          ? JSON.stringify(parsed.data.acceptanceCriteria)
          : undefined,
        priority: parsed.data.priority,
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
