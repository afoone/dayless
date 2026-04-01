import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveAuthContext, requireTeamRole } from '@/lib/auth-context'
import { getTicketSourceAdapter } from '@/lib/ticket-source'
import { markImportedManualTicket } from '@/lib/ticket-cache'
import { createNotification } from '@/lib/notifications'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const proposal = await db.ticketProposal.findUnique({ where: { id } })
    if (!proposal) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 })

    const ctx = await resolveAuthContext(request, { teamId: proposal.teamId })
    requireTeamRole(ctx, proposal.teamId, 'lead')

    const adapter = await getTicketSourceAdapter(proposal.projectId)
    let externalKey: string | null = null
    if (adapter.type === 'manual') {
      const cached = await markImportedManualTicket(proposal.projectId, proposal.teamId, {
        key: `PROP-${proposal.id.slice(0, 8)}`,
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority,
      })
      externalKey = cached ? `CACHE-${cached.id}` : null
    } else {
      // For existing adapters in this codebase, create flow is handled in tracker-specific services.
      // Keep a deterministic key marker so UI and notifications can show approval outcome.
      externalKey = `${adapter.type.toUpperCase()}-PENDING`
    }

    const reviewedByMemberId = ctx.currentTeamMember?.id || null
    const updated = await db.ticketProposal.update({
      where: { id },
      data: {
        status: 'approved',
        externalKey,
        reviewedByMemberId: reviewedByMemberId || undefined,
        reviewedAt: new Date(),
      },
    })

    await db.integrationLog.create({
      data: {
        teamId: proposal.teamId,
        type: adapter.type,
        action: 'proposal_approved',
        externalId: externalKey,
        status: 'success',
        data: JSON.stringify({ proposalId: proposal.id }),
      },
    })

    await createNotification({
      memberId: proposal.proposerMemberId,
      teamId: proposal.teamId,
      type: 'proposal_approved',
      title: `Propuesta aprobada: ${proposal.title}`,
      metadata: { proposalId: proposal.id, externalKey },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
