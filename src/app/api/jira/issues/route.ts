import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchIssues, buildConfigFromProject, formatIssuesSummaryForAI } from '@/lib/jira'

// GET /api/jira/issues?projectId=xxx&status=open&maxResults=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const setup = buildConfigFromProject(project)
    if (!setup) {
      return NextResponse.json({ success: false, error: 'Jira not configured. Set jiraBaseUrl, jiraProjectKey and jiraToken.' }, { status: 400 })
    }

    const { config, projectKey } = setup
    const status = searchParams.get('status') || 'open'
    const maxResults = parseInt(searchParams.get('maxResults') || '20')
    const startAt = parseInt(searchParams.get('startAt') || '0')

    // Build JQL
    let jql = `project = "${projectKey}"`
    if (status === 'open') {
      jql += ' AND statusCategory NOT IN ("Done")'
    } else if (status === 'closed') {
      jql += ' AND statusCategory = "Done"'
    }
    const assigneeFilter = searchParams.get('assignee')
    if (assigneeFilter) jql += ` AND assignee = "${assigneeFilter}"`
    const labelFilter = searchParams.get('labels')
    if (labelFilter) jql += ` AND labels = "${labelFilter}"`

    jql += ' ORDER BY updated DESC'

    const result = await searchIssues(config, jql, { maxResults, startAt })

    return NextResponse.json({ success: true, data: result.issues, meta: { total: result.total, projectKey } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/jira/issues?projectId=xxx - Create issue
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const setup = buildConfigFromProject(project)
    if (!setup) {
      return NextResponse.json({ success: false, error: 'Jira not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { summary, description, issueType, priority, assignee, labels } = body

    if (!summary) {
      return NextResponse.json({ success: false, error: 'summary is required' }, { status: 400 })
    }

    const { createIssue } = await import('@/lib/jira')
    const issue = await createIssue(setup.config, {
      projectKey: setup.projectKey,
      summary,
      description,
      issueType,
      priority,
      assignee,
      labels,
    })

    await db.integrationLog.create({
      data: {
        teamId: project.teamId,
        type: 'jira',
        action: 'issue_created',
        externalId: issue.key,
        data: JSON.stringify({ key: issue.key, summary: body.summary }),
        status: 'success',
      },
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
