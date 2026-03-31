import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listIssues, formatIssuesSummaryForAI, buildConfigFromProject, createIssue, updateIssue, addIssueComment } from '@/lib/github'
import { searchIssues as jiraSearchIssues, formatIssuesSummaryForAI as jiraFormatSummary, buildConfigFromProject as jiraBuildConfig, createIssue as jiraCreateIssue, updateIssue as jiraUpdateIssue, addComment as jiraAddComment } from '@/lib/jira'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 })
    }

    const [messages, total] = await Promise.all([
      db.message.findMany({ where: { teamId }, orderBy: { createdAt: 'asc' }, take: limit, skip: offset }),
      db.message.count({ where: { teamId } }),
    ])

    return NextResponse.json({ success: true, data: messages, meta: { total, limit, offset } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, senderId, senderName, senderType, content } = body

    if (!teamId || !content) {
      return NextResponse.json({ success: false, error: 'teamId and content are required' }, { status: 400 })
    }

    // Save user message
    const userMessage = await db.message.create({
      data: {
        teamId,
        senderId: senderId || null,
        senderName: senderName || 'Anonymous',
        senderType: senderType || 'member',
        content,
      },
    })

    // Get context for AI response
    const [recentMessages, members, knowledge, team, projects] = await Promise.all([
      db.message.findMany({ where: { teamId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.teamMember.findMany({ where: { teamId } }),
      db.knowledgeEntry.findMany({ where: { teamId }, orderBy: { updatedAt: 'desc' }, take: 15 }),
      db.team.findUnique({ where: { id: teamId } }),
      db.project.findMany({ where: { teamId } }),
    ])

    // Fetch GitHub issues for configured projects
    let githubContext = ''
    let jiraContext = ''
    try {
      const projectsWithGitHub = projects.filter(p => p.githubRepo && p.githubToken)
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
      const projectsWithJira = projects.filter(p => p.jiraBaseUrl && p.jiraProjectKey && p.jiraToken)
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

    // Build conversation history for LLM (oldest first)
    const history = [...recentMessages].reverse().map(m => ({
      role: m.senderType === 'ai' ? ('assistant' as const) : ('user' as const),
      content: `[${m.senderName}]: ${m.content}`,
    }))

    // Build system prompt
    const memberList = members.map(m => `- ${m.name} (${m.role})`).join('\n')
    const knowledgeContext = knowledge.map(k => `- **${k.key}**: ${k.value}`).join('\n')
    const projectList = projects.map(p => `- **${p.name}**${p.jiraProjectKey ? ` [Jira: ${p.jiraProjectKey}]` : ''}${p.githubRepo ? ` (${p.githubRepo})` : ''} [${p.status}]`).join('\n')

    const systemPrompt = `Eres "Dayless.ai", un AI Scrum Master virtual que coordina equipos de desarrollo. Hablas en español por defecto, pero puedes usar inglés si el usuario lo hace.

TU ROL:
- Coordinar equipos de desarrollo
- Hacer seguimiento del sprint y preguntar por standups diarios
- Identificar blockers y ayudar a resolverlos
- Guardar información importante que aprendas
- Si no sabes algo, preguntar a quien lo sepa
- **Gestionar GitHub Issues y Jira Tickets**: crear, cerrar, comentar y actualizar estado
- Generar reportes diarios con el progreso del equipo

EQUIPO ACTUAL: ${team?.name || 'Sin equipo'}
MIEMBROS:
${memberList}

PROYECTOS DEL EQUIPO:
${projectList || 'Sin proyectos'}

BASE DE CONOCIMIENTO DEL EQUIPO:
${knowledgeContext || 'Sin información guardada aún'}
${githubContext}
${jiraContext}

INSTRUCCIONES:
1. Sé útil y proactivo
2. Si alguien comparte información útil, indícalo con 📌 para guardarla en la base de conocimiento
3. Pregunta por blockers y progreso regularmente
4. Usa formato markdown para respuestas largas
5. Si detectas un posible blocker, ofrécete a crear un ticket para trackearlo
6. **ACCIONES SOBRE TICKETS** (solo cuando el usuario lo pida explícitamente):
   - GitHub: [GITHUB_ACTION: create_issue | repo: owner/repo | title: Título | body: Desc | labels: bug,blocker]
   - GitHub: [GITHUB_ACTION: close_issue | repo: owner/repo | number: 123]
   - GitHub: [GITHUB_ACTION: comment_issue | repo: owner/repo | number: 123 | comment: Comentario]
   - Jira: [JIRA_ACTION: create_ticket | projectKey: PROJ | summary: Título | description: Desc | priority: High | type: Bug]
   - Jira: [JIRA_ACTION: update_ticket | projectKey: PROJ | issueKey: PROJ-123 | status: Done | priority: Low]
   - Jira: [JIRA_ACTION: comment_ticket | projectKey: PROJ | issueKey: PROJ-123 | comment: Comentario]
7. Referencia issues de GitHub con #numero y tickets Jira con PROJ-123`

    // Call LLM
    let aiResponseText: string
    try {
      const ZAI = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.default.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          ...history,
        ],
        thinking: { type: 'disabled' },
      })
      aiResponseText = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.'
    } catch (aiError) {
      console.error('AI Error:', aiError)
      aiResponseText = '⚠️ Tuve un problema al procesar tu mensaje. Por favor, intenta de nuevo en un momento.'
    }

    // Process GitHub actions from AI response
    const githubActionPattern = /\[GITHUB_ACTION:\s*(\w+)\s*\|(.+?)\]/g
    const jiraActionPattern = /\[JIRA_ACTION:\s*(\w+)\s*\|(.+?)\]/g
    let actionResults: string[] = []
    let match
    const githubRegex = new RegExp(githubActionPattern)

    while ((match = githubRegex.exec(aiResponseText)) !== null) {
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
    while ((match = jiraRegex.exec(aiResponseText)) !== null) {
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
    let finalResponse = aiResponseText.replace(/\[GITHUB_ACTION:[^\]]+\]\n?/g, '').replace(/\[JIRA_ACTION:[^\]]+\]\n?/g, '').trim()
    if (actionResults.length > 0) {
      finalResponse += '\n\n---\n' + actionResults.join('\n')
    }

    // Save AI message
    const aiMessage = await db.message.create({
      data: { teamId, senderId: null, senderName: 'Dayless.ai', senderType: 'ai', content: finalResponse },
    })

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
      data: { userMessage, aiMessage },
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
