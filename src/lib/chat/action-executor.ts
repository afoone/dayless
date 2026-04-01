import { db } from '@/lib/db'
import type { ChatPendingAction } from '@/lib/chat/types'
import { createNotification } from '@/lib/notifications'
import { getTicketSourceAdapter } from '@/lib/ticket-source'
import { upsertTicketCacheFromExternal } from '@/lib/ticket-cache'

type ExecuteInput = {
  teamId: string
  ownerMemberId: string
  projectId: string
  senderName: string
  action: ChatPendingAction
}

export async function executeConfirmedChatAction(input: ExecuteInput): Promise<string> {
  const { teamId, ownerMemberId, projectId, senderName, action } = input

  if (action.type === 'knowledge_entry') {
    const key = String(action.payload.key || '').trim()
    const value = String(action.payload.value || '').trim()
    const category = String(action.payload.category || 'decision')
    await db.knowledgeEntry.create({
      data: {
        teamId,
        key,
        value,
        source: senderName,
        category,
        confidence: 80,
      },
    })
    return `✅ Conocimiento guardado: **${key}**`
  }

  if (action.type === 'standup_checkin') {
    const today = new Date().toISOString().slice(0, 10)
    await db.standupCheckin.upsert({
      where: { memberId_date: { memberId: ownerMemberId, date: today } },
      update: {
        yesterdayWork: String(action.payload.yesterdayWork || '') || null,
        todayPlan: String(action.payload.todayPlan || '') || null,
        blockers: String(action.payload.blockers || '') || null,
        mood: String(action.payload.mood || 'neutral'),
      },
      create: {
        memberId: ownerMemberId,
        date: today,
        yesterdayWork: String(action.payload.yesterdayWork || '') || null,
        todayPlan: String(action.payload.todayPlan || '') || null,
        blockers: String(action.payload.blockers || '') || null,
        mood: String(action.payload.mood || 'neutral'),
      },
    })
    return '✅ Standup guardado'
  }

  if (action.type === 'ticket_update') {
    const ticketKey = String(action.payload.ticketKey || '').trim()
    const adapter = await getTicketSourceAdapter(projectId)
    const updated = await adapter.updateTicket(projectId, ticketKey, {
      description: String(action.payload.description || '') || undefined,
      estimate: String(action.payload.estimate || '') || undefined,
      status: String(action.payload.status || '') || undefined,
      priority: String(action.payload.priority || '') || undefined,
    })
    if (!updated) return `❌ Ticket no encontrado: ${ticketKey}`
    await upsertTicketCacheFromExternal(projectId, teamId, adapter.type, updated)
    await db.integrationLog.create({
      data: {
        teamId,
        type: adapter.type,
        action: 'ticket_updated',
        externalId: ticketKey,
        status: 'success',
      },
    })
    return `✅ Ticket actualizado: ${ticketKey}`
  }

  if (action.type === 'ticket_proposal') {
    const title = String(action.payload.title || '').trim() || 'Sin título'
    const description = String(action.payload.description || '').trim() || 'Sin descripción'
    const acceptanceCriteria = Array.isArray(action.payload.acceptanceCriteria)
      ? (action.payload.acceptanceCriteria as unknown[]).map((x) => String(x))
      : []
    const proposal = await db.ticketProposal.create({
      data: {
        teamId,
        projectId,
        proposerMemberId: ownerMemberId,
        title,
        description,
        acceptanceCriteria: JSON.stringify(acceptanceCriteria),
        priority: String(action.payload.priority || 'medium'),
        origin: String(action.payload.origin || 'chat'),
        status: 'pending_review',
      },
    })
    const leads = await db.teamMember.findMany({
      where: { teamId, teamRole: 'lead' },
      select: { id: true },
    })
    await Promise.all(
      leads.map((lead) =>
        createNotification({
          memberId: lead.id,
          teamId,
          type: 'proposal_pending_review',
          title: `Nueva propuesta: ${title}`,
          body: `${senderName} ha enviado una propuesta para revisión.`,
          metadata: { projectId, actionId: action.id, proposalId: proposal.id },
        })
      )
    )
    return '✅ Propuesta registrada para revisión'
  }

  return '❌ Acción no soportada'
}
