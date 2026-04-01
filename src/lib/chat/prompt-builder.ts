type PromptContext = {
  teamName: string
  organizationName?: string
  projectName: string
  members: Array<{ name: string; role: string }>
  knowledgeEntries: Array<{ key: string; value: string }>
  projectSummary: string
  ticketSummary?: string
  crossMemberContext: string
  storyPointGuide?: string | null
  pendingSystemMessages?: string
}

export function buildChatPromptContext(ctx: PromptContext): string {
  const memberList = ctx.members.map((m) => `- ${m.name} (${m.role})`).join('\n') || '- Sin miembros'
  const knowledge = ctx.knowledgeEntries.map((k) => `- ${k.key}: ${k.value}`).join('\n') || '- Sin conocimiento'

  return `IDENTIDAD:\nEres Dayless.ai, Scrum Master IA.\n\nEQUIPO:\n- Equipo: ${ctx.teamName}\n- Organización: ${ctx.organizationName || 'N/A'}\n- Proyecto actual: ${ctx.projectName}\n\nMIEMBROS:\n${memberList}\n\nPROYECTOS:\n${ctx.projectSummary}\n\nCONOCIMIENTO:\n${knowledge}\n\nTICKETS DEL SPRINT:\n${ctx.ticketSummary || '- Sin datos'}\n\n${ctx.crossMemberContext}\n\nGUIA STORY POINTS:\n${ctx.storyPointGuide?.trim() || '(Sin guía definida)'}\n\nMENSAJES PENDIENTES:\n${ctx.pendingSystemMessages || '(Ninguno)'}\n\nACCIONES DISPONIBLES:\n- ticket_proposal\n- knowledge_entry\n- ticket_update\n- standup_checkin\n\nREGLAS:\n- No ejecutar mutaciones sin confirmación del usuario.\n- Si propones acción, devuelve JSON en un único bloque \`\`\`json.\n- No inventes IDs.\n- Responde en español por defecto.`
}
