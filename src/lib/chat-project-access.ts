import { db } from '@/lib/db'

export type ChatProjectAccess =
  | { ok: true; projectId: string; projectName: string }
  | { ok: false; error: string }

/** Proyecto del equipo al que el miembro tiene acceso (asignación o proyecto por defecto). */
export async function assertMemberChatProjectAccess(
  teamId: string,
  ownerMemberId: string,
  projectId: string
): Promise<ChatProjectAccess> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT p.id, p.name FROM "Project" p
     WHERE p.id = ? AND p."teamId" = ?
     AND (
       EXISTS (SELECT 1 FROM "ProjectAssignment" pa WHERE pa."projectId" = p.id AND pa."memberId" = ?)
       OR EXISTS (SELECT 1 FROM "TeamMember" tm WHERE tm.id = ? AND tm."defaultProjectId" = p.id)
     )
     LIMIT 1`,
    projectId,
    teamId,
    ownerMemberId,
    ownerMemberId
  )) as Array<{ id: string; name: string }>

  if (!rows[0]) {
    return { ok: false, error: 'Proyecto no encontrado o sin acceso para este miembro' }
  }
  return { ok: true, projectId: rows[0].id, projectName: rows[0].name }
}
