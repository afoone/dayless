import { db } from '@/lib/db'
import {
  addIssueComment as githubAddIssueComment,
  buildConfigFromProject as githubBuildConfigFromProject,
  getIssue as githubGetIssue,
  listIssues as githubListIssues,
  updateIssue as githubUpdateIssue,
} from '@/lib/github'
import {
  addComment as jiraAddComment,
  buildConfigFromProject as jiraBuildConfigFromProject,
  getIssue as jiraGetIssue,
  searchIssues as jiraSearchIssues,
  updateIssue as jiraUpdateIssue,
} from '@/lib/jira'

export type TicketSourceType = 'jira' | 'github' | 'manual'

export type ExternalTicket = {
  key: string
  title: string
  description: string
  status: string
  priority?: string | null
  estimate?: string | null
  assigneeName?: string | null
  updatedAt?: string | null
}

export type TicketUpdateInput = {
  title?: string
  description?: string
  status?: string
  priority?: string
  estimate?: string
}

export interface TicketSourceAdapter {
  type: TicketSourceType
  supportsWrite(): boolean
  listTickets(projectId: string): Promise<ExternalTicket[]>
  getTicket(projectId: string, ticketKey: string): Promise<ExternalTicket | null>
  updateTicket(projectId: string, ticketKey: string, input: TicketUpdateInput): Promise<ExternalTicket | null>
  addComment(projectId: string, ticketKey: string, comment: string): Promise<boolean>
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function getProject(projectId: string) {
  return db.project.findUnique({ where: { id: projectId } })
}

function buildJiraAdapter(): TicketSourceAdapter {
  return {
    type: 'jira',
    supportsWrite: () => true,
    async listTickets(projectId) {
      const project = await getProject(projectId)
      const setup = project ? jiraBuildConfigFromProject(project) : null
      if (!setup) return []
      const result = await jiraSearchIssues(
        setup.config,
        `project = "${setup.projectKey}" ORDER BY updated DESC`,
        { maxResults: 100 }
      )
      return result.issues.map((issue) => ({
        key: issue.key,
        title: issue.fields.summary,
        description: normalizeText(issue.fields.description),
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || null,
        assigneeName: issue.fields.assignee?.displayName || null,
        updatedAt: issue.fields.updated || null,
      }))
    },
    async getTicket(projectId, ticketKey) {
      const project = await getProject(projectId)
      const setup = project ? jiraBuildConfigFromProject(project) : null
      if (!setup) return null
      const issue = await jiraGetIssue(setup.config, ticketKey)
      return {
        key: issue.key,
        title: issue.fields.summary,
        description: normalizeText(issue.fields.description),
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || null,
        assigneeName: issue.fields.assignee?.displayName || null,
        updatedAt: issue.fields.updated || null,
      }
    },
    async updateTicket(projectId, ticketKey, input) {
      const project = await getProject(projectId)
      const setup = project ? jiraBuildConfigFromProject(project) : null
      if (!setup) return null
      const issue = await jiraUpdateIssue(setup.config, ticketKey, {
        summary: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
      })
      return {
        key: issue.key,
        title: issue.fields.summary,
        description: normalizeText(issue.fields.description),
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || null,
        assigneeName: issue.fields.assignee?.displayName || null,
        updatedAt: issue.fields.updated || null,
      }
    },
    async addComment(projectId, ticketKey, comment) {
      const project = await getProject(projectId)
      const setup = project ? jiraBuildConfigFromProject(project) : null
      if (!setup) return false
      await jiraAddComment(setup.config, ticketKey, comment)
      return true
    },
  }
}

function buildGitHubAdapter(): TicketSourceAdapter {
  return {
    type: 'github',
    supportsWrite: () => true,
    async listTickets(projectId) {
      const project = await getProject(projectId)
      const config = project ? githubBuildConfigFromProject(project) : null
      if (!config) return []
      const issues = await githubListIssues(config, { state: 'open', per_page: 100 })
      return issues.map((issue) => ({
        key: String(issue.number),
        title: issue.title,
        description: issue.body || '',
        status: issue.state,
        priority: null,
        assigneeName: issue.assignee?.login || null,
        updatedAt: issue.updated_at,
      }))
    },
    async getTicket(projectId, ticketKey) {
      const project = await getProject(projectId)
      const config = project ? githubBuildConfigFromProject(project) : null
      if (!config) return null
      const issue = await githubGetIssue(config, Number(ticketKey))
      return {
        key: String(issue.number),
        title: issue.title,
        description: issue.body || '',
        status: issue.state,
        priority: null,
        assigneeName: issue.assignee?.login || null,
        updatedAt: issue.updated_at,
      }
    },
    async updateTicket(projectId, ticketKey, input) {
      const project = await getProject(projectId)
      const config = project ? githubBuildConfigFromProject(project) : null
      if (!config) return null
      const issue = await githubUpdateIssue(config, Number(ticketKey), {
        title: input.title,
        body: input.description,
        state: input.status === 'done' ? 'closed' : undefined,
      })
      return {
        key: String(issue.number),
        title: issue.title,
        description: issue.body || '',
        status: issue.state,
        priority: null,
        assigneeName: issue.assignee?.login || null,
        updatedAt: issue.updated_at,
      }
    },
    async addComment(projectId, ticketKey, comment) {
      const project = await getProject(projectId)
      const config = project ? githubBuildConfigFromProject(project) : null
      if (!config) return false
      await githubAddIssueComment(config, Number(ticketKey), comment)
      return true
    },
  }
}

function buildManualAdapter(): TicketSourceAdapter {
  return {
    type: 'manual',
    supportsWrite: () => true,
    async listTickets(projectId) {
      const rows = await db.ticket.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      })
      return rows.map((row) => ({
        key: row.id,
        title: row.title,
        description: row.description || '',
        status: row.progress || 'open',
        priority: row.priority,
        estimate: row.estimate,
        updatedAt: row.updatedAt.toISOString(),
      }))
    },
    async getTicket(projectId, ticketKey) {
      const row = await db.ticket.findFirst({
        where: { projectId, OR: [{ id: ticketKey }, { metadata: { contains: `"ticketKey":"${ticketKey}"` } }] },
      })
      if (!row) return null
      return {
        key: ticketKey,
        title: row.title,
        description: row.description || '',
        status: row.progress || 'open',
        priority: row.priority,
        estimate: row.estimate,
        updatedAt: row.updatedAt.toISOString(),
      }
    },
    async updateTicket(projectId, ticketKey, input) {
      const row = await db.ticket.findFirst({
        where: { projectId, OR: [{ id: ticketKey }, { metadata: { contains: `"ticketKey":"${ticketKey}"` } }] },
      })
      if (!row) return null
      const updated = await db.ticket.update({
        where: { id: row.id },
        data: {
          title: input.title ?? undefined,
          description: input.description ?? undefined,
          priority: input.priority ?? undefined,
          estimate: input.estimate ?? undefined,
          progress: input.status ?? undefined,
        },
      })
      return {
        key: ticketKey,
        title: updated.title,
        description: updated.description || '',
        status: updated.progress || 'open',
        priority: updated.priority,
        estimate: updated.estimate,
        updatedAt: updated.updatedAt.toISOString(),
      }
    },
    async addComment(projectId, ticketKey, comment) {
      const row = await db.ticket.findFirst({
        where: { projectId, OR: [{ id: ticketKey }, { metadata: { contains: `"ticketKey":"${ticketKey}"` } }] },
      })
      if (!row) return false
      const metadata = row.metadata ? JSON.parse(row.metadata) : {}
      const comments = Array.isArray(metadata.comments) ? metadata.comments : []
      comments.push({ body: comment, createdAt: new Date().toISOString() })
      await db.ticket.update({
        where: { id: row.id },
        data: { metadata: JSON.stringify({ ...metadata, comments }) },
      })
      return true
    },
  }
}

export async function getTicketSourceAdapter(projectId: string): Promise<TicketSourceAdapter> {
  const project = await getProject(projectId)
  if (project?.jiraBaseUrl && project?.jiraToken && project?.jiraProjectKey) return buildJiraAdapter()
  if (project?.githubRepo && project?.githubToken) return buildGitHubAdapter()
  return buildManualAdapter()
}
