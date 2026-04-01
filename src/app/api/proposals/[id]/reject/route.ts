import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { resolveAuthContext, requireTeamRole } from '@/lib/auth-context'
import { createNotification } from '@/lib/notifications'

const rejectSchema = z.object({
  reason: z.string().min(3),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 })
    }

    const proposal = await db.ticketProposal.findUnique({ where: { id } })
    if (!proposal) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 })
    const ctx = await resolveAuthContext(request, { teamId: proposal.teamId })
    requireTeamRole(ctx, proposal.teamId, 'lead')

    const reviewedByMemberId = ctx.currentTeamMember?.id || null
    const updated = await db.ticketProposal.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: parsed.data.reason,
        reviewedByMemberId: reviewedByMemberId || undefined,
        reviewedAt: new Date(),
      },
    })

    await createNotification({
      memberId: proposal.proposerMemberId,
      teamId: proposal.teamId,
      type: 'proposal_rejected',
      title: `Propuesta rechazada: ${proposal.title}`,
      metadata: { proposalId: proposal.id, reason: parsed.data.reason },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
