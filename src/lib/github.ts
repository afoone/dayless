// ============================================================
// GitHub API Integration Service
// Handles all GitHub REST API calls for Dayless.ai
// ============================================================

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  labels: { name: string; color: string }[]
  assignee: { login: string; avatar_url: string } | null
  created_at: string
  updated_at: string
  comments: number
  pull_request?: { url: string }
}

export interface GitHubIssueComment {
  id: number
  body: string
  user: { login: string }
  created_at: string
}

export interface GitHubRepo {
  full_name: string
  description: string | null
  html_url: string
  open_issues_count: number
  default_branch: string
}

interface GitHubApiConfig {
  token: string
  owner: string
  repo: string
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  // Handles: "org/repo", "github.com/org/repo", "https://github.com/org/repo"
  const clean = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
  const [owner, repo] = clean.split('/')
  return { owner, repo }
}

async function githubFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`GitHub API error ${response.status}: ${error.message || response.statusText}`)
  }

  return response
}

// --- Issues ---

export async function listIssues(config: GitHubApiConfig, params: {
  state?: 'open' | 'closed' | 'all'
  labels?: string
  sort?: 'created' | 'updated' | 'comments'
  direction?: 'asc' | 'desc'
  per_page?: number
  page?: number
  assignee?: string
  since?: string
} = {}): Promise<GitHubIssue[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('state', params.state || 'open')
  searchParams.set('sort', params.sort || 'updated')
  searchParams.set('direction', params.direction || 'desc')
  searchParams.set('per_page', String(params.per_page || 30))
  if (params.labels) searchParams.set('labels', params.labels)
  if (params.assignee) searchParams.set('assignee', params.assignee)
  if (params.since) searchParams.set('since', params.since)
  if (params.page) searchParams.set('page', String(params.page))

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues?${searchParams.toString()}`
  const response = await githubFetch(url, config.token)
  const issues = await response.json()

  // Filter out pull requests (GitHub includes PRs in issues API)
  return issues.filter((issue: GitHubIssue) => !issue.pull_request)
}

export async function getIssue(config: GitHubApiConfig, issueNumber: number): Promise<GitHubIssue> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`
  const response = await githubFetch(url, config.token)
  return response.json()
}

export async function createIssue(config: GitHubApiConfig, data: {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}): Promise<GitHubIssue> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues`
  const response = await githubFetch(url, config.token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function updateIssue(config: GitHubApiConfig, issueNumber: number, data: {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  labels?: string[]
  assignees?: string[]
}): Promise<GitHubIssue> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`
  const response = await githubFetch(url, config.token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function addIssueComment(config: GitHubApiConfig, issueNumber: number, body: string): Promise<GitHubIssueComment> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`
  const response = await githubFetch(url, config.token, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
  return response.json()
}

export async function getIssueComments(config: GitHubApiConfig, issueNumber: number): Promise<GitHubIssueComment[]> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`
  const response = await githubFetch(url, config.token)
  return response.json()
}

// --- Repo ---

export async function getRepo(config: GitHubApiConfig): Promise<GitHubRepo> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}`
  const response = await githubFetch(url, config.token)
  return response.json()
}

// --- Helpers ---

export function buildConfig(repoUrl: string, token: string): GitHubApiConfig {
  const { owner, repo } = parseRepoUrl(repoUrl)
  return { token, owner, repo }
}

export function buildConfigFromProject(project: {
  githubRepo?: string | null
  githubToken?: string | null
}): GitHubApiConfig | null {
  if (!project.githubRepo || !project.githubToken) return null
  return buildConfig(project.githubRepo, project.githubToken)
}

export function formatIssueForAI(issue: GitHubIssue): string {
  const labels = issue.labels.map(l => l.name).join(', ')
  const assignee = issue.assignee?.login || 'unassigned'
  return `#${issue.number} [${issue.state.toUpperCase()}] "${issue.title}" (${assignee})${labels ? ` Labels: ${labels}` : ''} - ${issue.body?.slice(0, 200) || 'No description'}`
}

export function formatIssuesSummaryForAI(issues: GitHubIssue[], config: GitHubApiConfig): string {
  if (issues.length === 0) return 'No open issues found.'
  const repo = `${config.owner}/${config.repo}`
  const header = `**GitHub Issues from ${repo}** (${issues.length} open):\n`
  const list = issues.map(i => `- ${formatIssueForAI(i)}`).join('\n')
  return header + list
}
