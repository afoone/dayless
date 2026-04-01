import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

type TicketAiResult = {
  summary: string
  suggestedStatusId?: string
  risks: string[]
  nextSteps: string[]
  needsEstimate: boolean
  estimateSuggestion?: string
  refinedDescription?: string
}

function fallbackResult(action: string): TicketAiResult {
  if (action === 'estimate') {
    return {
      summary: 'Estimación no disponible por ahora. Añade más contexto técnico en el chat del ticket.',
      risks: [],
      nextSteps: ['Desglosar tarea en subtareas', 'Definir criterios de aceptación'],
      needsEstimate: true,
      estimateSuggestion: 'Pendiente',
    }
  }
  if (action === 'refine_description') {
    return {
      summary: 'No se pudo refinar la descripción ahora.',
      risks: [],
      nextSteps: [],
      needsEstimate: false,
      refinedDescription: undefined,
    }
  }
  return {
    summary: 'No se pudo ejecutar el análisis IA en este momento.',
    risks: [],
    nextSteps: [],
    needsEstimate: false,
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const action = String(body.action || 'summarize')
    const applyToTicket = Boolean(body.applyToTicket)

    const ticket = await withPrisma((db) =>
      db.ticket.findUnique({
        where: { id },
        include: {
          project: true,
          status: true,
          team: { select: { storyPointGuide: true } },
        },
      })
    )
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const storyPointGuide = ticket.team.storyPointGuide?.trim() || ''

    const peerTickets = await withPrisma((db) =>
      db.ticket.findMany({
        where: {
          projectId: ticket.projectId,
          id: { not: id },
          estimate: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: { title: true, description: true, estimate: true },
      })
    )

    const peersBlock =
      peerTickets.length === 0
        ? '(No hay otros tickets estimados en este proyecto; infiere con la guía o escala Fibonacci habitual.)'
        : peerTickets
            .map(
              (p) =>
                `- [${String(p.estimate).trim()}] ${p.title}${p.description ? ` — ${String(p.description).slice(0, 80)}…` : ''}`
            )
            .join('\n')

    const [workflows, messages] = await Promise.all([
      withPrisma((db) =>
        db.ticketWorkflow.findMany({ where: { projectId: ticket.projectId }, orderBy: { position: 'asc' } })
      ),
      withPrisma((db) =>
        db.ticketMessage.findMany({
          where: { ticketId: id },
          orderBy: { createdAt: 'asc' },
          take: 50,
        })
      ),
    ])

    const guideBlock =
      storyPointGuide.length > 0
        ? storyPointGuide
        : '(El equipo aún no definió guía de story points en Ajustes; usa comparación con referencias y escala coherente, p. ej. Fibonacci en puntos.)'

    const actionRules =
      action === 'refine_description'
        ? `Acción **refine_description**: integra título, descripción actual y mensajes del hilo en una **nueva descripción** en markdown (criterios de aceptación si aplica). Devuelve **refinedDescription** con el texto completo que debe sustituir a la descripción del ticket. **summary** puede ser una línea breve. Omite suggestedStatusId salvo que el hilo pida explícitamente cambiar estado.`
        : action === 'estimate'
          ? `Acción **estimate**:
- **estimateSuggestion**: solo un valor de story points (ej. "2", "3", "5", "8") o "?" si falta información crítica; sin texto largo.
- **needsEstimate**: true si propones "?" o hay mucha incertidumbre.
- Compara la complejidad de ESTE ticket con los de referencia del mismo proyecto.
- Respeta la guía de story points del equipo; si no basta, prioriza la **comparación** con los tickets listados.
- Si nadie debatió aún en el chat, basa la estimación en título, descripción y referencias.`
          : `Acción **${action}**: resume breve; suggestedStatusId solo si encaja.`

    const systemPrompt = `Eres un asistente de delivery para tickets internos.
Devuelve SIEMPRE JSON válido con esta forma:
{
  "summary": "string",
  "suggestedStatusId": "string opcional",
  "risks": ["string"],
  "nextSteps": ["string"],
  "needsEstimate": boolean,
  "estimateSuggestion": "string opcional",
  "refinedDescription": "string opcional (solo acción refine_description)"
}

${actionRules}

Estados disponibles del proyecto:
${workflows.map((w) => `- ${w.id}: ${w.name}`).join('\n')}

Guía de story points (equipo):
${guideBlock}

Tickets de referencia (mismo proyecto, con estimación):
${peersBlock}

Reglas:
- suggestedStatusId debe ser uno de los IDs disponibles u omitirse.
- Mantén resumen breve y accionable.`

    const userPrompt = `Ticket:
Título: ${ticket.title}
Descripción: ${ticket.description || 'Sin descripción'}
Estado actual: ${ticket.status.name}
Prioridad: ${ticket.priority}
Estimación: ${ticket.estimate || 'Sin estimar'}
Progreso: ${ticket.progress || 'Sin progreso definido'}

Mensajes del hilo (discusión del equipo):
${messages.map((m) => `- [${m.senderName}/${m.senderType}] ${m.content}`).join('\n')}`

    let result: TicketAiResult

    try {
      const ZAI = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.default.create()
      const completion = await zai.chat.completions.create({
        model: process.env.ZAI_MODEL || 'GLM-4.5-Air',
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })

      const apiError = (completion as any)?.error
      if (apiError) {
        throw new Error(`ZAI_API_ERROR:${apiError.code || 'unknown'}:${apiError.message || 'error'}`)
      }

      const text =
        (completion as any)?.choices?.[0]?.message?.content ||
        (completion as any)?.data?.choices?.[0]?.message?.content ||
        '{}'

      const clean = String(text).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
      const parsed = JSON.parse(clean) as Partial<TicketAiResult>

      result = {
        summary: String(parsed.summary || 'Sin resumen'),
        suggestedStatusId:
          parsed.suggestedStatusId && workflows.some((w) => w.id === parsed.suggestedStatusId)
            ? parsed.suggestedStatusId
            : undefined,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(String) : [],
        needsEstimate: Boolean(parsed.needsEstimate),
        estimateSuggestion: parsed.estimateSuggestion ? String(parsed.estimateSuggestion).trim() : undefined,
        refinedDescription: parsed.refinedDescription ? String(parsed.refinedDescription).trim() : undefined,
      }
    } catch {
      result = fallbackResult(action)
    }

    const applied: { estimate?: string; description?: string } = {}

    if (applyToTicket) {
      if (action === 'estimate' && result.estimateSuggestion && result.estimateSuggestion !== '?' && result.estimateSuggestion !== 'Pendiente') {
        const est = result.estimateSuggestion.slice(0, 120)
        await withPrisma((db) => db.ticket.update({ where: { id }, data: { estimate: est } }))
        applied.estimate = est
      }
      if (action === 'refine_description' && result.refinedDescription && result.refinedDescription.length >= 10) {
        const desc = result.refinedDescription.slice(0, 12000)
        await withPrisma((db) => db.ticket.update({ where: { id }, data: { description: desc } }))
        applied.description = desc
      }
    }

    return NextResponse.json({ success: true, data: { ...result, applied } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
