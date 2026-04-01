import { getCachedTicket, setRefinementState } from '@/lib/ticket-cache'

export type RefinementPhase = 'deteccion' | 'individual' | 'cruce' | 'consolidacion' | 'confirmacion'

export type RefinementSession = {
  phase: RefinementPhase
  iteration: number
  consultedMemberIds: string[]
  openQuestions: string[]
  acDraft: string[]
  updatedAt: string
}

export function defaultRefinementSession(): RefinementSession {
  return {
    phase: 'deteccion',
    iteration: 1,
    consultedMemberIds: [],
    openQuestions: [],
    acDraft: [],
    updatedAt: new Date().toISOString(),
  }
}

export async function getRefinementSession(projectId: string, ticketKey: string): Promise<RefinementSession | null> {
  const row = await getCachedTicket(projectId, ticketKey)
  if (!row?.metadata) return null
  try {
    const meta = JSON.parse(row.metadata) as { refinement?: RefinementSession }
    return meta.refinement || null
  } catch {
    return null
  }
}

export async function saveRefinementSession(projectId: string, ticketKey: string, session: RefinementSession) {
  return setRefinementState(projectId, ticketKey, {
    ...session,
    updatedAt: new Date().toISOString(),
  })
}
