import { db } from '@/lib/db'

function parseAcceptanceCriteria(metadata: string | null): string[] {
  if (!metadata) return []
  try {
    const parsed = JSON.parse(metadata) as { acceptanceCriteria?: string[] }
    return Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : []
  } catch {
    return []
  }
}

export async function getUnrefinedTickets(projectId: string, assigneeMemberId?: string) {
  const rows = await db.ticket.findMany({
    where: {
      projectId,
      ...(assigneeMemberId ? { assigneeMemberId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return rows.filter((t) => {
    const ac = parseAcceptanceCriteria(t.metadata)
    const noAc = ac.length === 0
    const noEstimate = !t.estimate || t.estimate.trim().length === 0
    return noAc || noEstimate
  })
}
