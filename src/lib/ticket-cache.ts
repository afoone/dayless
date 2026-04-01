import { db } from '@/lib/db'
import type { ExternalTicket } from '@/lib/ticket-source'

type CacheMeta = {
  source: string
  ticketKey: string
  lastSyncedAt: string
  syncEnabled: boolean
  acceptanceCriteria?: string[]
  refinement?: {
    phase: string
    iteration: number
    consultedMemberIds: string[]
    openQuestions: string[]
    acDraft: string[]
    updatedAt: string
  }
}

function parseMeta(raw: string | null): CacheMeta | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as CacheMeta
  } catch {
    return null
  }
}

function asMetaString(meta: CacheMeta): string {
  return JSON.stringify(meta)
}

async function getDefaultStatusId(projectId: string): Promise<string | null> {
  const workflow = await db.ticketWorkflow.findFirst({
    where: { projectId },
    orderBy: { position: 'asc' },
    select: { id: true },
  })
  return workflow?.id || null
}

export async function upsertTicketCacheFromExternal(projectId: string, teamId: string, source: string, ticket: ExternalTicket) {
  const statusId = await getDefaultStatusId(projectId)
  if (!statusId) return null
  const existing = await db.ticket.findFirst({
    where: {
      projectId,
      OR: [{ metadata: { contains: `"ticketKey":"${ticket.key}"` } }, { id: ticket.key }],
    },
    select: { id: true, metadata: true },
  })

  const nextMeta: CacheMeta = {
    source,
    ticketKey: ticket.key,
    lastSyncedAt: new Date().toISOString(),
    syncEnabled: true,
    ...(parseMeta(existing?.metadata || null) || {}),
  }

  if (existing) {
    return db.ticket.update({
      where: { id: existing.id },
      data: {
        title: ticket.title,
        description: ticket.description || null,
        priority: ticket.priority || 'medium',
        estimate: ticket.estimate || null,
        progress: ticket.status || null,
        metadata: asMetaString(nextMeta),
      },
    })
  }

  const orderCount = await db.ticket.count({ where: { projectId, statusId } })
  return db.ticket.create({
    data: {
      teamId,
      projectId,
      statusId,
      title: ticket.title,
      description: ticket.description || null,
      priority: ticket.priority || 'medium',
      estimate: ticket.estimate || null,
      progress: ticket.status || null,
      order: orderCount + 1,
      createdByType: 'system',
      createdByName: `${source} sync`,
      metadata: asMetaString(nextMeta),
    },
  })
}

export async function getCachedTicket(projectId: string, key: string) {
  const row = await db.ticket.findFirst({
    where: {
      projectId,
      OR: [{ id: key }, { metadata: { contains: `"ticketKey":"${key}"` } }],
    },
  })
  return row
}

export function isCacheExpired(metadata: string | null): boolean {
  const meta = parseMeta(metadata)
  if (!meta) return true
  if (!meta.syncEnabled) return false
  const ts = Date.parse(meta.lastSyncedAt || '')
  if (Number.isNaN(ts)) return true
  return Date.now() - ts > 15 * 60 * 1000
}

export async function setRefinementState(projectId: string, key: string, refinement: CacheMeta['refinement']) {
  const row = await getCachedTicket(projectId, key)
  if (!row) return null
  const meta = parseMeta(row.metadata) || {
    source: 'manual',
    ticketKey: key,
    lastSyncedAt: new Date().toISOString(),
    syncEnabled: true,
  }
  const nextMeta: CacheMeta = { ...meta, refinement }
  return db.ticket.update({ where: { id: row.id }, data: { metadata: asMetaString(nextMeta) } })
}

export async function markImportedManualTicket(projectId: string, teamId: string, ticket: {
  key: string
  title: string
  description?: string
  priority?: string
  estimate?: string
}) {
  const created = await upsertTicketCacheFromExternal(projectId, teamId, 'manual_import', {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description || '',
    status: 'open',
    priority: ticket.priority || 'medium',
    estimate: ticket.estimate || null,
  })
  if (!created) return null
  const meta = parseMeta(created.metadata) || {
    source: 'manual_import',
    ticketKey: ticket.key,
    lastSyncedAt: new Date().toISOString(),
    syncEnabled: false,
  }
  meta.syncEnabled = false
  return db.ticket.update({
    where: { id: created.id },
    data: { metadata: asMetaString(meta) },
  })
}
