import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPrisma } from '@/lib/prisma-fresh'
import { assertMemberChatProjectAccess } from '@/lib/chat-project-access'
import { listIssues, formatIssuesSummaryForAI, buildConfigFromProject, createIssue, updateIssue, addIssueComment } from '@/lib/github'
import { searchIssues as jiraSearchIssues, formatIssuesSummaryForAI as jiraFormatSummary, buildConfigFromProject as jiraBuildConfig, createIssue as jiraCreateIssue, updateIssue as jiraUpdateIssue, addComment as jiraAddComment } from '@/lib/jira'

type TeamProjectRef = { id: string; name: string; teamId: string }

/** Dónde ver el ticket: la vista Tickets lista todo el equipo; Kanban filtra por proyecto. */
function ticketUiVisibilityHint(projectName: string): string {
  return ` *(En **Tickets** está en el listado global del equipo; en **Kanban** elige el proyecto «${projectName}» arriba.)*`
}
type RecentMsg = { senderType: string; content: string }

const TICKET_INTENT_RE =
  /(ticket|tarea\b|urgente|urgent|cr[ií]tic|desplieg|deploy|re-?deploy|hotfix|rollback|re-?desplieg|\bpre\b|preproducci|staging)/i

/** Comandos del input del chat (quick actions). No deben disparar fallbacks que meten todo el texto en un solo ticket. */
function messageStartsWithChatSlashCommand(text: string): boolean {
  const t = (text || '').trim()
  if (/^\/standup-equipo\b/i.test(t)) return true
  if (/^\/standup-resumen\b/i.test(t)) return true
  if (/^\/(standup|blocker|question|update)\b/i.test(t)) return true
  if (/^\/mis-tickets\b/i.test(t)) return true
  return false
}

/** Lista markdown de tickets asignados al miembro (chat /mis-tickets). */
function formatAssignedTicketsMarkdown(
  tickets: Array<{
    id: string
    title: string
    priority: string
    updatedAt: Date
    project?: { name: string } | null
    status?: { name: string; isDone: boolean } | null
  }>
): string {
  if (tickets.length === 0) return ''
  return tickets
    .map((t) => {
      const proj = t.project?.name || '—'
      const st = t.status?.name || '—'
      const done = t.status?.isDone ? ' ✓' : ''
      const upd = new Date(t.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      const safeTitle = t.title.replace(/\*\*/g, '')
      return `- **${safeTitle}** — \`${t.id}\` · ${proj} · ${st}${done} · ${t.priority} · ${upd}`
    })
    .join('\n')
}

/** Evita que el historial del LLM acumule `[Dayless.ai]:` al guardar/refetch mensajes ya prefijados. */
function normalizeMessageBodyForHistory(content: string, senderName: string): string {
  let c = (content || '').trim()
  const own = `[${senderName}]: `
  while (c.startsWith(own)) c = c.slice(own.length).trim()
  while (/^\[Dayless\.ai\]:\s*/i.test(c)) c = c.replace(/^\[Dayless\.ai\]:\s*/i, '').trim()
  return c
}

function isBadTicketTitleLine(line: string): boolean {
  const l = line.trim()
  if (l.length < 10) return true
  if (/^(?:crea|crear|creame|créame|haz(?:me|nos)?)\b/i.test(l) && /\b(?:ticket|tarea)\b/i.test(l)) return true
  if (/^(?:necesito|quiero|pod(?:rías|rias)?|puedes?)\b/i.test(l) && /\b(?:ticket|tarea)\b/i.test(l)) return true
  if (/^(?:payment|mobile|auth|mvp|sí|si|ok|vale|yes)\.?$/i.test(l)) return true
  return false
}

function synthesizeFallbackTitle(blob: string): string {
  if (/urgent|urgente|cr[ií]tic/i.test(blob) && /desplieg|deploy|\bpre\b|preprod|staging/i.test(blob)) {
    return 'Urgente: despliegue en preproducción'
  }
  const compact = blob.replace(/\s+/g, ' ').trim()
  const chunk = compact.match(/.{20,100}/)
  if (chunk && !isBadTicketTitleLine(chunk[0])) return chunk[0].trim().slice(0, 140)
  return (compact.slice(0, 120).trim() || 'Solicitud desde chat').slice(0, 140)
}

/** Pista de texto del usuario → proyecto (ej. "payment" → Payment Module Refactor). */
function findProjectByHint(blob: string, teamProjects: TeamProjectRef[]): TeamProjectRef | null {
  const lower = blob.toLowerCase().trim()
  if (!lower) return null
  let best: TeamProjectRef | null = null
  let bestScore = 0
  for (const p of teamProjects) {
    const n = p.name.toLowerCase()
    if (n.includes(lower) || lower.includes(n)) {
      return p
    }
    for (const w of n.split(/\s+/)) {
      if (w.length < 3) continue
      if (lower === w || lower.includes(w) || w.includes(lower)) {
        const score = w.length
        if (score > bestScore) {
          bestScore = score
          best = p
        }
      }
    }
  }
  return best
}

function userBlobFromDescendingMessages(recentDesc: RecentMsg[], maxTurns = 12): string {
  const lines = [...recentDesc]
    .reverse()
    .filter((m) => m.senderType !== 'ai' && m.senderType !== 'system')
    .map((m) => (m.content || '').trim())
    .filter(Boolean)
    .slice(-maxTurns)
  return lines.join('\n').trim()
}

/** Misma lógica que la vista Tickets: predeterminado del miembro, luego asignaciones; evita crear en otro proyecto del equipo. */
async function resolveProjectForMemberInternalTicket(
  teamId: string,
  senderId: string | null | undefined,
  explicitProject: string | undefined,
  teamProjects: TeamProjectRef[]
): Promise<TeamProjectRef | null> {
  if (explicitProject?.trim()) {
    const p = explicitProject.trim()
    const hit =
      teamProjects.find((x) => x.id === p) ||
      teamProjects.find((x) => x.name.toLowerCase() === p.toLowerCase()) ||
      findProjectByHint(p, teamProjects)
    if (hit) return hit
    return null
  }

  if (teamProjects.length === 0) return null

  const idsOrdered: string[] = []
  if (senderId) {
    const defRows = (await db.$queryRawUnsafe(
      'SELECT "defaultProjectId" FROM "TeamMember" WHERE id = ? AND "teamId" = ? LIMIT 1',
      senderId,
      teamId
    )) as Array<{ defaultProjectId: string | null }>
    if (defRows[0]?.defaultProjectId) idsOrdered.push(defRows[0].defaultProjectId)

    const assignRows = (await db.$queryRawUnsafe(
      'SELECT pa."projectId" FROM "ProjectAssignment" pa JOIN "Project" p ON p.id = pa."projectId" WHERE pa."memberId" = ? AND p."teamId" = ? ORDER BY pa."createdAt" ASC',
      senderId,
      teamId
    )) as Array<{ projectId: string }>
    for (const r of assignRows) {
      if (!idsOrdered.includes(r.projectId)) idsOrdered.push(r.projectId)
    }
  }

  const hasWorkflow = async (projectId: string) => {
    const w = (await db.$queryRawUnsafe(
      'SELECT id FROM "TicketWorkflow" WHERE "projectId" = ? ORDER BY position ASC LIMIT 1',
      projectId
    )) as Array<{ id: string }>
    return !!w[0]
  }

  for (const id of idsOrdered) {
    const proj = teamProjects.find((x) => x.id === id)
    if (proj && (await hasWorkflow(proj.id))) return proj
  }

  for (const proj of teamProjects) {
    if (await hasWorkflow(proj.id)) return proj
  }

  return teamProjects[0]
}

async function tryAppendLatestReporterTicket(
  teamId: string,
  projectId: string,
  senderId: string | null | undefined,
  latestContent: string
): Promise<string | null> {
  if (!senderId) return null
  const append = latestContent.trim()
  if (append.length < 2 || append.length > 1500) return null
  if (/(?:crea|crear|nuevo)\s+(?:ticket|tarea)/i.test(append)) return null
  if (TICKET_INTENT_RE.test(append) && append.length > 35) return null

  const rows = (await db.$queryRawUnsafe(
    `SELECT id, description FROM "Ticket" WHERE "teamId" = ? AND "projectId" = ? AND "reporterMemberId" = ? AND datetime("createdAt") > datetime('now', '-120 minutes') ORDER BY "createdAt" DESC LIMIT 1`,
    teamId,
    projectId,
    senderId
  )) as Array<{ id: string; description: string | null }>
  if (!rows[0]) return null

  const prev = rows[0].description || ''
  const add = append.startsWith('-') ? append : `- ${append}`
  const newDesc = prev ? `${prev}\n\n${add}` : add
  const nowIso = new Date().toISOString()
  await db.$executeRawUnsafe(
    'UPDATE "Ticket" SET description = ?, "updatedAt" = ? WHERE id = ?',
    newDesc,
    nowIso,
    rows[0].id
  )
  return `✅ Contexto añadido al ticket ${rows[0].id} (descripción actualizada).`
}

async function tryCreateTicketFromConversationIntent(
  _teamId: string,
  _senderId: string | null | undefined,
  _teamProjectRefs: TeamProjectRef[],
  _recentDesc: RecentMsg[],
  _chatProjectId: string
): Promise<string | null> {
  // Los tickets solo se crean tras confirmación explícita en el chat (botones).
  return null
}

type InternalTicketJsonPayload = {
  ready?: boolean
  awaiting_confirm?: boolean
  missing?: string[]
  project?: string
  title?: string
  description?: string
  priority?: string
  estimate?: string
  assignee_email?: string
  target_team?: string
}

type PendingInternalTicketPayload = {
  project?: string
  title: string
  description: string
  priority: string
  estimate?: string
  assigneeEmail?: string
  targetTeam?: string
}

function buildPendingFromJsonPayload(
  p: InternalTicketJsonPayload | null,
  defaultProjectName: string
): PendingInternalTicketPayload | null {
  if (!p || p.ready === false) return null
  if (!(p.awaiting_confirm === true || p.ready === true)) return null
  const title = (p.title || '').trim()
  const description = (p.description || '').trim()
  if (title.length < 8 || description.length < 30) return null
  const projectHint = (p.project || '').trim() || defaultProjectName
  return {
    project: projectHint,
    title,
    description,
    priority: normalizeChatPriority(p.priority),
    estimate: p.estimate?.trim() || undefined,
    assigneeEmail: p.assignee_email?.trim() || undefined,
    targetTeam: p.target_team?.trim() || undefined,
  }
}

/** Quita del texto el bloque ```json con internal_ticket (visible para el usuario). */
function extractInternalTicketJsonBlock(text: string): { cleaned: string; payload: InternalTicketJsonPayload | null } {
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  let payload: InternalTicketJsonPayload | null = null
  let cleaned = text
  let m: RegExpExecArray | null
  while ((m = fence.exec(text)) !== null) {
    const inner = m[1].trim()
    try {
      const j = JSON.parse(inner) as { internal_ticket?: InternalTicketJsonPayload }
      if (j?.internal_ticket && typeof j.internal_ticket === 'object') {
        payload = j.internal_ticket
        cleaned = cleaned.replace(m[0], '\n').replace(/\n{3,}/g, '\n\n').trim()
        break
      }
    } catch {
      /* ignore */
    }
  }
  if (payload) return { cleaned, payload }

  // Modelo sin fences o con fences rotos: buscar JSON con "internal_ticket" por balanceo de llaves
  const keyIdx = text.search(/"internal_ticket"\s*:/i)
  if (keyIdx < 0) return { cleaned, payload: null }
  const start = text.lastIndexOf('{', keyIdx)
  if (start < 0) return { cleaned, payload: null }
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        try {
          const j = JSON.parse(slice) as { internal_ticket?: InternalTicketJsonPayload }
          if (j?.internal_ticket && typeof j.internal_ticket === 'object') {
            const merged =
              text.slice(0, start).trimEnd() +
              (start > 0 && i + 1 < text.length ? '\n' : '') +
              text.slice(i + 1).trimStart()
            return {
              cleaned: merged.replace(/\n{3,}/g, '\n\n').trim(),
              payload: j.internal_ticket,
            }
          }
        } catch {
          return { cleaned, payload: null }
        }
        return { cleaned, payload: null }
      }
    }
  }
  return { cleaned, payload: null }
}

function actionResultsIndicateInternalTicketCreated(results: string[]): boolean {
  return results.some((r) => /✅ Ticket interno creado/i.test(r))
}

/**
 * El modelo está pidiendo datos antes de crear (sin crear aún). En ese caso los fallbacks del servidor no deben insertar ticket.
 */
function aiProseSuggestsAwaitingUserTicketDetails(prose: string): boolean {
  const t = (prose || '').toLowerCase()
  const q = (prose.match(/\?/g) || []).length
  const asksProject = /¿en qué proyecto|qué proyecto debería|en qué proyecto debería crearse/i.test(t)
  const asksPriority = /prioridad.*\?|¿cu[aá]l.*prioridad|prioridad de este/i.test(t)
  const asksMoreDetail =
    /más detalles|información adicional|datos adicionales|necesito (?:unos |más )?datos|para crearlo correctamente/i.test(
      t
    )
  const explicitLater = /una vez tengas/i.test(t) || /cuando tengas toda/i.test(t)
  if (explicitLater) return true
  if (q >= 2 && (asksProject || asksPriority || asksMoreDetail)) return true
  if (asksProject && (asksPriority || asksMoreDetail)) return true
  return false
}

function normalizeChatPriority(p?: string): string {
  const s = (p || 'medium').toLowerCase().trim()
  if (/\b(cr[ií]tic|critica)\b/i.test(p || '')) return 'critical'
  if (['low', 'medium', 'high', 'critical'].includes(s)) return s
  if (/\b(urgent|alta|high)\b/i.test(p || '')) return 'high'
  return 'medium'
}

type CreateTicketActor = { createdByType: string; createdByName: string }

/**
 * Una sola implementación de “crear ticket interno desde el chat”:
 * resolución de proyecto, workflow, validación título/descripción, reporter, transición.
 */
async function executeInternalTicketCreate(
  teamId: string,
  senderId: string | null,
  teamProjectRefs: TeamProjectRef[],
  params: {
    project?: string
    title: string
    description: string
    priority?: string
    estimate?: string
    assigneeEmail?: string
    targetTeam?: string
  },
  actor: CreateTicketActor
): Promise<
  { ok: true; ticketId: string; title: string; projectName: string } | { ok: false; message: string }
> {
  const finalProject = await resolveProjectForMemberInternalTicket(
    teamId,
    senderId,
    params.project,
    teamProjectRefs
  )
  if (!finalProject) {
    return {
      ok: false,
      message: params.project?.trim()
        ? `❌ Proyecto no encontrado: "${params.project.trim()}". Debe ser un proyecto de este equipo.`
        : '❌ No hay proyecto disponible para crear ticket interno',
    }
  }

  const workflowRows = (await db.$queryRawUnsafe(
    'SELECT id FROM "TicketWorkflow" WHERE "projectId" = ? ORDER BY position ASC LIMIT 1',
    finalProject.id
  )) as Array<{ id: string }>
  const workflow = workflowRows[0]
  if (!workflow) {
    return { ok: false, message: `❌ El proyecto "${finalProject.name}" no tiene estados configurados` }
  }

  const rawTitle = (params.title || '').trim()
  const rawDesc = (params.description || '').trim()
  const titleTooWeak =
    rawTitle.length < 8 ||
    /^ticket(\s+interno)?(\s+sin\s+t[ií]tulo)?$/i.test(rawTitle) ||
    /^nueva\s+tarea/i.test(rawTitle)
  const descTooWeak = rawDesc.length < 30
  if (titleTooWeak || descTooWeak) {
    return {
      ok: false,
      message:
        '⚠️ No se creó el ticket: **título** (≥8 caracteres claros) y **descripción** (≥30) obligatorios. Pide esos datos al usuario.',
    }
  }

  const assignee = params.assigneeEmail
    ? await db.teamMember.findFirst({
        where: { teamId: finalProject.teamId, email: params.assigneeEmail },
      })
    : null
  const targetTeamRows = params.targetTeam
    ? ((await db.$queryRawUnsafe(
        'SELECT id FROM "Team" WHERE lower(name) = lower(?) LIMIT 1',
        params.targetTeam
      )) as Array<{ id: string }>)
    : []
  const inferredQa = /(qa|test|testing|validaci[oó]n|regresi[oó]n)/i.test(`${rawTitle} ${rawDesc}`)
  const qaRows = inferredQa
    ? ((await db.$queryRawUnsafe(
        'SELECT id FROM "Team" WHERE lower(name) LIKE lower(?) LIMIT 1',
        '%qa%'
      )) as Array<{ id: string }>)
    : []
  const targetTeamId = targetTeamRows[0]?.id || qaRows[0]?.id || null

  const lastRows = (await db.$queryRawUnsafe(
    'SELECT "order" FROM "Ticket" WHERE "projectId" = ? AND "statusId" = ? ORDER BY "order" DESC LIMIT 1',
    finalProject.id,
    workflow.id
  )) as Array<{ order: number }>
  const ticketId = 'tkt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
  const nextOrder = (lastRows[0]?.order || 0) + 1
  const nowIso = new Date().toISOString()
  const pri = normalizeChatPriority(params.priority)

  await db.$executeRawUnsafe(
    'INSERT INTO "Ticket" (id, "teamId", "targetTeamId", "projectId", "statusId", title, description, priority, estimate, "order", "reporterMemberId", "assigneeMemberId", "createdByType", "createdByName", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ticketId,
    finalProject.teamId,
    targetTeamId,
    finalProject.id,
    workflow.id,
    rawTitle,
    rawDesc || null,
    pri,
    params.estimate || null,
    nextOrder,
    senderId || null,
    assignee?.id || null,
    actor.createdByType,
    actor.createdByName,
    nowIso,
    nowIso
  )
  await db.$executeRawUnsafe(
    'INSERT INTO "TicketTransition" (id, "ticketId", "toStatusId", reason, "actorType", "actorName", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
    'ttr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    ticketId,
    workflow.id,
    'Creado desde chat',
    actor.createdByType === 'ai' ? 'ai' : 'system',
    actor.createdByName,
    nowIso
  )
  return { ok: true, ticketId, title: rawTitle, projectName: finalProject.name }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const ownerMemberId = new URL(request.url).searchParams.get('ownerMemberId')
    if (!teamId || !ownerMemberId || !projectId) {
      return NextResponse.json(
        { success: false, error: 'teamId, ownerMemberId and projectId are required' },
        { status: 400 }
      )
    }

    const access = await assertMemberChatProjectAccess(teamId, ownerMemberId, projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }

    const [messages, total] = await withPrisma((p) =>
      Promise.all([
        p.message.findMany({
          where: { teamId, ownerMemberId, projectId },
          orderBy: { createdAt: 'asc' },
          take: limit,
          skip: offset,
        }),
        p.message.count({ where: { teamId, ownerMemberId, projectId } }),
      ])
    )

    return NextResponse.json({ success: true, data: messages, meta: { total, limit, offset } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (
      body.confirmInternalTicket &&
      typeof body.confirmInternalTicket === 'object' &&
      body.confirmInternalTicket !== null
    ) {
      const {
        teamId,
        ownerMemberId,
        projectId,
        senderId,
        senderName,
        confirmInternalTicket: draft,
      } = body as {
        teamId?: string
        ownerMemberId?: string
        projectId?: string
        senderId?: string | null
        senderName?: string
        confirmInternalTicket: PendingInternalTicketPayload
      }
      if (!teamId || !ownerMemberId || !projectId) {
        return NextResponse.json(
          { success: false, error: 'teamId, ownerMemberId y projectId son obligatorios' },
          { status: 400 }
        )
      }
      const access = await assertMemberChatProjectAccess(teamId, ownerMemberId, projectId)
      if (!access.ok) {
        return NextResponse.json({ success: false, error: access.error }, { status: 403 })
      }
      const title = (draft.title || '').trim()
      const description = (draft.description || '').trim()
      if (title.length < 8 || description.length < 30) {
        return NextResponse.json(
          { success: false, error: 'Título o descripción del borrador no válidos' },
          { status: 400 }
        )
      }
      const projects = await db.project.findMany({ where: { teamId } })
      const teamProjectRefsForChat: TeamProjectRef[] = projects.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
      }))
      const userMessage = await withPrisma((p) =>
        p.message.create({
          data: {
            team: { connect: { id: teamId } },
            owner: { connect: { id: ownerMemberId } },
            project: { connect: { id: projectId } },
            senderId: senderId || null,
            senderName: senderName || 'Usuario',
            senderType: 'member',
            content: 'Confirmo **crear el ticket** acordado con el asistente.',
          },
        })
      )
      const r = await executeInternalTicketCreate(
        teamId,
        senderId || null,
        teamProjectRefsForChat,
        {
          project: draft.project,
          title,
          description,
          priority: normalizeChatPriority(draft.priority),
          estimate: draft.estimate,
          assigneeEmail: draft.assigneeEmail,
          targetTeam: draft.targetTeam,
        },
        { createdByType: 'member', createdByName: senderName || 'Usuario' }
      )
      const aiBody = r.ok
        ? `✅ **Ticket creado:** \`${r.ticketId}\` — «${r.title}» en **${r.projectName}**.${ticketUiVisibilityHint(r.projectName)}`
        : r.message
      const aiMessage = await withPrisma((p) =>
        p.message.create({
          data: {
            team: { connect: { id: teamId } },
            owner: { connect: { id: ownerMemberId } },
            project: { connect: { id: projectId } },
            senderId: null,
            senderName: 'Dayless.ai',
            senderType: 'ai',
            content: normalizeMessageBodyForHistory(aiBody, 'Dayless.ai'),
          },
        })
      )
      return NextResponse.json({
        success: true,
        data: { userMessage, aiMessage },
      })
    }

    const { teamId, ownerMemberId, projectId, senderId, senderName, senderType, content } = body

    if (!teamId || !content || !ownerMemberId || !projectId) {
      return NextResponse.json(
        { success: false, error: 'teamId, ownerMemberId, projectId and content are required' },
        { status: 400 }
      )
    }

    const access = await assertMemberChatProjectAccess(teamId, ownerMemberId, projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }
    const chatProjectName = access.projectName
    let pendingTicketConfirm: PendingInternalTicketPayload | null = null

    const skipServerTicketFallbacks = messageStartsWithChatSlashCommand(content)

    // Save user message (hilo por miembro + proyecto ↔ IA).
    // Usar `connect` (no escalares sueltos): con Project añadido, Prisma puede inferir mal UncheckedCreateInput en runtime.
    const userMessage = await withPrisma((p) =>
      p.message.create({
        data: {
          team: { connect: { id: teamId } },
          owner: { connect: { id: ownerMemberId } },
          project: { connect: { id: projectId } },
          senderId: senderId || null,
          senderName: senderName || 'Anonymous',
          senderType: senderType || 'member',
          content,
        },
      })
    )

    let assignedTicketsInject = ''
    const misTicketsMatch = content.trim().match(/^\/mis-tickets\b\s*(.*)$/is)
    if (misTicketsMatch) {
      if (!senderId) {
        const aiEarly = await withPrisma((p) =>
          p.message.create({
            data: {
              team: { connect: { id: teamId } },
              owner: { connect: { id: ownerMemberId } },
              project: { connect: { id: projectId } },
              senderId: null,
              senderName: 'Dayless.ai',
              senderType: 'ai',
              content: normalizeMessageBodyForHistory(
                '⚠️ Para listar tus tickets asignados necesitas estar registrado como **miembro del equipo** (sesión con `TeamMember`).',
                'Dayless.ai'
              ),
            },
          })
        )
        return NextResponse.json({ success: true, data: { userMessage, aiMessage: aiEarly } })
      }
      const assignedRows = await db.ticket.findMany({
        where: { teamId, assigneeMemberId: senderId },
        include: {
          project: { select: { name: true } },
          status: { select: { name: true, isDone: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
      const listMd = formatAssignedTicketsMarkdown(assignedRows)
      const followUp = (misTicketsMatch[1] || '').trim()
      if (!followUp) {
        const body =
          assignedRows.length === 0
            ? 'No tienes tickets **asignados** en este equipo. Si quieres, pide crear uno o revisa el tablero en la app.'
            : `**Tus tickets asignados** (${assignedRows.length})\n\n${listMd}`
        const aiEarly = await withPrisma((p) =>
          p.message.create({
            data: {
              team: { connect: { id: teamId } },
              owner: { connect: { id: ownerMemberId } },
              project: { connect: { id: projectId } },
              senderId: null,
              senderName: 'Dayless.ai',
              senderType: 'ai',
              content: normalizeMessageBodyForHistory(body, 'Dayless.ai'),
            },
          })
        )
        return NextResponse.json({ success: true, data: { userMessage, aiMessage: aiEarly } })
      }
      assignedTicketsInject = `\n\n## Tickets asignados a **${senderName}** (${assignedRows.length}) — datos reales; no inventes otros ids\n${listMd || '(ninguno)'}\n`
    }

    // Get context for AI response
    const [recentMessages, members, knowledge, team, projects] = await Promise.all([
      withPrisma((p) =>
        p.message.findMany({
          where: { teamId, ownerMemberId, projectId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ),
      db.teamMember.findMany({ where: { teamId } }),
      db.knowledgeEntry.findMany({ where: { teamId }, orderBy: { updatedAt: 'desc' }, take: 15 }),
      withPrisma((p) => p.team.findUnique({ where: { id: teamId } })),
      db.project.findMany({ where: { teamId } }),
    ])

    const chatProjectRow = projects.find((p) => p.id === projectId)

    // Integraciones GitHub/Jira solo del proyecto de este hilo
    let githubContext = ''
    let jiraContext = ''
    try {
      const projectsWithGitHub = chatProjectRow
        ? [chatProjectRow].filter((p) => p.githubRepo && p.githubToken)
        : []
      if (projectsWithGitHub.length > 0) {
        const allIssues: string[] = []
        for (const project of projectsWithGitHub) {
          const config = buildConfigFromProject(project)
          if (config) {
            try {
              const issues = await listIssues(config, { state: 'open', per_page: 10 })
              if (issues.length > 0) allIssues.push(formatIssuesSummaryForAI(issues, config))
            } catch (err) { console.error(`GitHub fetch error ${project.githubRepo}:`, err) }
          }
        }
        if (allIssues.length > 0) githubContext = `\n\nGITHUB ISSUES ABIERTOS:\n${allIssues.join('\n\n')}`
      }
      // Fetch Jira issues
      const projectsWithJira = chatProjectRow
        ? [chatProjectRow].filter((p) => p.jiraBaseUrl && p.jiraProjectKey && p.jiraToken)
        : []
      if (projectsWithJira.length > 0) {
        const allJiraIssues: string[] = []
        for (const project of projectsWithJira) {
          const setup = jiraBuildConfig(project)
          if (setup) {
            try {
              const result = await jiraSearchIssues(setup.config, `project = "${setup.projectKey}" AND statusCategory NOT IN ("Done") ORDER BY updated DESC`, { maxResults: 10 })
              if (result.issues.length > 0) allJiraIssues.push(jiraFormatSummary(result.issues))
            } catch (err) { console.error(`Jira fetch error ${project.jiraProjectKey}:`, err) }
          }
        }
        if (allJiraIssues.length > 0) jiraContext = `\n\nJIRA TICKETS ABIERTOS:\n${allJiraIssues.join('\n\n')}`
      }
    } catch (err) {
      console.error('Issue context fetch error:', err)
    }

    // Build conversation history for LLM (oldest first),
    // excluding synthetic/system error messages that can pollute context.
    const history = [...recentMessages]
      .reverse()
      .filter((m) => {
        const text = (m.content || '').toLowerCase()
        if (m.senderType === 'system') return false
        if (text.includes('⚠️')) return false
        if (text.includes('configuration file not found')) return false
        if (text.includes('status 404')) return false
        if (text.includes('insufficient balance')) return false
        if (text.includes('z.ai responde sin saldo')) return false
        if (text.includes('tuve un problema al procesar tu mensaje')) return false
        return true
      })
      .map(m => ({
      role: m.senderType === 'ai' ? ('assistant' as const) : ('user' as const),
      content: `[${m.senderName}]: ${normalizeMessageBodyForHistory(m.content, m.senderName)}`,
      }))

    // Build system prompt
    const memberList = members.map(m => `- ${m.name} (${m.role})`).join('\n')
    const knowledgeContext = knowledge.map(k => `- **${k.key}**: ${k.value}`).join('\n')
    const projectList = projects.map(p => `- **${p.name}**${p.jiraProjectKey ? ` [Jira: ${p.jiraProjectKey}]` : ''}${p.githubRepo ? ` (${p.githubRepo})` : ''} [${p.status}]`).join('\n')
    const jiraReadyProjects = projects.filter((p) => p.jiraBaseUrl && p.jiraProjectKey && p.jiraToken)
    const jiraKeysAllowed = jiraReadyProjects.map((p) => p.jiraProjectKey).filter(Boolean) as string[]
    const jiraAvailabilityLine =
      jiraKeysAllowed.length === 0
        ? '(Jira no conectado en este equipo; no uses [JIRA_ACTION].)'
        : `(Solo si el usuario pide Jira explícitamente: claves permitidas ${jiraKeysAllowed.join(', ')} — nunca inventes otras.)`

    const storyPointGuideBlock = team?.storyPointGuide?.trim()
      ? `\n\nGUÍA DE STORY POINTS DEL EQUIPO (Ajustes → Guías de trabajo): úsala al orientar sobre estimación; la **estimación numérica** de un ticket concreto se hace en el **chat de ese ticket** (botón Estimar), con comparación frente a otros tickets del proyecto.\n${team.storyPointGuide.trim()}`
      : '\n\n(El equipo puede definir una guía de story points en **Ajustes**; hasta entonces orienta con buenas prácticas y escala coherente.)'

    const systemPrompt = `Eres "Dayless.ai", un AI Scrum Master virtual que coordina equipos de desarrollo. Hablas en español por defecto, pero puedes usar inglés si el usuario lo hace.

TU ROL:
- Coordinar equipos de desarrollo
- Hacer seguimiento del sprint y preguntar por standups diarios
- Identificar blockers y ayudar a resolverlos
- Guardar información importante que aprendas
- Si no sabes algo, preguntar a quien lo sepa
- **Tickets del tablero interno** del equipo (crear / actualizar) y, si aplica, GitHub/Jira cuando el usuario lo pida
- Generar reportes diarios con el progreso del equipo

Este chat es **privado entre tú y el usuario actual**. Hay un **historial distinto por proyecto**: este hilo es solo para **${chatProjectName}**; no mezcles contexto de otros proyectos salvo que el usuario lo cite.

EQUIPO ACTUAL: ${team?.name || 'Sin equipo'}
MIEMBROS:
${memberList}

PROYECTOS DEL EQUIPO:
${projectList || 'Sin proyectos'}
${jiraAvailabilityLine}

BASE DE CONOCIMIENTO DEL EQUIPO:
${knowledgeContext || 'Sin información guardada aún'}
${githubContext}
${jiraContext}
${storyPointGuideBlock}

INSTRUCCIONES:
1. Sé útil y proactivo
2. Si alguien comparte información útil, indícalo con 📌 para guardarla en la base de conocimiento
3. Pregunta por blockers y progreso regularmente
4. Usa formato markdown para respuestas largas. En la app, **solo** el comando \`/standup\` (sin texto extra) abre el formulario de check-in; aquí solo verás \`/standup …\` con texto: entonces es **check-in rápido** en chat (no el cuerpo de un solo ticket): resume ayer/hoy/blockers; si hacen falta tickets, usa **JSON o acciones por incidencia**, no pegues todo el mensaje como una única descripción. Si el mensaje **empieza por** /blocker, /question o /update, misma lógica de check-in rápido. **/mis-tickets** pide el backlog asignado al usuario; si en el contexto aparece la sección «Tickets asignados», úsala tal cual para recomendaciones.
4b. **Standup asíncrono del proyecto**: \`/standup-equipo\` (solo, en este hilo de proyecto) envía un aviso al chat de cada persona asignada al proyecto para que dejen su check-in. \`/standup-resumen\` inserta aquí el **estado del standup de hoy** para ese grupo (check-ins guardados; quien falta aparece pendiente). Si piden levantar standup al equipo, sugiere estos comandos.
4c. **Chat por ticket**: hilo **visible para el equipo** para refining; la IA interviene solo con las acciones **Estimar** o **Refinar descripción** (pueden aplicarse al ticket). Si hablan de refining, orienta hacia ese hilo y esas acciones.
5. Si detectas un posible blocker, ofrécete a crear un ticket interno para trackearlo
6. No afirmes "problemas técnicos" ni caídas del sistema a menos que exista evidencia explícita y actual en esta conversación.
7. **TICKETS INTERNOS (por defecto)** — Si el usuario pide crear un ticket (sin GitHub/Jira). **El servidor nunca inserta el ticket sin el usuario**: debe pulsar **Crear ticket** en la interfaz. Tú solo preparas el borrador en JSON.
   - **Proyecto del hilo**: **«${chatProjectName}»**. Si no piden otro proyecto, \`project\` en el JSON = \`"${chatProjectName}"\`.
   - **Borrador listo** (título ≥8, descripción ≥30): en el texto pide explícitamente que **confirmen con el botón «Crear ticket»** del chat. **Al final** del mensaje incluye **exactamente** un bloque \`\`\`json con \`awaiting_confirm: true\` o \`ready: true\` (ambos equivalentes para el servidor) y los campos:
\`\`\`json
{"internal_ticket":{"awaiting_confirm":true,"project":"${chatProjectName}","title":"...","description":"...","priority":"medium"}}
\`\`\`
   Opcionales: \`estimate\`, \`assignee_email\`, \`target_team\`. **Prohibido** afirmar que el ticket ya existe o inventar \`tkt_...\`; el id llegará tras la confirmación del usuario.
   - **Si falta info esencial** (\`ready: false\`): sección **«Propuesta de ticket (borrador)»** + lista concreta de huecos; JSON con \`missing\` y \`note\`. No uses \`awaiting_confirm\` hasta tener título y descripción válidos.
   - Actualizar ticket existente: \`[INTERNAL_TICKET_ACTION: update_ticket | ticketId: tkt_... | ...]\` (no requiere el botón de crear).
   - Evita \`[INTERNAL_TICKET_ACTION: create_ticket | ...]\`; prefiere el JSON con \`awaiting_confirm\`.
8. **GitHub** (solo si lo piden): [GITHUB_ACTION: create_issue | repo: owner/repo | title: ... | body: ... | labels: ...], close_issue, comment_issue
9. **Jira** (solo si lo piden explícitamente y hay clave permitida arriba): [JIRA_ACTION: create_ticket | projectKey: ... | ...], update_ticket, comment_ticket
10. Referencia: issues GitHub con #número; tickets internos con el id \`tkt_...\` que devuelve el sistema; Jira solo si aplica`

    const systemPromptForModel = systemPrompt + assignedTicketsInject

    // Call LLM
    let aiResponseText: string
    try {
      const ZAI = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.default.create()
      const completion = await zai.chat.completions.create({
        model: process.env.ZAI_MODEL || 'glm-4.5-air',
        messages: [
          { role: 'assistant', content: systemPromptForModel },
          ...history,
        ],
        thinking: { type: 'disabled' },
      })
      const apiError = (completion as any)?.error
      if (apiError) {
        const errCode = String(apiError.code || '')
        const errMessage = String(apiError.message || 'Unknown API error')
        throw new Error(`ZAI_API_ERROR:${errCode}:${errMessage}`)
      }

      aiResponseText =
        (completion as any)?.choices?.[0]?.message?.content ||
        (completion as any)?.data?.choices?.[0]?.message?.content ||
        'Lo siento, no pude generar una respuesta.'
    } catch (aiError) {
      console.error('AI Error:', aiError)
      const message = aiError instanceof Error ? aiError.message : String(aiError)
      if (message.includes('.z-ai-config')) {
        aiResponseText = '⚠️ Falta la configuración local de z.ai (`.z-ai-config`). Configúrala en este proyecto o en tu home y vuelve a intentar.'
      } else if (message.includes('status 404')) {
        aiResponseText = '⚠️ z.ai respondió 404. Revisa `baseUrl` en `.z-ai-config` (debe ser el endpoint exacto de tu cuenta e incluir `/v1`).'
      } else if (message.includes('status 401') || message.toLowerCase().includes('unauthorized')) {
        aiResponseText = '⚠️ z.ai rechazó la autenticación (401). Revisa `apiKey` y permisos en `.z-ai-config`.'
      } else if (message.includes('ZAI_API_ERROR:1113') || message.toLowerCase().includes('insufficient balance')) {
        aiResponseText = '⚠️ z.ai responde sin saldo/paquete activo (código 1113). Activa crédito o un plan de modelo en tu cuenta para habilitar el chat.'
      } else {
        aiResponseText = '⚠️ Tuve un problema al procesar tu mensaje. Por favor, intenta de nuevo en un momento.'
      }
    }

    // Structured JSON ticket (misma regla de negocio que la app)
    const teamProjectRefsForChat: TeamProjectRef[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
    }))
    let actionResults: string[] = []
    const { cleaned: aiResponseForActions, payload: ticketJsonPayload } =
      extractInternalTicketJsonBlock(aiResponseText)
    pendingTicketConfirm = buildPendingFromJsonPayload(ticketJsonPayload, chatProjectName)
    const modelPendingMoreTicketData =
      ticketJsonPayload?.ready === false ||
      (ticketJsonPayload == null && aiProseSuggestsAwaitingUserTicketDetails(aiResponseForActions))

    const internalActionPattern = /\[INTERNAL_TICKET_ACTION:\s*(\w+)\s*\|(.+?)\]/g
    const githubActionPattern = /\[GITHUB_ACTION:\s*(\w+)\s*\|(.+?)\]/g
    const jiraActionPattern = /\[JIRA_ACTION:\s*(\w+)\s*\|(.+?)\]/g
    let match
    const internalRegex = new RegExp(internalActionPattern)
    const githubRegex = new RegExp(githubActionPattern)

    while ((match = internalRegex.exec(aiResponseForActions)) !== null) {
      const actionType = match[1].trim()
      const paramsRaw = match[2].trim()
      const params: Record<string, string> = {}
      paramsRaw.split('|').forEach(p => {
        const [key, ...valueParts] = p.split(':')
        params[key.trim()] = valueParts.join(':').trim()
      })

      try {
        if (actionType === 'create_ticket') {
          if (!pendingTicketConfirm) {
            const title = (params.title || '').trim()
            const description = (params.description || '').trim()
            if (title.length >= 8 && description.length >= 30) {
              pendingTicketConfirm = {
                project: (params.project || '').trim() || chatProjectName,
                title,
                description,
                priority: normalizeChatPriority(params.priority),
                estimate: params.estimate?.trim() || undefined,
                assigneeEmail: params.assigneeEmail?.trim() || undefined,
                targetTeam: params.targetTeam?.trim() || undefined,
              }
            } else {
              actionResults.push(
                '⚠️ Borrador incompleto en INTERNAL_TICKET_ACTION (título ≥8, descripción ≥30); confirma en el chat cuando el asistente lo proponga.'
              )
            }
          }
        } else if (actionType === 'update_ticket') {
          const ticketId = params.ticketId
          if (!ticketId) {
            actionResults.push('❌ Falta ticketId para actualizar ticket interno')
            continue
          }
          const currentRows = await db.$queryRawUnsafe(
            'SELECT id, "projectId", "statusId", title, description, priority, progress FROM "Ticket" WHERE id = ? LIMIT 1',
            ticketId
          ) as Array<{
            id: string
            projectId: string
            statusId: string
            title: string
            description: string | null
            priority: string
            progress: string | null
          }>
          const current = currentRows[0]
          if (!current) {
            actionResults.push(`❌ No existe ticket interno con id ${ticketId}`)
            continue
          }
          const nextStatusRows = params.status
            ? await db.$queryRawUnsafe(
                'SELECT id FROM "TicketWorkflow" WHERE "projectId" = ? AND name = ? LIMIT 1',
                current.projectId,
                params.status
              ) as Array<{ id: string }>
            : []
          const nextStatus = nextStatusRows[0]
          const nextTitle = params.title?.trim() || current.title
          let nextDesc = current.description || ''
          if (params.description?.trim()) nextDesc = params.description.trim()
          else if (params.note?.trim())
            nextDesc = nextDesc ? `${nextDesc}\n\n- ${params.note.trim()}` : params.note.trim()
          const pri = (params.priority || '').toLowerCase()
          const nextPriority = ['low', 'medium', 'high', 'critical'].includes(pri) ? pri : current.priority

          await db.$executeRawUnsafe(
            'UPDATE "Ticket" SET "statusId" = ?, title = ?, description = ?, priority = ?, progress = ?, "updatedAt" = ? WHERE id = ?',
            nextStatus?.id || current.statusId,
            nextTitle,
            nextDesc || null,
            nextPriority,
            params.progress !== undefined ? params.progress : current.progress,
            new Date().toISOString(),
            ticketId
          )
          if (nextStatus && nextStatus.id !== current.statusId) {
            await db.$executeRawUnsafe(
              'INSERT INTO "TicketTransition" (id, "ticketId", "fromStatusId", "toStatusId", reason, "actorType", "actorName", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              'ttr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
              ticketId,
              current.statusId,
              nextStatus.id,
              params.note || 'Actualizado desde chat',
              'ai',
              'Dayless.ai',
              new Date().toISOString()
            )
          }
          actionResults.push(`✅ Ticket interno actualizado: ${ticketId}`)
        } else {
          actionResults.push(`❌ Acción interna desconocida: ${actionType}`)
        }
      } catch (actionError) {
        const errMsg = actionError instanceof Error ? actionError.message : String(actionError)
        actionResults.push(`❌ Error en ticket interno (${actionType}): ${errMsg}`)
      }
    }

    const internalCreatedStart = actionResultsIndicateInternalTicketCreated(actionResults)
    if (!internalCreatedStart && !skipServerTicketFallbacks && !modelPendingMoreTicketData && !pendingTicketConfirm) {
      const appendLine = await tryAppendLatestReporterTicket(teamId, projectId, senderId || null, content)
      if (appendLine) {
        actionResults.push(appendLine)
      } else {
        const autoLine = await tryCreateTicketFromConversationIntent(
          teamId,
          senderId || null,
          teamProjectRefsForChat,
          recentMessages as RecentMsg[],
          projectId
        )
        if (autoLine) actionResults.push(autoLine)
      }
    }

    // Sin INSERT automático por "crea ticket" + texto largo: la creación va con confirmación en el cliente.

    while ((match = githubRegex.exec(aiResponseForActions)) !== null) {
      const actionType = match[1].trim()
      const paramsRaw = match[2].trim()
      const params: Record<string, string> = {}
      paramsRaw.split('|').forEach(p => {
        const [key, ...valueParts] = p.split(':')
        params[key.trim()] = valueParts.join(':').trim()
      })

      try {
        // Find project config
        const targetRepo = params.repo
        let projectConfig: { githubRepo: string; githubToken: string; teamId: string; name: string } | null = null
        for (const p of projects) {
          if (p.githubRepo && p.githubToken) {
            const { owner, repo } = (() => {
              const clean = p.githubRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
              const parts = clean.split('/')
              return { owner: parts[0], repo: parts[1] }
            })()
            if (`${owner}/${repo}` === targetRepo) {
              projectConfig = { githubRepo: p.githubRepo, githubToken: p.githubToken, teamId: p.teamId, name: p.name }
              break
            }
          }
        }

        if (!projectConfig) {
          actionResults.push(`❌ No se encontró configuración GitHub para ${targetRepo}`)
          continue
        }

        const config = buildConfigFromProject(projectConfig)
        if (!config) continue

        let resultMsg: string

        switch (actionType) {
          case 'create_issue': {
            const issue = await createIssue(config, {
              title: params.title || 'Sin título',
              body: params.body || '',
              labels: params.labels ? params.labels.split(',').map(l => l.trim()) : undefined,
            })
            resultMsg = `✅ Issue creado: [#${issue.number}](${issue.html_url}) "${issue.title}" en ${targetRepo}`
            await db.integrationLog.create({
              data: { teamId, type: 'github', action: 'issue_created', externalId: String(issue.number), data: JSON.stringify({ title: issue.title, url: issue.html_url }), status: 'success' },
            })
            break
          }
          case 'close_issue': {
            const num = parseInt(params.number || '0')
            if (!num) { resultMsg = `❌ Número de issue inválido`; break }
            const issue = await updateIssue(config, num, { state: 'closed' })
            resultMsg = `✅ Issue cerrado: #${num} "${issue.title}" en ${targetRepo}`
            await db.integrationLog.create({
              data: { teamId, type: 'github', action: 'issue_closed', externalId: String(num), data: JSON.stringify({ title: issue.title }), status: 'success' },
            })
            break
          }
          case 'comment_issue': {
            const num = parseInt(params.number || '0')
            if (!num) { resultMsg = `❌ Número de issue inválido`; break }
            const comment = await addIssueComment(config, num, params.comment || '')
            resultMsg = `✅ Comentario añadido a #${num} en ${targetRepo}`
            await db.integrationLog.create({
              data: { teamId, type: 'github', action: 'issue_commented', externalId: String(num), data: JSON.stringify({ comment: params.comment }), status: 'success' },
            })
            break
          }
          default:
            resultMsg = `❌ Acción desconocida: ${actionType}`
        }

        actionResults.push(resultMsg!)
      } catch (actionError) {
        const errMsg = actionError instanceof Error ? actionError.message : String(actionError)
        actionResults.push(`❌ Error ejecutando ${actionType}: ${errMsg}`)
      }
    }

    // Process Jira actions
    const jiraRegex = new RegExp(jiraActionPattern)
    while ((match = jiraRegex.exec(aiResponseForActions)) !== null) {
      const actionType = match[1].trim()
      const paramsRaw = match[2].trim()
      const params: Record<string, string> = {}
      paramsRaw.split('|').forEach(p => {
        const [key, ...valueParts] = p.split(':')
        params[key.trim()] = valueParts.join(':').trim()
      })
      try {
        const targetProjectKey = params.projectKey
        let jiraProject = projects.find(p => p.jiraProjectKey === targetProjectKey)
        if (!jiraProject || !jiraProject.jiraBaseUrl || !jiraProject.jiraToken) {
          actionResults.push(`❌ No se encontró configuración Jira para ${targetProjectKey}`)
          continue
        }
        const setup = jiraBuildConfig(jiraProject)
        if (!setup) continue
        let resultMsg: string
        switch (actionType) {
          case 'create_ticket': {
            const issue = await jiraCreateIssue(setup.config, { projectKey: setup.projectKey, summary: params.summary || 'Sin título', description: params.description || '', priority: params.priority || undefined, issueType: params.type || 'Task' })
            resultMsg = `✅ Ticket Jira creado: ${issue.key} "${issue.fields.summary}"`
            await db.integrationLog.create({ data: { teamId, type: 'jira', action: 'ticket_created', externalId: issue.key, data: JSON.stringify({ key: issue.key, summary: issue.fields.summary }), status: 'success' } })
            break
          }
          case 'update_ticket': {
            const issueKey = params.issueKey
            if (!issueKey) { resultMsg = '❌ issueKey requerido'; break }
            const issue = await jiraUpdateIssue(setup.config, issueKey, { status: params.status, priority: params.priority })
            resultMsg = `✅ Ticket actualizado: ${issue.key} → ${issue.fields.status?.name || 'Updated'}`
            await db.integrationLog.create({ data: { teamId, type: 'jira', action: 'ticket_updated', externalId: issueKey, data: JSON.stringify({ key: issueKey }), status: 'success' } })
            break
          }
          case 'comment_ticket': {
            const issueKey = params.issueKey
            if (!issueKey || !params.comment) { resultMsg = '❌ issueKey y comment requeridos'; break }
            await jiraAddComment(setup.config, issueKey, params.comment)
            resultMsg = `✅ Comentario añadido a ${issueKey}`
            await db.integrationLog.create({ data: { teamId, type: 'jira', action: 'ticket_commented', externalId: issueKey, status: 'success' } })
            break
          }
          default: resultMsg = `❌ Acción Jira desconocida: ${actionType}`
        }
        actionResults.push(resultMsg!)
      } catch (actionError) {
        actionResults.push(`❌ Error Jira ${actionType}: ${actionError instanceof Error ? actionError.message : String(actionError)}`)
      }
    }

    // Remove action tags from the visible response
    let finalResponse = aiResponseForActions
      .replace(/\[INTERNAL_TICKET_ACTION:[^\]]+\]\n?/g, '')
      .replace(/\[GITHUB_ACTION:[^\]]+\]\n?/g, '')
      .replace(/\[JIRA_ACTION:[^\]]+\]\n?/g, '')
      .trim()

    const realTicketIds = new Set<string>()
    for (const r of actionResults) {
      const found = r.match(/tkt_[a-zA-Z0-9_]+/g)
      if (found) found.forEach((id) => realTicketIds.add(id))
    }
    finalResponse = finalResponse.replace(/\btkt_[a-zA-Z0-9]+\b/g, (id) =>
      realTicketIds.has(id) ? id : '*(pendiente: ver el id bajo --- abajo)*'
    )

    if (actionResults.length > 0) {
      finalResponse += '\n\n---\n' + actionResults.join('\n')
    }

    finalResponse = normalizeMessageBodyForHistory(finalResponse, 'Dayless.ai')

    // Save AI message
    const aiMessage = await withPrisma((p) =>
      p.message.create({
        data: {
          team: { connect: { id: teamId } },
          owner: { connect: { id: ownerMemberId } },
          project: { connect: { id: projectId } },
          senderId: null,
          senderName: 'Dayless.ai',
          senderType: 'ai',
          content: finalResponse,
        },
      })
    )

    // Auto-extract knowledge if AI used 📌
    const knowledgePatterns = [
      { regex: /📌\s*\*\*(.+?)\*\*:\s*(.+?)(?:\n|$)/g },
      { regex: /Knowledge Entry:\s*(.+?)(?:\.|,|\n)/gi },
    ]

    for (const pattern of knowledgePatterns) {
      let kMatch
      while ((kMatch = pattern.regex.exec(finalResponse)) !== null) {
        const key = kMatch[1]?.trim()
        const value = kMatch[2]?.trim()
        if (key && value && key.length > 2 && value.length > 5) {
          try {
            await db.knowledgeEntry.create({
              data: { teamId, key, value, source: senderName || 'Team Chat', category: 'general', confidence: 70 },
            })
          } catch { /* ignore duplicate */ }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userMessage,
        aiMessage,
        ...(pendingTicketConfirm ? { pendingTicketConfirm } : {}),
      },
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
