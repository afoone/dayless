// ============================================================
// Jira Cloud REST API v3 Integration Service
// Handles all Jira API calls for Dayless.ai
// ============================================================

export interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description: string | null
    status: { name: string; statusCategory: { colorName: string } }
    assignee: { displayName: string; emailAddress: string; avatarUrls: { '48x48': string } } | null
    reporter: { displayName: string } | null
    priority: { name: string; iconUrl: string } | null
    issuetype: { name: string; iconUrl: string; subtask: boolean }
    labels: string[]
    created: string
    updated: string
    resolutiondate: string | null
    comment?: { comments: JiraComment[] }
  }
  self: string
}

export interface JiraComment {
  id: string
  body: string
  author: { displayName: string }
  created: string
}

export interface JiraProject {
  key: string
  name: string
  projectTypeKey: string
  style: string
}

interface JiraApiConfig {
  baseUrl: string
  token: string
  email: string
}

function buildConfig(project: {
  jiraBaseUrl?: string | null
  jiraToken?: string | null
}): JiraApiConfig | null {
  if (!project.jiraBaseUrl || !project.jiraToken) return null
  // Extract email from token if it's in email:token format
  let email = ''
  let token = project.jiraToken
  if (token.includes(':')) {
    const parts = token.split(':')
    email = parts[0]
    token = parts.slice(1).join(':')
  }
  return {
    baseUrl: project.jiraBaseUrl.replace(/\/$/, ''),
    token,
    email,
  }
}

function getHeaders(config: JiraApiConfig): HeadersInit {
  if (config.email) {
    // Basic auth with email:api_token
    const encoded = btoa(`${config.email}:${config.token}`)
    return {
      'Authorization': `Basic ${encoded}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }
  // Bearer token
  return {
    'Authorization': `Bearer ${config.token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

async function jiraFetch(url: string, config: JiraApiConfig, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: { ...getHeaders(config), ...options.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Jira API error ${response.status}: ${error.errorMessages?.[0] || error.message || response.statusText}`)
  }
  return response
}

// --- Issues ---

export async function searchIssues(config: JiraApiConfig, jql: string, params: {
  maxResults?: number
  startAt?: number
  fields?: string[]
} = {}): Promise<{ issues: JiraIssue[]; total: number }> {
  const searchParams = new URLSearchParams()
  searchParams.set('jql', jql)
  searchParams.set('maxResults', String(params.maxResults || 30))
  if (params.startAt) searchParams.set('startAt', String(params.startAt))
  searchParams.set('fields', (params.fields || ['summary', 'description', 'status', 'assignee', 'reporter', 'priority', 'issuetype', 'labels', 'created', 'updated', 'resolutiondate', 'comment']).join(','))

  const url = `${config.baseUrl}/rest/api/3/search?${searchParams.toString()}`
  const response = await jiraFetch(url, config)
  const data = await response.json()
  return { issues: data.issues || [], total: data.total || 0 }
}

export async function getIssue(config: JiraApiConfig, issueKey: string): Promise<JiraIssue> {
  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=*all`
  const response = await jiraFetch(url, config)
  return response.json()
}

export async function createIssue(config: JiraApiConfig, data: {
  projectKey: string
  summary: string
  description?: string
  issueType?: string
  priority?: string
  assignee?: string
  labels?: string[]
}): Promise<JiraIssue> {
  const url = `${config.baseUrl}/rest/api/3/issue`

  const body: any = {
    fields: {
      project: { key: data.projectKey },
      summary: data.summary,
      issuetype: { name: data.issueType || 'Task' },
      description: data.description ? {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: data.description }],
        }],
      } : undefined,
      priority: data.priority ? { name: data.priority } : undefined,
      labels: data.labels || undefined,
    },
  }

  if (data.assignee) {
    body.fields.assignee = { name: data.assignee }
  }

  const response = await jiraFetch(url, config, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return response.json()
}

export async function updateIssue(config: JiraApiConfig, issueKey: string, data: {
  summary?: string
  description?: string
  status?: string
  priority?: string
  labels?: string[]
}): Promise<JiraIssue> {
  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`
  const fields: any = {}

  if (data.summary) fields.summary = data.summary
  if (data.priority) fields.priority = { name: data.priority }
  if (data.labels) fields.labels = data.labels
  if (data.description) {
    fields.description = {
      type: 'doc', version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: data.description }] }],
    }
  }

  const body: any = {}
  if (Object.keys(fields).length > 0) body.fields = fields

  // Status transitions need a different endpoint
  if (data.status) {
    // First get available transitions
    const transUrl = `${url}/transitions`
    const transResponse = await jiraFetch(transUrl, config)
    const transData = await transResponse.json()
    const transition = transData.transitions?.find((t: any) =>
      t.name.toLowerCase() === data.status.toLowerCase() ||
      t.name.toUpperCase() === data.status.toUpperCase()
    )
    if (transition) {
      body.transition = { id: transition.id }
    }
  }

  const response = await jiraFetch(url, config, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

  // PUT doesn't return issue, fetch it
  return getIssue(config, issueKey)
}

export async function addComment(config: JiraApiConfig, issueKey: string, body: string): Promise<JiraComment> {
  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`
  const response = await jiraFetch(url, config, {
    method: 'POST',
    body: JSON.stringify({
      body: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
      },
    }),
  })
  return response.json()
}

// --- Helpers ---

export function buildConfigFromProject(project: {
  jiraBaseUrl?: string | null
  jiraProjectKey?: string | null
  jiraToken?: string | null
}): { config: JiraApiConfig; projectKey: string } | null {
  const config = buildConfig(project)
  if (!config || !project.jiraProjectKey) return null
  return { config, projectKey: project.jiraProjectKey }
}

export function formatIssueForAI(issue: JiraIssue): string {
  const f = issue.fields
  const status = f.status?.name || 'Unknown'
  const assignee = f.assignee?.displayName || 'unassigned'
  const type = f.issuetype?.name || 'Issue'
  const priority = f.priority?.name || ''
  return `${issue.key} [${status}] "${f.summary}" (${type}${priority ? `, ${priority}` : ''}, ${assignee})${f.description ? ` - ${stripJiraFormatting(f.description).slice(0, 150)}` : ''}`
}

export function formatIssuesSummaryForAI(issues: JiraIssue[]): string {
  if (issues.length === 0) return 'No issues found.'
  const header = `**Jira Issues** (${issues.length}):\n`
  const list = issues.map(i => `- ${formatIssueForAI(i)}`).join('\n')
  return header + list
}

function stripJiraFormatting(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[(.*?)\|(.*?)\]/g, '$1') // links
    .replace(/[.*?]/g, '') // formatting
    .replace(/\{[^}]+\}/g, '') // smart links
    .replace(/<[^>]+>/g, '') // html
    .replace(/\|/g, '')
    .trim()
}
