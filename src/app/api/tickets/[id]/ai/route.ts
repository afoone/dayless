import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

type TicketAiResult = {
  summary: string
  suggestedStatusId?: string
  risks: string[]
  nextSteps: string[]
  needsEstimate: boolean
  estimateSuggestion?: string
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

    const ticket = await withPrisma(async (db) =>
      db.ticket.findUnique({
        where: { id },
        include: {
          project: true,
          status: true,
        },
      })
    )
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const [workflows, messages] = await Promise.all([
      withPrisma(async (db) => db.ticketWorkflow.findMany({ where: { projectId: ticket.projectId }, orderBy: { position: 'asc' } })),
      withPrisma(async (db) => db.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'asc' }, take: 40 })),
    ])

    const systemPrompt = `Eres un asistente de delivery para tickets internos.
Devuelve SIEMPRE JSON válido con esta forma:
{
  "summary": "string",
  "suggestedStatusId": "string opcional",
  "risks": ["string"],
  "nextSteps": ["string"],
  "needsEstimate": boolean,
  "estimateSuggestion": "string opcional"
}

Acción solicitada: ${action}
Estados disponibles del proyecto:
${workflows.map((w) => `- ${w.id}: ${w.name}`).join('\n')}

Reglas:
- suggestedStatusId debe ser uno de los IDs disponibles.
- Si no aplica cambio de estado, omite suggestedStatusId.
- Mantén resumen breve y accionable.`

    const userPrompt = `Ticket:
Título: ${ticket.title}
Descripción: ${ticket.description || 'Sin descripción'}
Estado actual: ${ticket.status.name}
Prioridad: ${ticket.priority}
Estimación: ${ticket.estimate || 'Sin estimar'}
Progreso: ${ticket.progress || 'Sin progreso definido'}

Mensajes:
${messages.map((m) => `- [${m.senderName}/${m.senderType}] ${m.content}`).join('\n')}`

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

      const result: TicketAiResult = {
        summary: String(parsed.summary || 'Sin resumen'),
        suggestedStatusId:
          parsed.suggestedStatusId && workflows.some((w) => w.id === parsed.suggestedStatusId)
            ? parsed.suggestedStatusId
            : undefined,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(String) : [],
        needsEstimate: Boolean(parsed.needsEstimate),
        estimateSuggestion: parsed.estimateSuggestion ? String(parsed.estimateSuggestion) : undefined,
      }

      return NextResponse.json({ success: true, data: result })
    } catch {
      return NextResponse.json({ success: true, data: fallbackResult(action) })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
